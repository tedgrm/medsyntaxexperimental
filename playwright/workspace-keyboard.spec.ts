// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {
    captureAlerts, itemBox, itemFrame, itemQuery, linkQueries, normalise, openWorkspace, titleField,
    waitForItems, workspaceItem,
} from './helpers';

// Keyboard navigation in the WORKSPACE: product-development/keyboard-navigation.md (its scenarios have a
// K before the number) and workspace-ux.md (14-17).

const query = '(aa OR (bb AND cc)) AND dd';
const topA = 'A: ' + query, topB = 'B: stroke NOT child*', topC = 'C: heart';
const outer = '(aa OR (bb AND cc))', inner = '(bb AND cc)';
const items = [{title: 'A', query}, {title: 'B', query: 'stroke NOT child*'}, {title: 'C', query: 'heart'}];

const button = (page: Page, name: string) => page.getByRole('button', {name, exact: true});
const dynamicInput = (page: Page, n: number) => itemFrame(page, n).locator('#dynamic-input');

/** "<position>: <label>" of the tree item that has the focus, or '' */
async function currentNode(page: Page): Promise<string> {
    return page.evaluate(() => {
        const frame = document.activeElement as HTMLIFrameElement;
        const focused = frame && frame.tagName === 'IFRAME' ? frame.contentDocument!.activeElement : null;
        if (!focused || focused.getAttribute('role') !== 'treeitem') {
            return '';
        }
        const position = [...document.querySelectorAll('#myList iframe')].indexOf(frame);
        return position + ': ' + focused.getAttribute('aria-label')!.replace(/\s+/g, ' ').replace(/ \)/g, ')').replace(/\( /g, '(');
    });
}

async function expectNode(page: Page, n: number, label: string) {
    await expect.poll(() => currentNode(page)).toBe(n + ': ' + label);
}

async function press(page: Page, key: string, n: number, label: string) {
    await page.keyboard.press(key);
    await expectNode(page, n, label);
}

/** Make item n current with the keyboard. */
async function selectItem(page: Page, n: number, label: string) {
    await titleField(page, n).focus();
    await press(page, 'Escape', n, label);
}

/** Open the query box with the card's button. */
async function openBox(page: Page, title: string) {
    await button(page, 'Edit query ' + title).click();
}

const tidy = (text: string) => normalise(text).replace(/ \)/g, ')').replace(/\( /g, '(');

const markers = (page: Page, n: number) => itemFrame(page, n).locator('.current-scope');

test.describe('WORKSPACE starts in navigation mode', () => {
    /** No text field is active in the page or in an item, and item 1 is current. */
    async function expectStarted(page: Page, label: string) {
        await expectNode(page, 0, label);
        expect(await page.evaluate(() => [document, ...[...document.querySelectorAll('iframe')].map((frame) => frame.contentDocument!)]
            .filter((doc) => /^(INPUT|TEXTAREA)$/.test(doc.activeElement ? doc.activeElement.tagName : '')).length)).toBe(0);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
    }

    test('on opening a link', async ({page}) => {
        await openWorkspace(page, items);
        await expectStarted(page, topA);
        await expect(markers(page, 0)).toHaveCount(1);
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'Alt+ArrowDown', 1, topB);
        await page.reload();
        await waitForItems(page, 3);
        await expectStarted(page, topA);
    });

    test('on opening without items: the clear item is current, and Enter goes to its query box', async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
        await expectStarted(page, 'Query 1');
        await expect(itemFrame(page, 0).locator('html')).toHaveClass(/item-is-current/);
        await page.keyboard.press('Enter');
        await expect(itemBox(page, 0)).toBeFocused();
    });

    for (const [name, count, label] of [
        ['Show example', 4, 'P (Population/Problem): handover OR "Patient Handoff"[Mesh] OR handoff OR "patient transfer"'],
        ['Show a multiline search example', 9, 'Population: MeSH terms: "Patient Handoff"[Mesh]'],
    ] as const) {
        test(`on loading an example: ${name}, also with the keyboard`, async ({page}) => {
            for (const withKey of [false, true]) {
                await page.goto('/workspace/');
                await waitForItems(page, 1);
                if (withKey) {
                    await button(page, name).focus();
                    await page.keyboard.press('Enter');
                } else {
                    await button(page, name).click();
                }
                await waitForItems(page, count);
                await expectStarted(page, label);
                await press(page, 'Alt+ArrowDown', 1, await itemFrame(page, 1).locator('[role=treeitem][aria-level="1"]')
                    .getAttribute('aria-label') as string);
            }
        });
    }

    test('a tall first query, and a small screen: the page stays at the top', async ({page}) => {
        await page.setViewportSize({width: 600, height: 300});
        await openWorkspace(page, [{title: 'L', query: Array.from({length: 400}, (_, n) => 'word' + n).join(' OR ')}]);
        await expect(itemFrame(page, 0).locator('[role=treeitem]:focus')).toHaveCount(1);
        await page.waitForTimeout(700);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
    });

    test('not if the user is somewhere else before the item has loaded', async ({page}) => {
        await openWorkspace(page, items);
        let release = () => {};
        const gate = new Promise<void>((resolve) => { release = resolve; });
        await page.route(/\/index\.html\?ws=0&/, async (route) => {
            await gate;
            await route.continue();
        });
        await page.reload({waitUntil: 'commit'});
        await titleField(page, 1).focus();
        release();
        await waitForItems(page, 3);
        await page.waitForTimeout(300);
        await expect(titleField(page, 1)).toBeFocused();
    });
});

