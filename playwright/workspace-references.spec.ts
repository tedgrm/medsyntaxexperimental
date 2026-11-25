// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {
    captureAlerts, enterItemQuery, enterItemTitle, itemBox, itemFrame, itemQuery, linkQueries, linkTitles,
    normalise, openItemBox, openWorkspace, titleField, waitForItems, workspaceItem, workspaceItems,
} from './helpers';

// References between items (#1 AND #3) in the WORKSPACE: REF in product-development/workspace-ux.md.

const base = [
    {title: 'A', query: 'aa'}, {title: 'B', query: 'bb'}, {title: 'C', query: '#1 OR #2'}, {title: 'D', query: '#3 AND #1'},
];
const fullC = '(aa) OR (bb)';
const fullD = '((aa) OR (bb)) AND (aa)';

const button = (page: Page, name: string) => page.getByRole('button', {name, exact: true});
const partOf = (page: Page, n: number, name: string) => workspaceItem(page, n).locator(`[data-part="${name}"]`);
const chips = (page: Page, n: number) => itemFrame(page, n).locator('.item-ref');
/** The chips as they are drawn, over the visualisation */
const drawn = (page: Page, n: number) => itemFrame(page, n).locator('.drawn-ref');
const problemChips = (page: Page, n: number) => itemFrame(page, n).locator('.item-ref.has-problem');
const warning = (page: Page, n: number) => itemFrame(page, n).locator('#warning-references');
const dynamicInput = (page: Page, n: number) => itemFrame(page, n).locator('#dynamic-input');
const tidy = (text: string) => normalise(text).replace(/ \)/g, ')').replace(/\( /g, '(');
const titles = (page: Page) => workspaceItems(page).locator('.item-title')
    .evaluateAll((fields: HTMLInputElement[]) => fields.map((field) => field.value));

/** Click a card's button at once, without waiting for anything. n is a position, from 0. */
const clickNow = (page: Page, n: number, name: string) => page.evaluate(([position, part]) =>
    (document.querySelectorAll('#myList li.item')[position as number].querySelector(`[data-part="${part}"]`) as HTMLElement).click(),
[n, name] as const);

async function fakeClipboard(page: Page) {
    await page.addInitScript(() => {
        (window as any).copied = [];
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {writeText: (text: string) => {
                (window as any).copied.push(text);
                return Promise.resolve();
            }},
        });
    });
}

/** What Copy full query copies of item n; the text of Copy query for an item without references; '' if it can't. */
async function fullQuery(page: Page, n: number): Promise<string> {
    return page.evaluate(async (position) => {
        const item = document.querySelectorAll('#myList li.item')[position];
        const full = item.querySelector('[data-part="copy-full"]') as HTMLButtonElement;
        const copy = full.hidden ? item.querySelector('[data-part="copy"]') as HTMLButtonElement : full;
        (window as any).copied = [];
        copy.click();
        await new Promise((resolve) => setTimeout(resolve, 20));
        return (window as any).copied[0] || '';
    }, n);
}

const references = (query: string) => (query.match(/(?<=^|[\s()])#([1-9]\d*\??|\?)(?=$|[\s()])/g) || []);

/** The queries in the items, in the link, as chips and as full queries. */
async function expectQueries(page: Page, queries: string[], full?: (string | null)[]) {
    await expect.poll(async () => (await linkQueries(page)).map(tidy)).toEqual(queries);
    await expect(workspaceItems(page)).toHaveCount(queries.length);
    for (let n = 0; n < queries.length; n++) {
        await expect.poll(async () => tidy(await itemQuery(page, n)), `item ${n + 1}`).toBe(queries[n]);
        await expect(chips(page, n), `chips of item ${n + 1}`).toHaveText(references(queries[n]));
    }
    for (let n = 0; n < (full || []).length; n++) {
        if (full![n] !== null) {
            expect(tidy(await fullQuery(page, n)), `full query of item ${n + 1}`).toBe(full![n]);
        }
    }
}

/** And the same after a reload. */
async function expectQueriesAndReload(page: Page, queries: string[], full?: (string | null)[]) {
    await expectQueries(page, queries, full);
    await page.reload();
    await waitForItems(page, queries.length);
    await expectQueries(page, queries, full);
}

let pageErrors: string[] = [];

test.beforeEach(async ({page}) => {
    await fakeClipboard(page);
    pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
});

test.afterEach(() => {
    // Also on pages without references: a notice of WebKit, and errors in iframes that it stopped loading.
    expect(pageErrors.filter((error) => !/ResizeObserver loop|Can't find variable/.test(error))).toEqual([]);
});

test.describe('References: what they are and look like', () => {
    test('a word of # and a number, outside quotes, is one', async ({page}) => {
        const last = '#1 AND (#2 OR #1) NOT "#1" AND a#1 AND #1[tiab] AND #1-#2 AND #01 AND #0';
        await openWorkspace(page, [{title: 'A', query: 'aa'}, {title: 'B', query: 'bb'}, {title: 'C', query: last}]);
        await expect(chips(page, 2)).toHaveText(['#1', '#2', '#1']);
        await expect(problemChips(page, 2)).toHaveCount(0);
        expect(tidy(await fullQuery(page, 2)))
            .toBe('(aa) AND ((bb) OR (aa)) NOT "#1" AND a#1 AND #1[tiab] AND #1-#2 AND #01 AND #0');
        await expect(itemFrame(page, 2).locator('#medsyntax-target1')).toContainText('#1-#2');
    });

    test('a chip has the colour, title and full query of its item, and follows their changes', async ({page}) => {
        await openWorkspace(page, base);
        const chip = chips(page, 3).first();
        await expect(drawn(page, 3).first()).toHaveCSS('background-color', 'rgb(137, 202, 38)');
        await expect(drawn(page, 3).first()).toHaveCSS('color', 'rgb(28, 37, 37)');
        await expect(chip).toHaveAttribute('title', '3. C: ' + fullC);
        await expect(drawn(page, 3).nth(1)).toHaveCSS('color', 'rgb(255, 255, 255)');
        await enterItemTitle(page, 2, 'New');
        await expect(chip).toHaveAttribute('title', '3. New: ' + fullC);
        await enterItemQuery(page, 0, 'cc');
        await expect(chip).toHaveAttribute('title', '3. New: (cc) OR (bb)');
        await button(page, 'Move up query 3').click();
        await waitForItems(page, 4);
        await expect(chips(page, 3).first()).toHaveText('#2');
        await expect(drawn(page, 3).first()).toHaveCSS('background-color', 'rgb(255, 180, 7)');
    });

    test('chips have their own colour inside nested brackets, and are over their text, also after a resize', async ({page}) => {
        await openWorkspace(page, [...base.slice(0, 2), {title: 'C', query: '#1 OR (#2 AND (#1 NOT (#2 OR #9)))'}]);
        const red = 'rgb(225, 42, 57)', yellow = 'rgb(255, 180, 7)', problem = 'rgb(251, 228, 228)';
        await expect(drawn(page, 2)).toHaveText(['#1', '#2', '#1', '#2', '#9']);
        for (const width of [1920, 500]) {
            await page.setViewportSize({width, height: 900});
            for (const [n, color] of [red, yellow, red, yellow, problem].entries()) {
                const chip = drawn(page, 2).nth(n);
                await expect(chip).toHaveCSS('background-color', color);
                expect(await chip.evaluate((element) => {
                    for (let parent: Element | null = element; parent; parent = parent.parentElement) {
                        if (getComputedStyle(parent).filter !== 'none') {
                            return false;
                        }
                    }
                    return true;
                })).toBe(true);
                await expect.poll(async () => {
                    const [a, b] = [(await chip.boundingBox())!, (await chips(page, 2).nth(n).boundingBox())!];
                    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.width - b.width));
                }).toBeLessThan(1.5);
            }
        }
        // A scope edit takes its chips away.
        await chips(page, 2).nth(3).hover();
        await chips(page, 2).nth(3).click();
        await expect(dynamicInput(page, 2)).toBeVisible();
        await expect.poll(async () => await drawn(page, 2).count() === await chips(page, 2).count()).toBe(true);
        await page.keyboard.press('Escape');
        await expect(drawn(page, 2)).toHaveCount(5);
    });

    test('typing a reference makes a chip', async ({page}) => {
        await openWorkspace(page, base);
        await openItemBox(page, 1);
        await page.keyboard.press('End');
        await page.keyboard.type(' OR #1');
        await expect(chips(page, 1)).toHaveText(['#1']);
        await expect(partOf(page, 1, 'copy-full')).toBeVisible();
        expect(await fullQuery(page, 1)).toBe('bb OR (aa)');
        await expect(partOf(page, 0, 'copy-full')).toBeHidden();
    });

    test('a title or query with HTML does not run in a chip or its tooltip', async ({page}) => {
        await page.addInitScript(() => { (window as any).hacked = false; });
        const html = '<img src=x onerror="top.hacked=true">';
        await openWorkspace(page, [{title: html, query: 'aa'}, {title: 'B', query: '#1'}]);
        await expect(chips(page, 1)).toHaveAttribute('title', '1. ' + html + ': aa');
        await expect(chips(page, 1).locator('img')).toHaveCount(0);
        expect(await page.evaluate(() => (window as any).hacked)).toBe(false);
    });

    test('an EDITOR opened directly has no references', async ({page}) => {
        await page.goto('/index.html');
        await page.locator('#query-input1').fill('#1 AND heart');
        await page.locator('#query-input1').blur();
        await expect(page.locator('#medsyntax-target1 .term').first()).toHaveText('#1');
        await expect(page.locator('.item-ref')).toHaveCount(0);
        await expect(page.locator('#warning-references')).toHaveCount(0);
    });

    test('scopes, scope edits and keys work on a query with chips', async ({page}) => {
        await openWorkspace(page, [...base.slice(0, 2), {title: 'C', query: '(#1 OR (#2 AND cc)) AND #1'}]);
        const node = () => itemFrame(page, 2).locator('[role=treeitem]:focus').getAttribute('aria-label')
            .then((label) => tidy(label || ''));
        await page.keyboard.press('3');
        await expect.poll(node).toBe('C: (#1 OR (#2 AND cc)) AND #1');
        await page.keyboard.press('ArrowRight');
        await expect.poll(node).toBe('(#1 OR (#2 AND cc))');
        await page.keyboard.press('ArrowRight');
        await expect.poll(node).toBe('AND #1');
        await expect(itemFrame(page, 2).locator('.current-scope')).toHaveCount(1);
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 2)).toHaveValue('AND #1');
        await dynamicInput(page, 2).fill('AND #2');
        await page.keyboard.press('Enter');
        await expect.poll(async () => tidy(await itemQuery(page, 2))).toBe('(#1 OR (#2 AND cc)) AND #2');
        await expect(chips(page, 2)).toHaveText(['#1', '#2', '#2']);
        // with the mouse
        await chips(page, 2).nth(2).hover();
        await chips(page, 2).nth(2).click();
        await expect(dynamicInput(page, 2)).toBeVisible();
        expect(tidy(await dynamicInput(page, 2).inputValue())).toBe('AND #2');
        await page.keyboard.press('Escape');
        await expect(chips(page, 2)).toHaveText(['#1', '#2', '#2']);
    });
});