test.describe('WORKSPACE number keys', () => {
    const status = (page: Page) => page.locator('#workspace-status');

    test.beforeEach(async ({page}) => {
        await openWorkspace(page, items);
    });

    test('a number selects that item, from an item, another item\'s scope and its own scope', async ({page}) => {
        const link = page.url();
        await selectItem(page, 0, topA);
        await press(page, '3', 2, topC);
        await press(page, 'Shift+Numpad1', 0, topA); // Shift: Playwright has NumLock off
        await press(page, 'ArrowDown', 0, outer);
        await press(page, '1', 0, topA);
        await press(page, 'ArrowDown', 0, outer);
        await press(page, '2', 1, topB);
        expect(page.url()).toBe(link);
    });

    test('right after loading, and then navigation mode has started', async ({page}) => {
        await press(page, '1', 0, topA);
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'Alt+ArrowDown', 1, topB);
        await page.keyboard.press('t');
        await expect(titleField(page, 1)).toBeFocused();
    });

    test('from a card button, the colour switch and an item without focus in its tree', async ({page}) => {
        await button(page, 'Duplicate query 1').focus();
        await press(page, '2', 1, topB);
        await page.getByRole('radio', {name: 'System', exact: true}).focus();
        await press(page, '3', 2, topC);
        await itemFrame(page, 2).locator('body').evaluate(() => (document.activeElement as HTMLElement).blur());
        await expect.poll(() => currentNode(page)).toBe('');
        await press(page, '1', 0, topA);
    });

    test('from the More menu, which closes; not for a missing number', async ({page}) => {
        await page.setViewportSize({width: 800, height: 800});
        const more = button(page, 'More actions for query 1');
        await more.focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('9');
        await expect(more).toHaveAttribute('aria-expanded', 'true');
        await press(page, '2', 1, topB);
        await expect(more).toHaveAttribute('aria-expanded', 'false');
    });

    test('digits in text fields are typed', async ({page}) => {
        await titleField(page, 0).focus();
        await page.keyboard.press('End');
        await page.keyboard.press('2');
        await expect(titleField(page, 0)).toHaveValue('A2');
        await press(page, 'Escape', 0, 'A2: ' + query);
        await openBox(page, 'A2');
        await expect(itemBox(page, 0)).toBeFocused();
        await page.keyboard.press('End');
        await page.keyboard.press('3');
        await expect(itemBox(page, 0)).toHaveValue(query + '3');
        await expect(itemBox(page, 0)).toBeFocused();
        await press(page, 'Escape', 0, 'A2: ' + query + '3');
        await press(page, 'ArrowDown', 0, outer);
        await page.keyboard.press('Enter');
        await dynamicInput(page, 0).fill('x');
        await page.keyboard.press('2');
        await expect(dynamicInput(page, 0)).toHaveValue('x2');
        await expect(dynamicInput(page, 0)).toBeFocused();
    });

    test('a missing number is announced, and the focus stays', async ({page}) => {
        await selectItem(page, 0, topA);
        for (const key of ['9', '0']) {
            await page.keyboard.press(key);
            await expect(status(page)).toHaveText('No query ' + key);
            await expectNode(page, 0, topA);
        }
        await button(page, 'Duplicate query 1').focus();
        await page.keyboard.press('7');
        await expect(status(page)).toHaveText('No query 7');
        await expect(button(page, 'Duplicate query 1')).toBeFocused();
    });

    test('a digit that cannot extend the number counts on its own', async ({page}) => {
        await selectItem(page, 2, topC);
        await press(page, '1', 0, topA);
        await press(page, '2', 1, topB);
    });

    test('a digit extends the number, but not after a pause or Alt+Down', async ({page}) => {
        await openWorkspace(page, Array.from({length: 12}, (_, n) => ({title: 'T' + (n + 1), query: 'heart'})));
        // Both at once, also while the focus is moving
        await page.keyboard.press('1');
        await page.keyboard.press('2');
        await expectNode(page, 11, 'T12: heart');
        await page.waitForTimeout(1200);
        await press(page, '1', 0, 'T1: heart');
        await page.waitForTimeout(1200);
        await press(page, '2', 1, 'T2: heart');
        await page.waitForTimeout(1200);
        await press(page, '1', 0, 'T1: heart');
        await press(page, 'Alt+ArrowDown', 1, 'T2: heart');
        await press(page, '2', 1, 'T2: heart');
    });

    test('a collapsed item expands', async ({page}) => {
        await button(page, 'Collapse query 2').click();
        await press(page, '2', 1, topB);
        await expect(button(page, 'Collapse query 2')).toBeVisible();
    });

    test('the numbers follow a move', async ({page}) => {
        await button(page, 'Move down query 1').click();
        await waitForItems(page, 3);
        await press(page, '1', 0, topB);
        await page.waitForTimeout(1200);
        await press(page, '2', 1, topA);
    });

    test('a digit with Ctrl, or from holding a key, does nothing', async ({page}) => {
        await selectItem(page, 0, topA);
        const tree = itemFrame(page, 0).locator('[role=treeitem][tabindex="0"]');
        await tree.dispatchEvent('keydown', {key: '2', ctrlKey: true, bubbles: true});
        await tree.dispatchEvent('keydown', {key: '2', repeat: true, bubbles: true});
        await page.waitForTimeout(100);
        await expectNode(page, 0, topA);
    });

    test('switched off, they work only in navigation mode, also after a reload', async ({page}) => {
        const numberKeys = page.getByRole('checkbox', {name: 'Number keys work on the whole page'});
        await page.getByText('Keyboard keys').click();
        await expect(numberKeys).toBeChecked();
        await numberKeys.uncheck();
        await page.reload();
        await waitForItems(page, 3);
        await page.getByText('Keyboard keys').click();
        await expect(numberKeys).not.toBeChecked();
        const duplicate = button(page, 'Duplicate query 1');
        await duplicate.focus();
        await page.keyboard.press('2');
        await page.waitForTimeout(100);
        await expect(duplicate).toBeFocused();
        await selectItem(page, 0, topA);
        await press(page, '2', 1, topB);
        await numberKeys.check();
        await duplicate.focus();
        await press(page, '3', 2, topC);
    });
});