test.describe('References: copying', () => {
    test('Copy query copies the text, Copy full query the whole, and says so', async ({page}) => {
        await openWorkspace(page, base);
        await button(page, 'Copy query D').click();
        expect(await page.evaluate(() => (window as any).copied)).toEqual(['#3 AND #1']);
        const copyFull = button(page, 'Copy full query D');
        await copyFull.click();
        await expect(copyFull).toHaveText('Copied');
        await expect(copyFull).toBeFocused();
        expect(await page.evaluate(() => (window as any).copied)).toEqual(['#3 AND #1', fullD]);
        await expect(copyFull).toHaveText('Copy full query', {timeout: 4000});
    });

    test('brackets around a whole query are not doubled', async ({page}) => {
        await openWorkspace(page, [
            {title: 'A', query: '(aa OR bb)'}, {title: 'B', query: '(aa) OR (bb)'}, {title: 'C', query: '("(x)" OR cc)'},
            {title: 'D', query: '#1 AND #2 AND #3'},
        ]);
        expect(tidy(await fullQuery(page, 3))).toBe('(aa OR bb) AND ((aa) OR (bb)) AND ("(x)" OR cc)');
    });

    test('collapsed, just typed, while loading, and from the More menu', async ({page}) => {
        await openWorkspace(page, base);
        await button(page, 'Collapse query 3').click();
        expect(await fullQuery(page, 2)).toBe(fullC);
        await openItemBox(page, 0);
        await page.keyboard.press('End');
        await page.keyboard.type('x');
        expect(await fullQuery(page, 2)).toBe('(aax) OR (bb)');
        await clickNow(page, 0, 'down');
        expect(await fullQuery(page, 2)).toBe('(aax) OR (bb)');
        await waitForItems(page, 4);
        await page.setViewportSize({width: 800, height: 800});
        await expect(partOf(page, 2, 'copy-full')).toBeHidden();
        await button(page, 'More actions for query 3').click();
        await button(page, 'Copy full query C').click();
        await expect(button(page, 'More actions for query 3')).toHaveText('Copied');
    });

    for (const width of [1920, 1150, 1149, 1000, 999, 375]) {
        test(`the buttons are in one row at ${width}px`, async ({page}) => {
            await page.setViewportSize({width, height: 900});
            await openWorkspace(page, base);
            for (const n of [0, 2]) {
                const inMenu = width < (n === 0 ? 1000 : 1150);
                const shown = workspaceItem(page, n).locator('.actions .btn:visible');
                await expect(shown).toHaveCount(inMenu ? 5 : n === 0 ? 8 : 9);
                const tops = await shown.evaluateAll((all) => [...new Set(all.map((b) => Math.round(b.getBoundingClientRect().top)))]);
                expect(tops.length).toBe(1);
                if (width >= 999) {
                    const title = (await titleField(page, n).boundingBox())!;
                    expect(Math.abs(tops[0] - title.y)).toBeLessThan(6);
                    expect(title.width).toBeGreaterThan(190);
                }
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        });
    }
});

test.describe('References: moving items', () => {
    test('M1/M2. move an item up and down again', async ({page}) => {
        await openWorkspace(page, base);
        await button(page, 'Move up query 2').click();
        await expectQueriesAndReload(page, ['bb', 'aa', '#2 OR #1', '#3 AND #2'], ['bb', 'aa', fullC, fullD]);
        await button(page, 'Move down query 1').click();
        await expectQueriesAndReload(page, base.map(({query}) => query), ['aa', 'bb', fullC, fullD]);
    });

    test('M3. move the item that holds references', async ({page}) => {
        await openWorkspace(page, base);
        await button(page, 'Move up query 3').click();
        await expectQueriesAndReload(page, ['aa', '#1 OR #3', 'bb', '#2 AND #1'], [null, fullC, null, fullD]);
        await button(page, 'Move up query 2').click();
        await expectQueriesAndReload(page, ['#2 OR #3', 'aa', 'bb', '#1 AND #2'], [fullC, null, null, fullD]);
    });

    test('M4. a reference to a later item works', async ({page}) => {
        await openWorkspace(page, base);
        await button(page, 'Move down query 3').click();
        await expectQueriesAndReload(page, ['aa', 'bb', '#4 AND #1', '#1 OR #2'], [null, null, fullD, fullC]);
    });

    test('M5. moving an item without references to it changes and reloads nothing else', async ({page}) => {
        await openWorkspace(page, [{title: 'A', query: 'aa'}, {title: 'B', query: '#1'}, {title: 'X', query: 'xx'}, {title: 'Y', query: 'yy'}]);
        for (const n of [0, 1, 3]) {
            await itemFrame(page, n).locator('html').evaluate(() => {
                (window as any).notReloaded = true;
                document.addEventListener('medsyntax:rendered', () => { (window as any).rendered = true; });
            });
        }
        await button(page, 'Move down query 3').click();
        await waitForItems(page, 4);
        await expectQueries(page, ['aa', '#1', 'yy', 'xx']);
        for (const n of [0, 1, 2]) {
            expect(await itemFrame(page, n).locator('html').evaluate(() => [(window as any).notReloaded, (window as any).rendered]))
                .toEqual([true, undefined]);
        }
    });

    test('M6. from the top to the bottom of 12 items, one and two digits', async ({page}) => {
        test.slow();
        const list = Array.from({length: 11}, (_, n) => ({title: 'T' + n, query: 'q' + n}));
        await openWorkspace(page, [...list, {title: 'R', query: '#1 OR #2 OR #10 OR #11'}]);
        const order = [...list.map((_, n) => n), 11];
        for (let n = 0; n < 11; n++) {
            await button(page, 'Move down query ' + (n + 1)).click();
            [order[n], order[n + 1]] = [order[n + 1], order[n]];
            const at = (item: number) => '#' + (order.indexOf(item) + 1);
            const text = [0, 1, 9, 10].map(at).join(' OR ');
            await expect.poll(async () => tidy((await linkQueries(page))[order.indexOf(11)])).toBe(text);
        }
        await waitForItems(page, 12);
        await expectQueriesAndReload(page, order.map((item) => item === 11
            ? [0, 1, 9, 10].map((target) => '#' + (order.indexOf(target) + 1)).join(' OR ') : 'q' + item));
    });

    test('M7. a swap of two numbers in one query, with repeats', async ({page}) => {
        await openWorkspace(page, [...base.slice(0, 2), {title: 'C', query: '#1 OR #2 OR #1 OR (#2 AND #1)'}]);
        await button(page, 'Move up query 2').click();
        await expectQueriesAndReload(page, ['bb', 'aa', '#2 OR #1 OR #2 OR (#1 AND #2)'],
            [null, null, '(aa) OR (bb) OR (aa) OR ((bb) AND (aa))']);
    });

    for (const [name, start, queries] of [
        ['an item that is referred to', 0, ['bb', '#4 OR #1', '#2 AND #4', 'aa', 'ee', 'ff']],
        ['an item with references', 2, ['aa', 'bb', '#6 AND #1', 'ee', 'ff', '#1 OR #2']],
    ] as const) {
        test(`M8. move fast, ${name}`, async ({page}) => {
            await openWorkspace(page, [...base, {title: 'E', query: 'ee'}, {title: 'F', query: 'ff'}]);
            for (let n: number = start; n < start + 3; n++) {
                await clickNow(page, n, 'down');
            }
            await waitForItems(page, 6);
            await expectQueriesAndReload(page, [...queries]);
        });
    }

    test('M8. move fast, all in one go, up and down', async ({page}) => {
        await openWorkspace(page, base);
        await page.evaluate(() => {
            const click = (n: number, part: string) => (document.querySelectorAll('#myList li.item')[n]
                .querySelector(`[data-part="${part}"]`) as HTMLElement).click();
            click(0, 'down'); // b a C D
            click(1, 'down'); // b C a D
            click(3, 'up'); // b C D a
            click(0, 'down'); // C b D a
            click(1, 'down'); // C D b a
        });
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, ['#4 OR #3', '#1 AND #4', 'bb', 'aa'], [fullC, fullD, null, null]);
    });

    test('M9. with the keyboard', async ({page}) => {
        await openWorkspace(page, base);
        await button(page, 'Move down query 1').focus();
        await page.keyboard.press('Enter');
        await expect(button(page, 'Move down query 2')).toBeFocused();
        await waitForItems(page, 4);
        await page.keyboard.press('Enter');
        await expect(button(page, 'Move down query 3')).toBeFocused();
        await expectQueriesAndReload(page, ['bb', '#3 OR #1', 'aa', '#2 AND #3'], [null, fullC, null, fullD]);
    });

    test('M10. with a collapsed item that refers to it', async ({page}) => {
        await openWorkspace(page, base);
        await button(page, 'Collapse query 3').click();
        await button(page, 'Move up query 2').click();
        await waitForItems(page, 4);
        await button(page, 'Expand query 3').click();
        await expect(chips(page, 2)).toHaveText(['#2', '#1']);
        await expectQueriesAndReload(page, ['bb', 'aa', '#2 OR #1', '#3 AND #2']);
    });

    test('M11. text that is no reference, and titles, never change', async ({page}) => {
        const text = '"#1" OR a#1 OR #1[tiab] OR #1-#2 OR #01 OR #0 OR #1a';
        await openWorkspace(page, [...base.slice(0, 2), {title: '#1 and #2', query: text}, {title: 'D', query: '#1'}]);
        await button(page, 'Move up query 2').click();
        await expectQueries(page, ['bb', 'aa', text, '#2'].map(tidy));
        expect(await linkTitles(page)).toEqual(['B', 'A', '#1 and #2', 'D']);
    });

    test('M12. a number without an item stays, and works once the item is there', async ({page}) => {
        await openWorkspace(page, [...base.slice(0, 2), {title: 'C', query: '#1 OR #5'}]);
        await expect(problemChips(page, 2)).toHaveText(['#5']);
        await button(page, 'Move up query 2').click();
        await expectQueries(page, ['bb', 'aa', '#2 OR #5'], [null, null, '']);
        await button(page, '+ Add query after 3').click();
        await button(page, '+ Add query after 4').click();
        await waitForItems(page, 5);
        await enterItemTitle(page, 3, 'X');
        await enterItemQuery(page, 4, 'zz');
        await expect(problemChips(page, 2)).toHaveCount(0);
        expect(tidy(await fullQuery(page, 2))).toBe('(aa) OR (zz)');
    });

    test('M13. a move changes no full query, four levels deep', async ({page}) => {
        await openWorkspace(page, [
            {title: 'A', query: 'aa'}, {title: 'B', query: '#1 OR bb'}, {title: 'C', query: '#2 AND cc'},
            {title: 'D', query: '#3 NOT dd'}, {title: 'E', query: '#4 OR #1'},
        ]);
        const full = async () => {
            const result: Record<string, string> = {};
            const names = await titles(page);
            for (let n = 0; n < names.length; n++) {
                result[names[n]] = tidy(await fullQuery(page, n));
            }
            return result;
        };
        const before = await full();
        expect(before.E).toBe('((((aa) OR bb) AND cc) NOT dd) OR (aa)');
        for (const [n, direction] of [[0, 'down'], [4, 'up'], [2, 'down'], [1, 'up'], [3, 'up'], [4, 'up']] as const) {
            await clickNow(page, n, direction);
            await waitForItems(page, 5);
            expect(await full()).toEqual(before);
        }
        await page.reload();
        await waitForItems(page, 5);
        expect(await full()).toEqual(before);
    });

    for (const seed of [1, 2, 3]) {
        test(`M14. random changes, seed ${seed}, as a model that keeps references by item`, async ({page}) => {
            test.slow();
            let state = seed * 7919;
            const random = (below: number) => {
                state = (state * 1103515245 + 12345) % 2147483648;
                return Math.floor(state / 65536) % below;
            };
            type Ref = {target: number | null, label: string};
            type Item = {id: number, text: string, refs: Ref[]};
            const ref = (target: number): Ref => ({target, label: ''});
            let list: Item[] = [
                {id: 0, text: 'aa', refs: []}, {id: 1, text: 'bb', refs: []}, {id: 2, text: 'cc', refs: [ref(0), ref(1)]},
                {id: 3, text: 'dd', refs: [ref(2), ref(0), ref(4)]}, {id: 4, text: 'ee', refs: [ref(1)]},
            ];
            let nextId = 5;
            let removed: {item: Item, position: number, pending: Ref[]} | null = null;
            const render = (item: Item) => [item.text, ...item.refs.map(({target, label}) => {
                const position = list.findIndex(({id}) => id === target);
                return '#' + (position === -1 ? label : position + 1);
            })].join(' OR ');

            await openWorkspace(page, list.map((item) => ({title: 'T' + item.id, query: render(item)})));
            for (let step = 0; step < 30; step++) {
                const n = random(list.length);
                const kind = random(6);
                if (kind === 0 && list.length < 9) {
                    await clickNow(page, n, 'duplicate');
                    list.splice(n + 1, 0, {...list[n], id: nextId++, refs: list[n].refs.map((r) => ({...r}))});
                    removed = null;
                } else if (kind === 1 && list.length > 3) {
                    await clickNow(page, n, 'remove');
                    const item = list[n];
                    list.forEach((other) => other.refs.filter((r) => r.target === null).forEach((r) => { r.label = '?'; }));
                    list.splice(n, 1);
                    const pending = list.flatMap((other) => other.refs.filter((r) => r.target === item.id));
                    pending.forEach((r) => {
                        r.target = null;
                        r.label = (n + 1) + '?';
                    });
                    removed = {item, position: n, pending};
                } else if (kind === 2 && removed) {
                    await page.evaluate(() => document.getElementById('undo-button')!.click());
                    list.splice(removed.position, 0, removed.item);
                    removed.pending.forEach((r) => { r.target = removed!.item.id; });
                    removed = null;
                } else {
                    const direction = n === 0 ? 'down' : n === list.length - 1 ? 'up' : random(2) ? 'up' : 'down';
                    await clickNow(page, n, direction);
                    const to = direction === 'up' ? n - 1 : n + 1;
                    [list[n], list[to]] = [list[to], list[n]];
                    removed = null;
                }
                // The items at once; the link can wait in Safari, which allows 100 changes in 10 seconds.
                const stored = await page.evaluate(() => (window as any).eval('items.map(itemQuery)'));
                expect(stored.map(tidy), `items after step ${step}`).toEqual(list.map(render));
                if (random(3) === 0) {
                    await waitForItems(page, list.length);
                }
            }
            await waitForItems(page, list.length);
            await expect.poll(async () => (await linkQueries(page)).map(tidy), {timeout: 20000}).toEqual(list.map(render));
            await expectQueriesAndReload(page, list.map(render));
        });
    }
});

test.describe('References: add, duplicate, remove, Undo', () => {
    test.beforeEach(async ({page}) => {
        await openWorkspace(page, base);
    });

    test('A1. add at the top, in between and at the end', async ({page}) => {
        await button(page, '+ Add query at the top').click();
        await waitForItems(page, 5);
        await expectQueries(page, ['', 'aa', 'bb', '#2 OR #3', '#4 AND #2']);
        await button(page, '+ Add query after 3').click();
        await waitForItems(page, 6);
        await expectQueries(page, ['', 'aa', 'bb', '', '#2 OR #3', '#5 AND #2']);
        await button(page, '+ Add query after 6').click();
        await waitForItems(page, 7);
        await expectQueries(page, ['', 'aa', 'bb', '', '#2 OR #3', '#5 AND #2', '']);
        // Clear items are dropped on reload.
        await page.reload();
        await waitForItems(page, 4);
        await expectQueries(page, base.map(({query}) => query), ['aa', 'bb', fullC, fullD]);
    });

    test('A2. duplicate an item that is referred to, and one with references', async ({page}) => {
        await button(page, 'Duplicate query 1').click();
        await waitForItems(page, 5);
        await expectQueriesAndReload(page, ['aa', 'aa', 'bb', '#1 OR #3', '#4 AND #1']);
        await button(page, 'Duplicate query 4').click();
        await waitForItems(page, 6);
        await expectQueriesAndReload(page, ['aa', 'aa', 'bb', '#1 OR #3', '#1 OR #3', '#4 AND #1'],
            [null, null, null, fullC, fullC, fullD]);
    });

    test('A3/A4. remove an item that is referred to, and Undo', async ({page}) => {
        await button(page, 'Remove query 2').click();
        await expectQueries(page, ['aa', '#1 OR #2?', '#2 AND #1'], [null, '', '']);
        await expect(problemChips(page, 1)).toHaveText(['#2?']);
        await expect(warning(page, 1)).toHaveText('#2?: this query was removed.');
        await expect(problemChips(page, 2)).toHaveText(['#2']);
        await expect(warning(page, 2)).toHaveText('#2: query 2 has a reference with a problem.');
        await expect(partOf(page, 1, 'copy-full')).toBeDisabled();
        await expect(partOf(page, 2, 'copy-full')).toBeDisabled();
        await button(page, 'Undo').click();
        await waitForItems(page, 4);
        await expect(warning(page, 2)).toBeHidden();
        await expectQueriesAndReload(page, base.map(({query}) => query), ['aa', 'bb', fullC, fullD]);
    });

    test('A5. remove, Undo, remove another, Undo', async ({page}) => {
        for (const n of [2, 1, 3, 4]) {
            await button(page, 'Remove query ' + n).click();
            await waitForItems(page, 3);
            await button(page, 'Undo').click();
            await waitForItems(page, 4);
            await expectQueries(page, base.map(({query}) => query));
        }
        await expectQueriesAndReload(page, base.map(({query}) => query), ['aa', 'bb', fullC, fullD]);
    });

    test('A6. after a second removal, Undo restores only that one', async ({page}) => {
        await button(page, 'Remove query 2').click();
        await button(page, 'Remove query 1').click();
        await expectQueries(page, ['#1? OR #?', '#1 AND #1?']);
        await button(page, 'Undo').click();
        await waitForItems(page, 3);
        await expectQueriesAndReload(page, ['aa', '#1 OR #?', '#2 AND #1']);
    });

    test('A6. also for a removed item that has an older missing reference itself', async ({page}) => {
        await button(page, 'Remove query 2').click();
        await button(page, 'Remove query 2').click(); // C: #1 OR #2?
        await button(page, 'Undo').click();
        await waitForItems(page, 3);
        await expectQueriesAndReload(page, ['aa', '#1 OR #?', '#2 AND #1']);
    });

    test('A7. Undo restores what is left of the references', async ({page}) => {
        await button(page, 'Remove query 2').click();
        await waitForItems(page, 3);
        await enterItemQuery(page, 1, '#2? AND xx AND #2?');
        await enterItemQuery(page, 2, 'yy');
        await button(page, 'Undo').click();
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, ['aa', 'bb', '#2 AND xx AND #2', 'yy']);
    });

    test('A8. without Undo, a missing reference does not point to a new item', async ({page}) => {
        await button(page, 'Remove query 2').click();
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 4);
        await enterItemQuery(page, 1, 'new');
        await expectQueriesAndReload(page, ['aa', 'new', '#1 OR #2?', '#3 AND #1'], [null, null, '', '']);
        await button(page, 'Remove query 1').click();
        await expectQueries(page, ['new', '#1? OR #?', '#2 AND #1?']);
    });

    test('A9. remove an item with references, and Undo', async ({page}) => {
        await button(page, 'Remove query 3').click();
        await expectQueries(page, ['aa', 'bb', '#3? AND #1']);
        await button(page, 'Undo').click();
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, base.map(({query}) => query), ['aa', 'bb', fullC, fullD]);
        await button(page, 'Remove query 3').click();
        await button(page, 'Move down query 1').click();
        await expect(page.locator('#undo-toast')).toBeHidden();
        await expectQueries(page, ['bb', 'aa', '#3? AND #2']);
    });

    test('A10. remove the only item, and Undo, also with text in the clear item', async ({page}) => {
        await openWorkspace(page, [{title: 'A', query: 'aa'}]);
        await button(page, 'Remove query 1').click();
        await waitForItems(page, 1);
        await enterItemQuery(page, 0, 'bb OR #1?');
        await button(page, 'Undo').click();
        await waitForItems(page, 2);
        await expectQueriesAndReload(page, ['aa', 'bb OR #1'], [null, 'bb OR (aa)']);
    });

    test('Clear query of an item that is referred to', async ({page}) => {
        await button(page, 'Clear query A').click();
        await expect(warning(page, 2)).toHaveText('#1: query 1 has no query.');
        await expectQueries(page, ['', 'bb', '#1 OR #2', '#3 AND #1'], [null, 'bb', '', '']);
        await enterItemQuery(page, 0, 'zz');
        await expect(warning(page, 2)).toBeHidden();
        expect(await fullQuery(page, 2)).toBe('(zz) OR (bb)');
    });
});