test.describe('WORKSPACE Escape and Safari full screen', () => {
    /** Press Escape; was it cancelled (so that Safari stays in full screen)? */
    async function escapeIsCancelled(page: Page): Promise<boolean> {
        await page.evaluate(() => {
            const win = window as any;
            const isNew = !win.escapes;
            win.escapes = [];
            if (!isNew) {
                return; // already listening
            }
            const frames = [...document.querySelectorAll<HTMLIFrameElement>('#myList iframe')];
            [window, ...frames.map((frame) => frame.contentWindow!)].forEach((target) => {
                target.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        win.escapes.push(event.defaultPrevented);
                    }
                });
            });
        });
        await page.keyboard.press('Escape');
        await expect.poll(() => page.evaluate(() => (window as any).escapes.length)).toBe(1);
        return page.evaluate(() => (window as any).escapes[0]);
    }

    test('Escape is cancelled in the title, navigation mode, query box and scope edit', async ({page}) => {
        await openWorkspace(page, items);
        await titleField(page, 0).focus();
        expect(await escapeIsCancelled(page)).toBe(true);
        await expectNode(page, 0, topA);
        expect(await escapeIsCancelled(page)).toBe(true);
        await openBox(page, 'A');
        await expect(itemBox(page, 0)).toBeFocused();
        expect(await escapeIsCancelled(page)).toBe(true);
        await expectNode(page, 0, topA);
        await press(page, 'ArrowDown', 0, outer);
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toBeFocused();
        expect(await escapeIsCancelled(page)).toBe(true);
        await expectNode(page, 0, outer);
        expect(await escapeIsCancelled(page)).toBe(true);
    });

    test('Escape is cancelled in the open More menu, but not on a button', async ({page}) => {
        await openWorkspace(page, items);
        await page.setViewportSize({width: 800, height: 800});
        await button(page, 'More actions for query 1').focus();
        expect(await escapeIsCancelled(page)).toBe(false);
        await page.keyboard.press('Enter');
        expect(await escapeIsCancelled(page)).toBe(true);
        expect(await escapeIsCancelled(page)).toBe(false);
    });
});