test.describe('References: an open scope edit (R2)', () => {
    const edit = async (page: Page, n: number) => {
        await page.keyboard.press(String(n + 1));
        await expect(itemFrame(page, n).locator('[role=treeitem][aria-level="1"]')).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, n)).toBeFocused();
    };
    const cursor = (page: Page, n: number) => dynamicInput(page, n)
        .evaluate((input: HTMLTextAreaElement) => [input.selectionStart, input.selectionEnd]);

    for (const [key, query] of [['Enter', '#2 OR #1 OR x'], ['Escape', '#2 OR #1']]) {
        test(`S1/S3. of the whole query: it stays open with the new numbers, then ${key}`, async ({page}) => {
            await openWorkspace(page, base);
            await edit(page, 2);
            await page.keyboard.press('End');
            await page.keyboard.type(' OR x');
            await clickNow(page, 0, 'down');
            await expect(dynamicInput(page, 2)).toHaveValue('#2 OR #1 OR x');
            expect(await cursor(page, 2)).toEqual([13, 13]);
            await dynamicInput(page, 2).focus();
            await page.keyboard.press(key);
            await expect(dynamicInput(page, 2)).toHaveCount(0);
            await waitForItems(page, 4);
            await expectQueriesAndReload(page, ['bb', 'aa', query, '#3 AND #2']);
        });
    }

    for (const [key, first] of [['Enter', '#2 OR #1'], ['Escape', 'cc OR #1']]) {
        test(`S2/S3. of a part, with references around it and a new one in it, then ${key}`, async ({page}) => {
            await openWorkspace(page, [...base.slice(0, 2), {title: 'C', query: '(cc OR #2) AND #1 AND #2'}]);
            await page.keyboard.press('3');
            await expect(itemFrame(page, 2).locator('[role=treeitem][aria-level="1"]')).toBeFocused();
            await page.keyboard.press('ArrowDown');
            await expect.poll(async () => tidy(await itemFrame(page, 2).locator('[role=treeitem]:focus').getAttribute('aria-label') || ''))
                .toBe('(cc OR #2)');
            await page.keyboard.press('Enter');
            await dynamicInput(page, 2).fill('(#1 OR #2)');
            await clickNow(page, 1, 'up');
            await expect(dynamicInput(page, 2)).toHaveValue('(#2 OR #1)');
            await dynamicInput(page, 2).focus();
            await page.keyboard.press(key);
            await waitForItems(page, 3);
            await expectQueriesAndReload(page, ['bb', 'aa', `(${first}) AND #2 AND #1`]);
        });
    }

    test('S4. with an unfinished reference and bracket it stays open, and Enter still alerts', async ({page}) => {
        const alerts = captureAlerts(page);
        await openWorkspace(page, base);
        await edit(page, 2);
        await dynamicInput(page, 2).fill('(#1 OR # OR #2');
        await clickNow(page, 0, 'down');
        await expect(dynamicInput(page, 2)).toHaveValue('(#2 OR # OR #1');
        await dynamicInput(page, 2).focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => alerts.length).toBe(1);
        await expect(dynamicInput(page, 2)).toHaveValue('(#2 OR # OR #1');
        await page.keyboard.press('Escape');
        await waitForItems(page, 4);
        await expectQueries(page, ['bb', 'aa', '#2 OR #1', '#3 AND #2']);
    });

    test('S5. remove the referenced item while the edit is open, and Undo', async ({page}) => {
        await openWorkspace(page, base);
        await edit(page, 2);
        await clickNow(page, 1, 'remove');
        await expect(dynamicInput(page, 1)).toHaveValue('#1 OR #2?');
        await page.evaluate(() => document.getElementById('undo-button')!.click());
        await expect(dynamicInput(page, 2)).toHaveValue('#1 OR #2');
        await dynamicInput(page, 2).focus();
        await page.keyboard.press('Enter');
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, base.map(({query}) => query), ['aa', 'bb', fullC, fullD]);
    });

    test('S6. edits open in two items', async ({page}) => {
        await openWorkspace(page, base);
        for (const n of [2, 3]) {
            await itemFrame(page, n).locator('html').evaluate(() => {
                (window as any).eval('startKeyboardScopeEdit([], wholeQueryScope().nodes)');
            });
            await expect(dynamicInput(page, n)).toBeVisible();
        }
        await clickNow(page, 0, 'down');
        await expect(dynamicInput(page, 2)).toHaveValue('#2 OR #1');
        await expect(dynamicInput(page, 3)).toHaveValue('#3 AND #2');
        for (const n of [2, 3]) {
            await dynamicInput(page, n).focus();
            await page.keyboard.press('Enter');
            await expect(dynamicInput(page, n)).toHaveCount(0);
        }
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, ['bb', 'aa', '#2 OR #1', '#3 AND #2'], [null, null, fullC, fullD]);
    });

    test('S7. moving the item itself closes its edit, with the new numbers', async ({page}) => {
        await openWorkspace(page, base);
        await edit(page, 2);
        await page.keyboard.type('zzz');
        await clickNow(page, 2, 'up');
        await waitForItems(page, 4);
        await expect(dynamicInput(page, 1)).toHaveCount(0);
        await expectQueriesAndReload(page, ['aa', '#1 OR #3', 'bb', '#2 AND #1']);
    });
});

test.describe('References: typing in the query box (R1, R3)', () => {
    test('T1. typing and then moving at once loses nothing', async ({page}) => {
        await openWorkspace(page, base);
        await openItemBox(page, 2);
        await page.keyboard.press('End');
        await page.keyboard.type(' OR #2 OR abcdef', {delay: 0});
        await clickNow(page, 0, 'down');
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, ['bb', 'aa', '#2 OR #1 OR #1 OR abcdef', '#3 AND #2']);
    });

    test('T1. typing in the item that moves, and going on typing in another', async ({page}) => {
        await openWorkspace(page, base);
        await openItemBox(page, 2);
        await page.keyboard.press('End');
        await page.keyboard.type(' OR xx', {delay: 0});
        await clickNow(page, 2, 'up');
        await waitForItems(page, 4);
        await openItemBox(page, 3);
        await page.keyboard.press('End');
        await page.keyboard.type(' OR yy', {delay: 0});
        await clickNow(page, 1, 'up');
        await openItemBox(page, 3);
        await page.keyboard.press('End');
        await page.keyboard.type(' OR zz', {delay: 0});
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, ['#2 OR #3 OR xx', 'aa', 'bb', '#1 AND #2 OR yy OR zz']);
    });

    test('T2. the cursor and selection stay in place when the text gets longer', async ({page}) => {
        const list = Array.from({length: 9}, (_, n) => ({title: 'T' + n, query: 'q' + n}));
        await openWorkspace(page, [...list, {title: 'R', query: '#9 OR abc OR #9 OR def'}]);
        await openItemBox(page, 9);
        await itemBox(page, 9).evaluate((box: HTMLTextAreaElement) => box.setSelectionRange(6, 9)); // abc
        await page.evaluate(() => (window as any).eval('const added = createItem(""); changeItems([added, ...items], () => placeItem(added, 0)); refreshList()'));
        await expect(itemBox(page, 10)).toHaveValue('#10 OR abc OR #10 OR def');
        await expect(itemBox(page, 10)).toBeFocused();
        expect(await itemBox(page, 10).evaluate((box: HTMLTextAreaElement) =>
            box.value.slice(box.selectionStart, box.selectionEnd))).toBe('abc');
        await page.keyboard.type('xyz');
        await expect(itemBox(page, 10)).toHaveValue('#10 OR xyz OR #10 OR def');
    });

    test('T3. a query with unbalanced brackets or quotes is renumbered too', async ({page}) => {
        await openWorkspace(page, [...base.slice(0, 2), {title: 'C', query: '(#1 OR #2'}, {title: 'D', query: '#1 OR "#2'}]);
        await button(page, 'Move up query 2').click();
        await waitForItems(page, 4);
        await expect.poll(() => linkQueries(page)).toEqual(['bb', 'aa', '(#2 OR #1', '#2 OR "#2']);
        await expect(itemBox(page, 2)).toHaveValue('(#2 OR #1');
        await expect(itemFrame(page, 2).locator('#warning-bracket-open')).toBeVisible();
        await expect(itemFrame(page, 3).locator('#warning-quotes')).toBeVisible();
    });

    test('T4. a late message with old numbers changes nothing', async ({page}) => {
        await openWorkspace(page, base);
        await itemFrame(page, 2).locator('html').evaluate(() => {
            (window as any).old = {status: 'success', type: 'updateUrl',
                payload: new URLSearchParams(location.search).get('ws') + '%index%' + location.search.replace(/^\?ws=\d+&/, '')};
        });
        await button(page, 'Move up query 2').click();
        await waitForItems(page, 4);
        await itemFrame(page, 2).locator('html').evaluate(() => window.parent.postMessage((window as any).old, location.origin));
        await page.waitForTimeout(300);
        await expectQueriesAndReload(page, ['bb', 'aa', '#2 OR #1', '#3 AND #2']);
    });

    test('T4. messages on their way during several moves in one go', async ({page}) => {
        await openWorkspace(page, base);
        await itemFrame(page, 2).locator('#query-input1').evaluate((box: HTMLTextAreaElement) => {
            // Its messages arrive after all the moves.
            box.value += ' OR xx';
            (window as any).eval("syntaxCheck('query-input1', 'medsyntax-target1')");
            const click = (n: number, part: string) => (window.parent.document.querySelectorAll('#myList li.item')[n]
                .querySelector(`[data-part="${part}"]`) as HTMLElement).click();
            click(0, 'down');
            box.value += ' OR yy';
            (window as any).eval("syntaxCheck('query-input1', 'medsyntax-target1')");
            click(0, 'down');
            click(0, 'down');
            click(3, 'up');
        });
        await waitForItems(page, 4);
        // a b C D -> b a C D -> a b C D -> b a C D -> b a D C
        await expectQueriesAndReload(page, ['bb', 'aa', '#4 AND #2', '#2 OR #1 OR xx OR yy']);
    });

    test('T5. a title typed at the same time', async ({page}) => {
        await openWorkspace(page, base);
        await titleField(page, 2).focus();
        await page.keyboard.press('End');
        await page.keyboard.type('xyz', {delay: 0});
        await clickNow(page, 0, 'down');
        await titleField(page, 3).focus();
        await page.keyboard.press('End');
        await page.keyboard.type('uvw', {delay: 0});
        await clickNow(page, 2, 'up');
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, ['bb', '#3 OR #1', 'aa', '#2 AND #3']);
        expect(await titles(page)).toEqual(['B', 'Cxyz', 'A', 'Duvw']);
    });
});