test.describe('WORKSPACE keyboard navigation', () => {
    test.beforeEach(async ({page}) => {
        await openWorkspace(page, items);
        await selectItem(page, 0, topA);
    });

    test('K1. Traverse', async ({page}) => {
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowRight', 0, 'AND dd');
        await press(page, 'ArrowLeft', 0, outer);
        await press(page, 'ArrowUp', 0, topA);
        await press(page, 'ArrowUp', 0, topA);
    });

    test('K2. Nest', async ({page}) => {
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowDown', 0, 'aa OR');
        await press(page, 'ArrowRight', 0, inner);
        await press(page, 'ArrowDown', 0, 'bb AND cc');
        await press(page, 'ArrowDown', 0, 'bb AND cc');
        await press(page, 'ArrowUp', 0, inner);
        await press(page, 'ArrowUp', 0, outer);
        await press(page, 'ArrowUp', 0, topA);
    });

    test('K3. Next and previous item, also from a scope', async ({page}) => {
        await press(page, 'Alt+ArrowUp', 0, topA);
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'Alt+ArrowDown', 1, topB);
        await press(page, 'Alt+ArrowDown', 2, topC);
        await press(page, 'Alt+ArrowDown', 2, topC);
        await press(page, 'Alt+ArrowUp', 1, topB);
    });

    test('K4. Confirm a scope edit', async ({page}) => {
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowDown', 0, 'aa OR');
        await press(page, 'ArrowRight', 0, inner);
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toBeFocused();
        await dynamicInput(page, 0).fill('(bb AND ee)');
        await press(page, 'Enter', 0, '(bb AND ee)');
        const compact = (text: string) => normalise(text).replace(/ \)/g, ')').replace(/\( /g, '(');
        await expect.poll(async () => compact(await itemQuery(page, 0))).toBe('(aa OR (bb AND ee)) AND dd');
        await expect.poll(async () => compact((await linkQueries(page))[0])).toBe('(aa OR (bb AND ee)) AND dd');
        await expect.poll(() => page.evaluate(() => (window as any).eval('editMode'))).toBe(false);
    });

    test('editing a run keeps what is around it', async ({page}) => {
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowDown', 0, 'aa OR');
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toHaveValue('aa OR');
        await dynamicInput(page, 0).fill('ff AND');
        await press(page, 'Enter', 0, 'ff AND');
        await expect.poll(async () => normalise(await itemQuery(page, 0)).replace(/ \)/g, ')').replace(/\( /g, '('))
            .toBe('(ff AND (bb AND cc)) AND dd');
    });

    for (const key of ['Escape', 'Tab', 'Shift+Tab']) {
        test(`K5. Cancel a scope edit with ${key}`, async ({page}) => {
            await press(page, 'ArrowDown', 0, outer);
            await page.keyboard.press('Enter');
            await expect(dynamicInput(page, 0)).toBeFocused();
            await page.keyboard.type('zzz');
            await press(page, key, 0, outer);
            await expect(dynamicInput(page, 0)).toHaveCount(0);
            expect(await itemQuery(page, 0)).toBe(query);
            await expect.poll(() => page.evaluate(() => (window as any).eval('editMode'))).toBe(false);
        });

        test(`cancel an edit of the whole query with ${key}`, async ({page}) => {
            await page.keyboard.press('Enter');
            await expect(dynamicInput(page, 0)).toBeFocused();
            await page.keyboard.type('zzz');
            await press(page, key, 0, topA);
            await expect(dynamicInput(page, 0)).toHaveCount(0);
            expect(await itemQuery(page, 0)).toBe(query);
        });
    }

    test('after Tab cancelled an edit, the next Tab leaves the item', async ({page, browserName}) => {
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toBeFocused();
        await press(page, 'Tab', 0, topA);
        await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
        await expect(button(page, '+ Add query after 1')).toBeFocused();
    });

    test('Tab cancels an edit started with the mouse, and stays on its scope', async ({page}) => {
        const term = itemFrame(page, 0).locator('.term', {hasText: 'dd'});
        await term.hover();
        await term.click();
        await expect(dynamicInput(page, 0)).toBeVisible();
        await press(page, 'Tab', 0, 'AND dd');
        expect(await itemQuery(page, 0)).toBe(query);
    });

    test('12. Enter on an item edits its whole query', async ({page}) => {
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toBeFocused();
        expect(tidy(await dynamicInput(page, 0).inputValue())).toBe(query);
        await expect(itemBox(page, 0)).toBeHidden();
        await dynamicInput(page, 0).fill('xx OR (yy AND zz)');
        await press(page, 'Enter', 0, 'A: xx OR (yy AND zz)');
        await expect.poll(async () => tidy(await itemQuery(page, 0))).toBe('xx OR (yy AND zz)');
        await expect.poll(async () => tidy((await linkQueries(page))[0])).toBe('xx OR (yy AND zz)');
        await expect.poll(() => page.evaluate(() => (window as any).eval('editMode'))).toBe(false);
        await press(page, 'ArrowDown', 0, 'xx OR');
    });

    test('an invalid edit of the whole query alerts and stays open', async ({page}) => {
        const alerts = captureAlerts(page);
        await page.keyboard.press('Enter');
        await dynamicInput(page, 0).fill('(aa');
        await page.keyboard.press('Enter');
        await expect.poll(() => alerts.length).toBe(1);
        await expect(dynamicInput(page, 0)).toBeFocused();
        await press(page, 'Escape', 0, topA);
    });

    test('emptying the whole query selects the item, and Enter then goes to its query box', async ({page}) => {
        await page.keyboard.press('Enter');
        await dynamicInput(page, 0).fill('');
        await press(page, 'Enter', 0, 'A');
        await expect(itemBox(page, 0)).toBeVisible();
        await expect(itemFrame(page, 0).locator('html')).toHaveClass(/item-is-current/);
        await page.keyboard.press('Enter');
        await expect(itemBox(page, 0)).toBeFocused();
    });

    test('13. each way to select an item marks its whole query', async ({page}) => {
        const expectMarked = async (n: number) => {
            await expect(markers(page, n)).toHaveCount(1);
            await expect(itemFrame(page, n).locator('html')).not.toHaveClass(/item-is-current/);
        };
        await expectMarked(0); // Escape in the title
        await press(page, '2', 1, topB);
        await expectMarked(1);
        await expect(markers(page, 0)).toHaveCount(0);
        await press(page, 'Alt+ArrowUp', 0, topA);
        await expectMarked(0);
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowUp', 0, topA);
        await expectMarked(0);
        await itemFrame(page, 1).locator('body').click({position: {x: 2, y: 2}});
        // Not expectNode: after a click, Chromium and WebKit keep the iframe before it as the page's activeElement.
        await expect(itemFrame(page, 1).locator('[role=treeitem][tabindex="0"]')).toBeFocused();
        await expectMarked(1);
        await page.keyboard.press('1');
        await expectMarked(0);
        await expect(markers(page, 1)).toHaveCount(0);
        await press(page, 'ArrowDown', 0, outer);
    });

    test('a click on the border or an empty part of the visualisation selects the whole query', async ({page}) => {
        const target = itemFrame(page, 1).locator('#medsyntax-target1');
        const box = (await target.boundingBox())!;
        for (const position of [{x: box.width / 2, y: 1}, {x: 1, y: box.height / 2}, {x: box.width - 20, y: box.height / 2}]) {
            await titleField(page, 0).focus();
            await expect(markers(page, 1)).toHaveCount(0);
            await target.click({position});
            await expect(itemFrame(page, 1).locator('[role=treeitem][aria-level="1"]')).toBeFocused();
            await expect(markers(page, 1)).toHaveCount(1);
            await expect(dynamicInput(page, 1)).toHaveCount(0);
        }
    });

    test('a click on an empty part of the visualisation cancels a scope edit', async ({page}) => {
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toBeFocused();
        await page.keyboard.type('zzz');
        const target = itemFrame(page, 0).locator('#medsyntax-target1');
        await target.click({position: {x: 1, y: (await target.boundingBox())!.height / 2}});
        await expect(dynamicInput(page, 0)).toHaveCount(0);
        expect(await itemQuery(page, 0)).toBe(query);
        await expect(itemFrame(page, 0).locator('[role=treeitem][aria-level="1"]')).toBeFocused();
    });

    test('the box of a whole query is at its edges, with one box per line', async ({page}) => {
        const edges = await itemFrame(page, 0).locator('#search-string').evaluate((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
            return {left: Math.min(...rects.map((rect) => rect.left)), right: Math.max(...rects.map((rect) => rect.right))};
        });
        const marker = await markers(page, 0).evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {left: rect.left, right: rect.right};
        });
        expect(Math.abs(marker.left + 3 - edges.left)).toBeLessThan(6);
        expect(Math.abs(marker.right - 3 - edges.right)).toBeLessThan(6);

        await openWorkspace(page, [{title: 'L', query: Array.from({length: 120}, (_, n) => 'word' + n).join(' OR ')}]);
        await titleField(page, 0).focus();
        await page.keyboard.press('Escape');
        await expect(markers(page, 0).nth(1)).toBeVisible();
        const lines = await itemFrame(page, 0).locator('.term').evaluateAll((terms) =>
            new Set(terms.map((term) => Math.round(term.getBoundingClientRect().top))).size);
        expect(lines).toBeGreaterThan(1);
        await expect(markers(page, 0)).toHaveCount(lines);
    });

    test('14. Left and Right go down from the whole query', async ({page}) => {
        await press(page, 'ArrowRight', 0, outer);
        await press(page, 'ArrowUp', 0, topA);
        await press(page, 'ArrowLeft', 0, 'AND dd');
        await press(page, 'ArrowUp', 0, topA);
        await press(page, 'ArrowUp', 0, topA);
    });

    test('Left and Right go up where they cannot go further', async ({page}) => {
        await press(page, 'ArrowRight', 0, outer);
        await press(page, 'ArrowRight', 0, 'AND dd');
        await press(page, 'ArrowRight', 0, topA);
        await press(page, 'ArrowLeft', 0, 'AND dd');
        await press(page, 'ArrowLeft', 0, outer);
        await press(page, 'ArrowLeft', 0, topA);

        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowDown', 0, 'aa OR');
        await press(page, 'ArrowLeft', 0, outer);
        await press(page, 'ArrowDown', 0, 'aa OR');
        await press(page, 'ArrowRight', 0, inner);
        await press(page, 'ArrowRight', 0, outer);
        for (const key of ['ArrowLeft', 'ArrowRight']) { // the only scope inside its brackets
            await press(page, 'ArrowDown', 0, 'aa OR');
            await press(page, 'ArrowRight', 0, inner);
            await press(page, 'ArrowDown', 0, 'bb AND cc');
            await press(page, key, 0, inner);
            await press(page, 'ArrowUp', 0, outer);
        }
    });

    test('a query that is one scope has no second node with the same text', async ({page}) => {
        await openWorkspace(page, [{title: 'A', query: 'heart'}, {title: 'B', query: '(aa OR bb)'}, {title: 'C', query: ''}]);
        await selectItem(page, 0, 'A: heart');
        for (const key of ['ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            await press(page, key, 0, 'A: heart');
        }
        for (const key of ['ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            await selectItem(page, 1, 'B: (aa OR bb)');
            await press(page, key, 1, 'aa OR bb');
        }
        await press(page, 'ArrowUp', 1, 'B: (aa OR bb)');
        await selectItem(page, 2, 'C');
        for (const key of ['ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            await press(page, key, 2, 'C');
        }
        await page.keyboard.press('Enter');
        await expect(itemBox(page, 2)).toBeFocused();
    });

    test('T on a whole query goes to the title, and the label follows title and query', async ({page}) => {
        await page.keyboard.press('t');
        await expect(titleField(page, 0)).toBeFocused();
        await page.keyboard.press('End');
        await page.keyboard.type('x');
        await press(page, 'Escape', 0, 'Ax: ' + query);
        await openBox(page, 'Ax');
        await expect(itemBox(page, 0)).toBeFocused();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('lung');
        await press(page, 'Escape', 0, 'Ax: lung');
    });

    test('K6. After an edit that removes the scope, the nearest one is current', async ({page}) => {
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowDown', 0, 'aa OR');
        await press(page, 'ArrowRight', 0, inner);
        await page.keyboard.press('Enter');
        await dynamicInput(page, 0).fill('bb');
        await press(page, 'Enter', 0, 'aa OR bb');
    });

    test('K7. An invalid edit alerts and stays open', async ({page}) => {
        const alerts = captureAlerts(page);
        await press(page, 'ArrowDown', 0, outer);
        await page.keyboard.press('Enter');
        await dynamicInput(page, 0).fill('(bb AND cc');
        await page.keyboard.press('Enter');
        await expect.poll(() => alerts).toEqual(['( or ) bracket error: please fix before pressing Enter']);
        await expect(dynamicInput(page, 0)).toBeFocused();
        await press(page, 'Escape', 0, outer);
        expect(await itemQuery(page, 0)).toBe(query);
    });

    test('K8. A query with an error has no scopes', async ({page}) => {
        await press(page, 'Alt+ArrowDown', 1, topB);
        await openBox(page, 'B');
        await expect(itemBox(page, 1)).toBeFocused();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('(aa OR bb');
        await press(page, 'Escape', 1, 'B');
        await expect(itemFrame(page, 1).locator('html')).toHaveClass(/item-is-current/);
        for (const key of ['ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            await press(page, key, 1, 'B');
        }
        await page.keyboard.press('Enter');
        await expect(itemBox(page, 1)).toBeFocused();
        await press(page, 'Escape', 1, 'B');
        await press(page, 'Alt+ArrowDown', 2, topC);
    });

    test('K9. Keys in the text fields only edit text', async ({page}) => {
        await openBox(page, 'A');
        await expect(itemBox(page, 0)).toBeFocused();
        await page.keyboard.press('End');
        for (const key of ['ArrowUp', 'ArrowDown', 'Alt+ArrowDown', 't']) {
            await page.keyboard.press(key);
            await expect(itemBox(page, 0)).toBeFocused();
        }
        await expect.poll(() => itemQuery(page, 0)).toContain('t');
        await press(page, 'Escape', 0, topA + 't');
        await expect(itemBox(page, 0)).toBeHidden();

        await page.keyboard.press('t');
        await expect(titleField(page, 0)).toBeFocused();
        await page.keyboard.press('End');
        await page.keyboard.type('t');
        await press(page, 'Escape', 0, 'At: ' + query + 't');
    });

    test('K10. Remove: the focus is on the neighbour\'s Collapse button, and Tab reaches its tree', async ({page, browserName}) => {
        await button(page, 'Remove query 2').click();
        await expect(button(page, 'Collapse query 2')).toBeFocused();
        // Safari's Tab skips buttons; Option+Tab does not.
        const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
        for (let presses = 0; presses < 8 && await currentNode(page) === ''; presses++) {
            await page.keyboard.press(tab);
        }
        await expectNode(page, 1, topC);
    });

    test('the current node is marked, and only while the tree has the focus', async ({page}) => {
        const html = itemFrame(page, 0).locator('html');
        await expect(markers(page, 0)).toHaveCount(1);
        await press(page, 'ArrowDown', 0, outer);
        await expect(html).not.toHaveClass(/item-is-current/);
        await expect(markers(page, 0)).toHaveCount(1);
        const marker = (await markers(page, 0).boundingBox())!;
        const group = (await itemFrame(page, 0).locator('.brackets').first().boundingBox())!;
        expect(Math.abs(marker.x + 3 - group.x)).toBeLessThan(2);
        expect(Math.abs(marker.width - 6 - group.width)).toBeLessThan(2);

        await press(page, 'Alt+ArrowDown', 1, topB);
        await expect(markers(page, 0)).toHaveCount(0);
        await expect(markers(page, 1)).toHaveCount(1);
    });

    test('each tree is one Tab stop, named after its item', async ({page}) => {
        for (let n = 0; n < 3; n++) {
            await expect(itemFrame(page, n).getByRole('tree')).toHaveAttribute('aria-label', items[n].title);
            await expect(itemFrame(page, n).locator('[role=treeitem][tabindex="0"]')).toHaveCount(1);
        }
        await titleField(page, 0).fill('');
        await expect(itemFrame(page, 0).getByRole('tree')).toHaveAttribute('aria-label', 'Query 1');
        await expect(itemFrame(page, 0).locator('[role=treeitem]')).toHaveCount(6);
        await expect(itemFrame(page, 0).locator('[role=treeitem][aria-level="4"]')).toHaveAttribute('aria-label', 'bb AND cc');
    });

    test('Tab and Shift+Tab leave the item', async ({page, browserName}) => {
        const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
        for (let presses = 0; presses < 8 && !await button(page, '+ Add query after 1').evaluate((el) => el === document.activeElement); presses++) {
            await page.keyboard.press(tab);
        }
        await expect(button(page, '+ Add query after 1')).toBeFocused();
        await selectItem(page, 0, topA);
        await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
        await expect(button(page, 'Remove query 1')).toBeFocused();
    });

    test('Tab goes through the card buttons, and Clear query works with Enter', async ({page, browserName}) => {
        const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
        await button(page, 'Duplicate query 1').focus();
        for (const name of ['Edit query A', 'Copy query A', 'Clear query A']) {
            await page.keyboard.press(tab);
            await expect(button(page, name)).toBeFocused();
        }
        await page.keyboard.press('Enter');
        await expect(itemFrame(page, 0).locator('[role=treeitem]')).toHaveCount(1);
        await expect(button(page, 'Clear query A')).toBeFocused();
        await page.keyboard.press(tab);
        await expect(button(page, 'Remove query 1')).toBeFocused();
    });

    test('Escape in the title of a collapsed item expands it, and Escape while composing does nothing', async ({page}) => {
        await button(page, 'Collapse query 2').click();
        await titleField(page, 1).focus();
        await titleField(page, 1).dispatchEvent('keydown', {key: 'Escape', isComposing: true});
        await page.waitForTimeout(100);
        await expect(titleField(page, 1)).toBeFocused();
        await press(page, 'Escape', 1, topB);
        await expect(button(page, 'Collapse query 2')).toBeVisible();
    });

    test('the title comes before the card buttons, and arrow keys, Alt+Down and T stay in it', async ({page, browserName}) => {
        const title = titleField(page, 0);
        await title.focus();
        for (const key of ['ArrowDown', 'ArrowUp', 'Alt+ArrowDown', 't']) {
            await page.keyboard.press(key);
            await expect(title).toBeFocused();
        }
        await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab');
        await expect(button(page, 'Collapse query 1')).toBeFocused();
    });

    test('a key with Ctrl does nothing', async ({page}) => {
        await page.keyboard.press('Control+ArrowDown');
        await page.waitForTimeout(100);
        await expectNode(page, 0, topA);
    });

    test('navigating does not change the link', async ({page}) => {
        const link = page.url();
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'Alt+ArrowDown', 1, topB);
        expect(page.url()).toBe(link);
    });

    test('clicking a scope starts its edit with the mouse, and Enter confirms', async ({page}) => {
        const term = itemFrame(page, 0).locator('.term', {hasText: 'bb'});
        await term.hover();
        await term.click();
        await expect(dynamicInput(page, 0)).toBeVisible();
        await page.keyboard.press('Enter');
        await expect(dynamicInput(page, 0)).toHaveCount(0);
        await expect.poll(() => currentNode(page)).not.toBe('');
    });

    test('14. Move: the keys follow the new order', async ({page}) => {
        await button(page, 'Move down query 1').click();
        await waitForItems(page, 3);
        await selectItem(page, 0, topB);
        await press(page, 'Alt+ArrowDown', 1, topA);
        await press(page, 'ArrowDown', 1, outer);
    });

    test('15. Alt+Down expands a collapsed item, which stays expanded', async ({page}) => {
        await button(page, 'Collapse query 2').click();
        await selectItem(page, 0, topA);
        await press(page, 'Alt+ArrowDown', 1, topB);
        await expect(button(page, 'Collapse query 2')).toBeVisible();
        await press(page, 'Alt+ArrowDown', 2, topC);
        await expect(button(page, 'Collapse query 2')).toBeVisible();
    });

    test('16. After Add, Escape selects the new item', async ({page}) => {
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 4);
        await expect(titleField(page, 1)).toBeFocused();
        await press(page, 'Escape', 1, 'Query 2');
        await press(page, 'ArrowDown', 1, 'Query 2');
        await press(page, 'Alt+ArrowDown', 2, topB);
    });

    test('the keys do nothing in the More menu, and Tab goes through it and closes it', async ({page, browserName}) => {
        await page.setViewportSize({width: 800, height: 800});
        const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
        const more = button(page, 'More actions for query 1');
        await more.focus();
        await page.keyboard.press('Enter');
        await expect(more).toHaveAttribute('aria-expanded', 'true');
        for (const name of ['Duplicate query 1', 'Edit query A', 'Copy query A', 'Clear query A']) {
            await page.keyboard.press(tab);
            await expect(button(page, name)).toBeFocused();
            for (const key of ['ArrowDown', 'Alt+ArrowDown', 't']) {
                await page.keyboard.press(key);
                await expect(button(page, name)).toBeFocused();
            }
        }
        await page.keyboard.press(tab);
        await expect(button(page, 'Remove query 1')).toBeFocused();
        await expect(more).toHaveAttribute('aria-expanded', 'false');
        await more.focus();
        await page.keyboard.press('Space');
        await page.keyboard.press(tab);
        await page.keyboard.press('Escape');
        await expect(more).toBeFocused();
        await expect(more).toHaveAttribute('aria-expanded', 'false');
    });

    test('17. The keys do nothing on a card button', async ({page}) => {
        const duplicate = button(page, 'Duplicate query 1');
        await duplicate.focus();
        for (const key of ['ArrowDown', 'ArrowUp', 'Alt+ArrowDown', 't', 'Escape']) {
            await page.keyboard.press(key);
            await expect(duplicate).toBeFocused();
        }
    });

    test('the arrow keys change the colours, without moving through items', async ({page}) => {
        await page.getByRole('radio', {name: 'System', exact: true}).focus();
        for (const name of ['Light', 'Dark', 'Greyscale']) {
            await page.keyboard.press('ArrowRight');
            await expect(page.getByRole('radio', {name, exact: true})).toBeChecked();
            await expect(page.getByRole('radio', {name, exact: true})).toBeFocused();
            await expect(page.locator('html')).toHaveAttribute('data-theme', name.toLowerCase());
        }
    });

    test('the marker of an item or scope is dashes in the item colour on white with a glow, and takes no space', async ({page}) => {
        await openWorkspace(page, [{title: 'E', query: '(aa OR bb'}, {title: 'A', query}]);
        await selectItem(page, 0, 'E'); // no valid query: the item itself
        const lines = (selector: string, pseudo: string) => itemFrame(page, 0).locator(selector).evaluate((element, name) => {
            const style = getComputedStyle(element, name);
            return style.content === 'none' ? '' : [style.borderTopWidth, style.borderTopStyle, style.borderTopColor].join(' ');
        }, pseudo);
        const white = 'solid rgb(255, 255, 255)';
        const red = 'rgb(225, 42, 57)'; // the first item's colour
        const height = () => workspaceItem(page, 0).locator('iframe').evaluate((frame) => frame.offsetHeight);

        expect(await lines('body', '::before')).toBe('3px ' + white);
        expect(await itemFrame(page, 0).locator('body').evaluate((body) => {
            const style = getComputedStyle(body, '::after');
            return style.backgroundSize;
        })).toBe('100% 3px, 100% 3px, 3px 100%, 3px 100%');
        expect(await itemFrame(page, 0).locator('body').evaluate((body) => getComputedStyle(body, '::after').backgroundImage))
            .not.toContain('rgb(0, 0, 0)');
        const marked = await height();
        expect(await itemFrame(page, 0).locator('body').evaluate((body) => {
            body.getAnimations({subtree: true}).forEach((animation) => animation.finish());
            return getComputedStyle(body, '::before').boxShadow;
        })).toContain(red);
        // The marker is around the visualisation.
        const gaps = await itemFrame(page, 0).locator('body').evaluate((body) => {
            const style = getComputedStyle(body, '::after');
            const edge = (side: string) => parseFloat(style.getPropertyValue(side)) + 3;
            const box = document.getElementById('medsyntax-target1')!.getBoundingClientRect();
            return [box.top - edge('top'), box.left - edge('left'), window.innerWidth - edge('right') - box.right,
                window.innerHeight - edge('bottom') - box.bottom];
        });
        gaps.forEach((gap) => expect(gap).toBeGreaterThanOrEqual(-1));

        await titleField(page, 0).focus();
        expect(await height()).toBe(marked);

        await openWorkspace(page, items);
        const unmarked = await height();
        await selectItem(page, 0, topA);
        await press(page, 'ArrowDown', 0, outer);
        expect(await lines('body', '::before')).toBe('');
        expect(await lines('body', '::after')).toBe('');
        expect(await lines('.current-scope', '')).toBe('3px ' + white);
        expect(await lines('.current-scope', '::after')).toMatch(/^3px dashed /);
        expect(await itemFrame(page, 0).locator('.current-scope').evaluate((box) => {
            box.getAnimations().forEach((animation) => animation.finish());
            return getComputedStyle(box).boxShadow;
        })).toContain(red);

        await titleField(page, 0).focus();
        await expect(markers(page, 0)).toHaveCount(0);
        expect(await height()).toBe(unmarked);
    });
});