test.describe('References: loading (R4, R6)', () => {
    /** Open the items, with the iframes of some ids held back until release(). */
    async function openHeldBack(page: Page, list: {title?: string, query?: string}[], ids: number[]) {
        await openWorkspace(page, list);
        let release = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        await page.route(/\/index\.html\?ws=(\d+)&/, async (route) => {
            const id = Number(/ws=(\d+)&/.exec(route.request().url())![1]);
            if (ids.includes(id)) {
                await gate;
            }
            await route.continue().catch(() => {});
        });
        await page.reload({waitUntil: 'commit'});
        await expect(workspaceItems(page)).toHaveCount(list.length);
        return release;
    }

    for (const [name, ids] of [['all', [0, 1, 2, 3]], ['the referring', [2, 3]], ['the referenced', [0, 1]]] as const) {
        test(`L1/L2. move, duplicate and remove while loading: ${name} items`, async ({page}) => {
            const release = await openHeldBack(page, base, [...ids]);
            await clickNow(page, 0, 'down'); // B A C D
            await clickNow(page, 0, 'duplicate'); // B B' A C D
            await expect.poll(() => linkQueries(page)).toEqual(['bb', 'bb', 'aa', '#3 OR #1', '#4 AND #3']);
            await clickNow(page, 1, 'remove'); // B A C D
            await clickNow(page, 2, 'up'); // B C A D
            await expect.poll(() => linkQueries(page)).toEqual(['bb', '#3 OR #1', 'aa', '#2 AND #3']);
            release();
            await waitForItems(page, 4);
            await page.waitForTimeout(300);
            await expectQueries(page, ['bb', '#3 OR #1', 'aa', '#2 AND #3'], [null, fullC, null, fullD]);
        });
    }

    test('L1. remove and Undo while loading', async ({page}) => {
        const release = await openHeldBack(page, base, [0, 1, 2, 3]);
        await clickNow(page, 1, 'remove');
        await expect.poll(() => linkQueries(page)).toEqual(['aa', '#1 OR #2?', '#2 AND #1']);
        await page.evaluate(() => document.getElementById('undo-button')!.click());
        release();
        await waitForItems(page, 4);
        await page.waitForTimeout(300);
        await expectQueries(page, base.map(({query}) => query), ['aa', 'bb', fullC, fullD]);
    });

    test('L3. clear items in the link are dropped, and the numbers follow', async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
        const list = [['', ''], ['A', 'aa'], ['', ''], ['B', 'bb'], ['C', '#2 OR #4 OR #3 OR #1'], ['', ''], ['D', '#5 AND #2 AND #6']];
        const link = await page.evaluate((all) => {
            const pack = (window as any).LZString.compressToEncodedURIComponent;
            return '?' + all.map(([title, query], n) => String(n).padStart(9, '0') + 'iframequery='
                + pack(new URLSearchParams({querytitle: pack(title), query: pack(query)}).toString())).join('&');
        }, list);
        await page.goto('/workspace/' + link);
        await waitForItems(page, 4);
        await expectQueriesAndReload(page, ['aa', 'bb', '#1 OR #2 OR #3? OR #1?', '#3 AND #1 AND #6?']);
    });

    test('L4. a link from before this feature', async ({page}) => {
        await openWorkspace(page, [{query: 'heart'}, {query: '#1 AND lung'}]);
        await expectQueriesAndReload(page, ['heart', '#1 AND lung'], [null, '(heart) AND lung']);
    });

    test('L5. a reload right after a move', async ({page}) => {
        await openWorkspace(page, base);
        await clickNow(page, 1, 'up');
        await page.reload();
        await waitForItems(page, 4);
        await expectQueries(page, ['bb', 'aa', '#2 OR #1', '#3 AND #2'], [null, null, fullC, fullD]);
    });

    test('L6. an item with only a title stays, and has no query', async ({page}) => {
        await openWorkspace(page, [{title: 'A'}, {title: 'B', query: '#1 OR bb'}]);
        await expect(warning(page, 1)).toHaveText('#1: query 1 has no query.');
        await expectQueriesAndReload(page, ['', '#1 OR bb'], [null, '']);
    });
});

test.describe('References: an item that loads without one of its scripts', () => {
    for (const script of ['lzstring.js', 'color-mode.js', 'editor.js', 'item.js', 'item-keyboard.js', 'references.js',
        'item-references.js']) {
        test(`${script}: it loads again, with the numbers of a move in between`, async ({page}) => {
            await openWorkspace(page, base);
            let failures = 0;
            await page.route(new RegExp('/' + script.replace('.', '\\.') + '$'), async (route) => {
                const frame = route.request().frame();
                if (failures < 1 && frame !== page.mainFrame() && frame.url().includes('ws=2&')) {
                    failures++;
                    await route.abort();
                } else {
                    await route.continue();
                }
            });
            // Only item C (id 2) loads again.
            await itemFrame(page, 2).locator('html').evaluate(() => window.location.reload());
            await expect.poll(() => failures).toBe(1);
            await page.waitForTimeout(500);
            await clickNow(page, 1, 'up');
            await expect.poll(() => itemFrame(page, 2).locator('html').evaluate(() => (window as any).itemIsReady),
                {timeout: 10000}).toBe(true);
            await waitForItems(page, 4);
            await expectQueries(page, ['bb', 'aa', '#2 OR #1', '#3 AND #2'], [null, null, fullC, fullD]);
            pageErrors = []; // of the failed load
        });
    }
});