test.describe('WORKSPACE centering', () => {
    const eight = Array.from({length: 8}, (_, n) => ({title: 'T' + (n + 1), query: '(aa OR bb) AND cc'}));
    const top = (n: number) => `T${n}: (aa OR bb) AND cc`;

    /** Distance of the card's middle to the viewport's middle */
    const offCenter = (page: Page, n: number) => workspaceItem(page, n).locator('.card').evaluate((card) => {
        const rect = card.getBoundingClientRect();
        return Math.abs((rect.top + rect.bottom) / 2 - window.innerHeight / 2);
    });
    const expectCentered = (page: Page, n: number) => expect.poll(() => offCenter(page, n)).toBeLessThanOrEqual(2);
    const scroll = (page: Page) => page.evaluate(() => window.scrollY);

    test.beforeEach(async ({page}) => {
        await openWorkspace(page, eight);
        await page.waitForTimeout(600); // heights
    });

    test('a number, Alt+Down, Alt+Up, Escape in the title and Up center the card', async ({page}) => {
        await press(page, '4', 3, top(4));
        await expectCentered(page, 3);
        await press(page, 'Alt+ArrowDown', 4, top(5));
        await expectCentered(page, 4);
        await press(page, 'Alt+ArrowUp', 3, top(4));
        await expectCentered(page, 3);
        await titleField(page, 5).focus();
        await press(page, 'Escape', 5, top(6));
        await expectCentered(page, 5);
        await press(page, 'ArrowDown', 5, '(aa OR bb)');
        await page.waitForTimeout(600);
        await page.mouse.wheel(0, 150);
        await expect.poll(() => offCenter(page, 5)).toBeGreaterThan(50);
        await press(page, 'ArrowUp', 5, top(6));
        await expectCentered(page, 5);
    });

    test('Escape in the query box, and editing the whole query, center the card', async ({page}) => {
        await openBox(page, 'T4');
        await expect(itemBox(page, 3)).toBeFocused();
        await press(page, 'Escape', 3, top(4));
        await expect(itemBox(page, 3)).toBeHidden();
        await expectCentered(page, 3);
        await page.waitForTimeout(600);
        for (const key of ['Enter', 'Escape']) {
            await page.keyboard.press('Enter');
            await expect(dynamicInput(page, 3)).toBeFocused();
            await page.mouse.wheel(0, 150);
            await expect.poll(() => offCenter(page, 3)).toBeGreaterThan(50);
            await press(page, key, 3, top(4));
            await expectCentered(page, 3);
            await page.waitForTimeout(600);
        }
    });

    test('the first and last card are as near to the middle as the page can scroll', async ({page}) => {
        await press(page, '8', 7, top(8));
        await expect.poll(() => page.evaluate(() => Math.abs(
            document.documentElement.scrollHeight - window.innerHeight - window.scrollY))).toBeLessThanOrEqual(2);
        await press(page, '1', 0, top(1));
        await expect.poll(() => scroll(page)).toBe(0);
    });

    test('a collapsed card is centered after it expands', async ({page}) => {
        await button(page, 'Collapse query 4').click();
        await page.waitForTimeout(600);
        await press(page, '4', 3, top(4));
        await expect(button(page, 'Collapse query 4')).toBeVisible();
        await page.waitForTimeout(600);
        await expectCentered(page, 3);
    });

    test('a card taller than the viewport starts at its top', async ({page}) => {
        const long = {title: 'L', query: Array.from({length: 900}, (_, n) => 'word' + n).join(' OR ')};
        await page.setViewportSize({width: 1000, height: 400});
        await openWorkspace(page, [eight[0], eight[1], long, eight[2]]);
        await page.waitForTimeout(600);
        await page.keyboard.press('3');
        const card = workspaceItem(page, 2).locator('.card');
        expect(await card.evaluate((element) => element.offsetHeight > window.innerHeight)).toBe(true);
        await expect.poll(() => card.evaluate((element) => Math.abs(element.getBoundingClientRect().top)))
            .toBeLessThanOrEqual(2);
        await page.waitForTimeout(600);
        expect(await card.evaluate((element) => Math.abs(element.getBoundingClientRect().top))).toBeLessThanOrEqual(2);
    });

    test('moving through scopes and clicking a visible item do not scroll', async ({page}) => {
        await press(page, '4', 3, top(4));
        await expectCentered(page, 3);
        await page.waitForTimeout(600);
        const before = await scroll(page);
        await press(page, 'ArrowDown', 3, '(aa OR bb)');
        await press(page, 'ArrowRight', 3, 'AND cc');
        expect(await scroll(page)).toBe(before);
        await itemFrame(page, 4).locator('body').click({position: {x: 2, y: 2}});
        await expect(markers(page, 4)).toHaveCount(1);
        await page.waitForTimeout(200);
        expect(await scroll(page)).toBe(before);
    });

    test('the wheel stops the centering', async ({page}) => {
        await page.mouse.move(5, 5);
        await press(page, '4', 3, top(4));
        await expectCentered(page, 3);
        await page.waitForTimeout(200); // WebKit loses a wheel event during a scroll
        await page.mouse.wheel(0, 150);
        await expect.poll(() => offCenter(page, 3)).toBeGreaterThan(50);
        await page.evaluate(() => (window as any).eval('fitItem(items[3])'));
        expect(await offCenter(page, 3)).toBeGreaterThan(50);
    });
});