test.describe('References: problems (R8)', () => {
    test('P1. an item that refers to itself', async ({page}) => {
        await openWorkspace(page, [{title: 'A', query: '#1 OR aa'}, {title: 'B', query: '#1'}]);
        await expect(warning(page, 0)).toHaveText('#1: it refers back to this query.');
        await expect(warning(page, 1)).toHaveText('#1: query 1 refers to itself.');
        await expect(partOf(page, 0, 'copy-full')).toBeDisabled();
        await expect(partOf(page, 1, 'copy-full')).toBeDisabled();
        await enterItemQuery(page, 0, 'aa');
        await expect(warning(page, 1)).toBeHidden();
        expect(await fullQuery(page, 1)).toBe('(aa)');
    });

    for (const size of [2, 3]) {
        test(`P1. a circle of ${size}, an item that refers to it, and breaking it`, async ({page}) => {
            const circle = Array.from({length: size}, (_, n) => ({title: 'T' + n, query: `q${n} OR #${(n + 1) % size + 1}`}));
            await openWorkspace(page, [...circle, {title: 'X', query: '#1'}]);
            for (let n = 0; n < size; n++) {
                await expect(problemChips(page, n)).toHaveCount(1);
                await expect(warning(page, n)).toContainText('refers back to this query');
                await expect(partOf(page, n, 'copy-full')).toBeDisabled();
            }
            await expect(warning(page, size)).toHaveText('#1: query 1 refers to itself.');
            await button(page, 'Move down query 1').click(); // a circle stays one
            await waitForItems(page, size + 1);
            for (let n = 0; n < size; n++) {
                await expect(warning(page, n)).toContainText('refers back to this query');
            }
            await enterItemQuery(page, 0, 'end');
            for (let n = 0; n <= size; n++) {
                await expect(problemChips(page, n)).toHaveCount(0);
                await expect(warning(page, n)).toBeHidden();
            }
            expect(await fullQuery(page, size)).not.toBe('');
        });
    }

    test('P1. removing breaks a circle, and Undo makes it again', async ({page}) => {
        await openWorkspace(page, [{title: 'A', query: '#2'}, {title: 'B', query: '#1'}]);
        await expect(warning(page, 0)).toContainText('refers back');
        await button(page, 'Remove query 2').click();
        await expect(warning(page, 0)).toHaveText('#2?: this query was removed.');
        await button(page, 'Undo').click();
        await waitForItems(page, 2);
        await expect(warning(page, 0)).toContainText('refers back');
        await expect(warning(page, 1)).toContainText('refers back');
    });

    test('P2. too long is found at once, and the page stays responsive', async ({page}) => {
        test.slow();
        await openWorkspace(page, [{title: 'T1', query: 'aa OR bb'},
            ...Array.from({length: 24}, (_, n) => ({title: 'T' + (n + 2), query: `#${n + 1} OR #${n + 1}`}))]);
        const time = await page.evaluate(() => {
            const start = performance.now();
            (window as any).eval('refreshReferences()');
            return performance.now() - start;
        });
        expect(time).toBeLessThan(500);
        const long = await page.evaluate(() => [...document.querySelectorAll('[data-part="copy-full"]')]
            .findIndex((b) => !(b as HTMLButtonElement).hidden && (b as HTMLButtonElement).disabled));
        expect(long).toBeGreaterThan(10);
        await expect(warning(page, long)).toHaveText('The query is too long with its references.');
        await expect(warning(page, long + 1)).toContainText('is too long with its references');
        await expect(partOf(page, long - 1, 'copy-full')).toBeEnabled();
    });

    for (const [name, query, text] of [
        ['empty', '', 'has no query'], ['unbalanced', '(aa', 'has unbalanced brackets or quotes'],
        ['with a missing reference', 'aa OR #99', 'has a reference with a problem'],
    ]) {
        test(`P3. a query that is ${name}, two levels down, and fixing it`, async ({page}) => {
            await openWorkspace(page, [{title: 'A', query}, {title: 'B', query: '#1 OR bb'}, {title: 'C', query: '#2 OR cc'}]);
            await expect(warning(page, 1)).toHaveText(`#1: query 1 ${text}.`);
            await expect(warning(page, 2)).toHaveText('#2: query 2 has a reference with a problem.');
            await expect(itemFrame(page, 2).locator('.drawn-ref.has-problem')).toHaveCSS('outline-style', 'dashed');
            await expect(partOf(page, 2, 'copy-full')).toBeDisabled();
            await enterItemQuery(page, 0, 'fixed');
            await expect(warning(page, 2)).toBeHidden();
            expect(tidy(await fullQuery(page, 2))).toBe('((fixed) OR bb) OR cc');
        });
    }

    test('a problem does not turn scope editing off', async ({page}) => {
        await openWorkspace(page, [{title: 'A', query: '#9 OR aa'}]);
        await expect(problemChips(page, 0)).toHaveCount(1);
        await page.keyboard.press('1');
        await expect(itemFrame(page, 0).locator('.current-scope')).toHaveCount(1);
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toHaveValue('#9 OR aa');
    });
});

test.describe('References: examples', () => {
    const multiline = (page: Page) => button(page, 'Show a multiline search example');

    test.beforeEach(async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
    });

    test('the multiline search example has nine items, and the last two combine the others', async ({page}) => {
        await multiline(page).click();
        await waitForItems(page, 9);
        await expect(multiline(page)).toBeHidden();
        await expect(button(page, 'Show example')).toBeHidden();
        await expect(page.locator('body')).toBeFocused();
        const queries = ['"Patient Handoff"[Mesh]', 'handover OR handoff OR "patient transfer"', '#1 OR #2',
            'SBAR OR ISBAR OR SBAR-R OR ISBARR OR ISOBAR',
            '"Communication"[Mesh] OR "Interdisciplinary Communication"[Mesh] OR "Patient Safety"[Mesh]',
            'teamwork OR communication OR "patient safety" OR "safety culture"', '#5 OR #6', '#3 AND #4 AND #7', '(#1 OR #2) AND (#4 AND (#5 OR (#6 AND #2)))'];
        await expectQueriesAndReload(page, queries, [...queries.slice(0, 7).map(() => null),
            `((${queries[0]}) OR (${queries[1]})) AND (${queries[3]}) AND ((${queries[4]}) OR (${queries[5]}))`,
            `((${queries[0]}) OR (${queries[1]})) AND ((${queries[3]}) AND ((${queries[4]}) OR ((${queries[5]}) AND (${queries[1]}))))`]);
        await expect(itemFrame(page, 8).locator('#medsyntax-target1 .term')).toHaveText(['#1', '#2', '#4', '#5', '#6', '#2']);
        await expect(problemChips(page, 8)).toHaveCount(0);
        await expect(itemFrame(page, 8).locator('.warning-medsyntax:visible')).toHaveCount(0);
        await expect(itemFrame(page, 8).locator('.brackets .brackets .brackets')).toHaveCount(1);
        expect(await titles(page)).toEqual(['Population: MeSH terms', 'Population: free text', 'Population', 'Intervention',
            'Outcome: MeSH terms', 'Outcome: free text', 'Outcome', 'Full search', 'Full search, nested']);
    });

    test('both example buttons show only while every item is clear', async ({page}) => {
        await expect(multiline(page)).toBeVisible();
        await expect(button(page, 'Show example')).toBeVisible();
        await enterItemTitle(page, 0, 'x');
        await expect(multiline(page)).toBeHidden();
        await expect(button(page, 'Show example')).toBeHidden();
        await enterItemTitle(page, 0, '');
        await expect(multiline(page)).toBeVisible();
        await button(page, 'Show example').click();
        await waitForItems(page, 4);
        await expect(multiline(page)).toBeHidden();
    });
});