test.describe('WORKSPACE marker colours', () => {
    /** The red, green and blue of a colour as it is painted */
    const painted = (page: Page, n: number) => markers(page, n).first().evaluate((box) => {
        const context = document.createElement('canvas').getContext('2d', {willReadFrequently: true})!;
        context.fillStyle = getComputedStyle(box, '::after').borderTopColor;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    });
    const contrastWithWhite = (rgb: number[]) => {
        const [red, green, blue] = rgb.map((channel) => {
            const value = channel / 255;
            return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return 1.05 / (0.2126 * red + 0.7152 * green + 0.0722 * blue + 0.05);
    };

    test('the dashes have the colour of each item, darkened where it is too bright', async ({page}) => {
        await openWorkspace(page, Array.from({length: 10}, (_, n) => ({title: 'T' + (n + 1), query: 'heart'})));
        const colors = ['E12A39', 'FFB407', '89CA26', '7527A1', '1F6FD1', '17B8C9', 'F2760C', '7A4A2B', '5B6B7B', '14613B'];
        for (let n = 0; n < colors.length; n++) {
            await selectItem(page, n, `T${n + 1}: heart`);
            const item = [0, 2, 4].map((start) => parseInt(colors[n].slice(start, start + 2), 16));
            const dashes = await painted(page, n);
            const tooBright = contrastWithWhite(item) < 3;
            const difference = Math.max(...item.map((channel, index) => Math.abs(channel - dashes[index])));
            expect(contrastWithWhite(dashes), colors[n]).toBeGreaterThanOrEqual(3);
            if (tooBright) {
                expect(difference, colors[n]).toBeGreaterThan(10);
            } else {
                expect(difference, colors[n]).toBeLessThanOrEqual(2);
            }
        }
    });

    const pulse = (page: Page) => markers(page, 0).first().evaluate((box) => {
        const style = getComputedStyle(box);
        return {name: style.animationName, delay: parseFloat(style.animationDelay), running: box.getAnimations().length};
    });

    test('the glow pulses after a move, and a redraw does not start it again', async ({page}) => {
        await openWorkspace(page, items);
        await selectItem(page, 0, topA);
        await page.waitForTimeout(800);
        const start = Date.now();
        await press(page, 'ArrowDown', 0, outer);
        // Not at once: a box that is being replaced has no style.
        await expect.poll(async () => (await pulse(page)).name).toBe('marker-pulse');
        const first = await pulse(page);
        expect(first.delay * 1000).toBeGreaterThan(-(Date.now() - start) - 50);

        await page.waitForTimeout(800);
        await page.setViewportSize({width: 900, height: 900}); // draws it again
        await expect.poll(async () => (await pulse(page)).delay).toBeLessThan(-0.6);
        expect((await pulse(page)).running).toBe(0);
    });

    test('with reduced motion the glow does not pulse', async ({page}) => {
        await page.emulateMedia({reducedMotion: 'reduce'});
        await openWorkspace(page, items);
        await selectItem(page, 0, topA);
        expect((await pulse(page)).name).toBe('none');
        expect(await markers(page, 0).evaluate((box) => getComputedStyle(box).boxShadow)).toContain('rgb(225, 42, 57)');
        await openWorkspace(page, [{title: 'E', query: '(aa OR bb'}]);
        await selectItem(page, 0, 'E');
        expect(await itemFrame(page, 0).locator('body').evaluate((body) => getComputedStyle(body, '::before').animationName))
            .toBe('none');
    });
});
