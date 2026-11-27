// @ts-check
import {test, expect, type Page} from './base-test';
import {
    captureAlerts, enterItemQuery, enterItemTitle, enterQuery, itemBox, itemFrame, itemQuery, linkQueries, linkTitles,
    openItemBox, openWorkspace, removalPrompts, stableMiddle, titleField, waitForItems, workspaceItem, workspaceItems,
} from './helpers';

// WORKSPACE UX: product-development/workspace-ux.md. The numbers are its scenarios; 14-17 are in
// workspace-keyboard.spec.ts.

const A = {title: 'A', query: '(heart OR cardiac) AND lung'};
const B = {title: 'B', query: 'stroke NOT child*'};
const C = {title: 'C', query: '"myocardial infarction"[Mesh]'};

const button = (page: Page, name: string) => page.getByRole('button', {name, exact: true});
const titles = (page: Page) => workspaceItems(page).locator('.item-title')
    .evaluateAll((fields: HTMLInputElement[]) => fields.map((field) => field.value));
const visual = (page: Page, n: number) => itemFrame(page, n).locator('#medsyntax-target1');
const badge = (page: Page, n: number) => workspaceItem(page, n).locator('.badge');

const colors = ['rgb(225, 42, 57)', 'rgb(255, 180, 7)', 'rgb(137, 202, 38)', 'rgb(117, 39, 161)', 'rgb(31, 111, 209)',
    'rgb(23, 184, 201)', 'rgb(242, 118, 12)', 'rgb(122, 74, 43)', 'rgb(91, 107, 123)', 'rgb(20, 97, 59)'];

test.describe('WORKSPACE managing items', () => {
    test.beforeEach(async ({page}) => {
        await openWorkspace(page, [A, B, C]);
    });

    test('1. Add after an item: the new item is there, with its title focused', async ({page}) => {
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 4);
        await expect.poll(() => titles(page)).toEqual(['A', '', 'B', 'C']);
        await expect(titleField(page, 1)).toBeFocused();
        await expect(workspaceItem(page, 1)).toBeInViewport();
        await page.keyboard.type('New');
        await expect.poll(() => linkTitles(page)).toEqual(['A', 'New', 'B', 'C']);
    });

    test('a new item has its height from the start, so what is below it stays in place', async ({page}) => {
        await button(page, '+ Add query after 1').click();
        const below = await workspaceItem(page, 2).evaluate((item: HTMLElement) => item.offsetTop);
        await waitForItems(page, 4);
        await page.waitForTimeout(300);
        expect(Math.abs(await workspaceItem(page, 2).evaluate((item: HTMLElement) => item.offsetTop) - below)).toBeLessThan(5);
    });

    test('2. Remove and Undo: the item comes back in its place', async ({page}) => {
        await button(page, 'Remove query 2').click();
        await expect.poll(() => titles(page)).toEqual(['A', 'C']);
        await expect(page.getByText('Query 2 removed', {exact: true})).toBeVisible();
        await expect(page.getByRole('status')).toHaveText('Query 2 removed. Undo is available.');
        // Not on a Remove button: a second Enter must not remove more.
        await expect(button(page, 'Collapse query 2')).toBeFocused();

        await button(page, 'Undo').click();
        await waitForItems(page, 3);
        await expect.poll(() => titles(page)).toEqual(['A', 'B', 'C']);
        expect(await itemQuery(page, 1)).toBe(B.query);
        await expect.poll(() => linkQueries(page)).toEqual([A.query, B.query, C.query]);
        await expect(button(page, 'Undo')).toBeHidden();
        await expect(button(page, 'Collapse query 2')).toBeFocused();
    });

    for (const action of ['+ Add query after 1', 'Duplicate query 1', 'Move down query 1']) {
        test(`3. Undo expires with "${action}"`, async ({page}) => {
            await button(page, 'Remove query 2').click();
            await expect(button(page, 'Undo')).toBeVisible();
            await button(page, action).click();
            await expect(button(page, 'Undo')).toBeHidden();
        });
    }

    test('Undo after a second Remove restores only the second', async ({page}) => {
        await button(page, 'Remove query 1').click();
        await button(page, 'Remove query 1').click();
        await button(page, 'Undo').click();
        await expect.poll(() => titles(page)).toEqual(['B', 'C']);
    });

    test('4. Move: number, colour and link follow', async ({page}) => {
        await button(page, 'Move down query 1').click();
        await waitForItems(page, 3);
        await expect.poll(() => titles(page)).toEqual(['B', 'A', 'C']);
        await expect(badge(page, 1)).toHaveText('2');
        await expect(badge(page, 1)).toHaveCSS('background-color', colors[1]);
        await expect(titleField(page, 1)).toHaveValue('A');
        expect(await itemQuery(page, 1)).toBe(A.query);
        await expect.poll(() => linkQueries(page)).toEqual([B.query, A.query, C.query]);
        await expect(button(page, 'Move down query 2')).toBeFocused();

        // The item has the colour inside too.
        await expect(visual(page, 1)).toHaveCSS('border-top-color', colors[1]);
        // An edit in the moved item ends up in its new place.
        await enterItemQuery(page, 1, 'kidney');
        await expect.poll(() => linkQueries(page)).toEqual([B.query, 'kidney', C.query]);
    });

    test('Move to an edge focuses the opposite button', async ({page}) => {
        await button(page, 'Move up query 2').click();
        await expect.poll(() => titles(page)).toEqual(['B', 'A', 'C']);
        await expect(button(page, 'Move down query 1')).toBeFocused();
    });

    test('5. Up is disabled on the first item, Down on the last', async ({page}) => {
        await expect(button(page, 'Move up query 1')).toBeDisabled();
        await expect(button(page, 'Move down query 1')).toBeEnabled();
        await expect(button(page, 'Move up query 3')).toBeEnabled();
        await expect(button(page, 'Move down query 3')).toBeDisabled();
    });

    test('6. Duplicate: the copy is separate', async ({page}) => {
        await button(page, 'Duplicate query 1').click();
        await waitForItems(page, 4);
        await expect.poll(() => titles(page)).toEqual(['A', 'A', 'B', 'C']);
        await expect(titleField(page, 1)).toBeFocused();
        await enterItemQuery(page, 1, 'kidney');
        await expect.poll(() => linkQueries(page)).toEqual([A.query, 'kidney', B.query, C.query]);
        expect(await itemQuery(page, 0)).toBe(A.query);
    });

    test('an action right after typing keeps what was typed', async ({page}) => {
        await openItemBox(page, 0);
        await page.keyboard.press('End');
        await page.keyboard.type(' AND kidney');
        await button(page, 'Duplicate query 1').click();
        await expect.poll(() => linkQueries(page))
            .toEqual([A.query + ' AND kidney', A.query + ' AND kidney', B.query, C.query]);
    });

    test('7. Collapse: the header stays, and a reload expands', async ({page}) => {
        await button(page, 'Collapse query 1').click();
        await expect(workspaceItem(page, 0).locator('iframe')).toBeHidden();
        await expect(titleField(page, 0)).toHaveValue('A');
        await expect(button(page, 'Expand query 1')).toHaveAttribute('aria-expanded', 'false');
        expect(await linkQueries(page)).toEqual([A.query, B.query, C.query]);

        await button(page, 'Expand query 1').click();
        await expect(visual(page, 0)).toBeVisible();
        await expect.poll(() => workspaceItem(page, 0).locator('iframe').evaluate((frame: HTMLIFrameElement) =>
            Math.abs(frame.offsetHeight - frame.contentDocument!.body.offsetHeight))).toBeLessThan(10);

        await button(page, 'Collapse query 1').click();
        await page.reload();
        await waitForItems(page, 3);
        await expect(button(page, 'Collapse query 1')).toHaveAttribute('aria-expanded', 'true');
    });

    test('8. Remove all: one clear item is left, also after a reload', async ({page}) => {
        for (let n = 0; n < 3; n++) {
            await button(page, 'Remove query 1').click();
        }
        await waitForItems(page, 1);
        await expect.poll(() => titles(page)).toEqual(['']);
        await expect(button(page, 'Remove query 1')).toBeDisabled();
        await expect(titleField(page, 0)).toBeFocused();
        await page.reload();
        await waitForItems(page, 1);
        await expect.poll(() => titles(page)).toEqual(['']);
        await page.goto('/workspace/');
        await waitForItems(page, 1);
    });

    test('9. Undo of the last removal replaces the clear item', async ({page}) => {
        for (let n = 0; n < 3; n++) {
            await button(page, 'Remove query 1').click();
        }
        await button(page, 'Undo').click();
        await waitForItems(page, 1);
        await expect.poll(() => titles(page)).toEqual(['C']);
    });

    test('9. Undo of the last removal keeps what was typed in the clear item', async ({page}) => {
        for (let n = 0; n < 3; n++) {
            await button(page, 'Remove query 1').click();
        }
        await waitForItems(page, 1);
        await enterItemTitle(page, 0, 'Typed');
        await button(page, 'Undo').click();
        await waitForItems(page, 2);
        await expect.poll(() => titles(page)).toEqual(['C', 'Typed']);
    });

    test('10. Reload keeps numbers, colours, titles and queries', async ({page}) => {
        await page.reload();
        await waitForItems(page, 3);
        await expect.poll(() => titles(page)).toEqual(['A', 'B', 'C']);
        for (let n = 0; n < 3; n++) {
            await expect(badge(page, n)).toHaveText(String(n + 1));
            await expect(badge(page, n)).toHaveCSS('background-color', colors[n]);
        }
        expect(await linkQueries(page)).toEqual([A.query, B.query, C.query]);
    });

    test('11. Reload deletes clear items, and only those', async ({page}) => {
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 4);
        await enterItemTitle(page, 1, '   ');
        await button(page, 'Clear query C').click();
        await expect.poll(() => linkQueries(page)).toEqual([A.query, '', B.query, '']);
        await page.reload();
        await waitForItems(page, 3);
        await expect.poll(() => titles(page)).toEqual(['A', 'B', 'C']);
        await expect.poll(() => linkQueries(page)).toEqual([A.query, B.query, '']);
    });

    test('12. Reload with only clear items leaves one', async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 2);
        await button(page, '+ Add query after 2').click();
        await waitForItems(page, 3);
        await page.reload();
        await waitForItems(page, 1);
        await expect.poll(() => linkQueries(page)).toEqual(['']);
    });

    test('13. An unfinished edit in another item stays open', async ({page}) => {
        const term = visual(page, 2).locator('.quote-term');
        await term.hover();
        await term.click();
        await expect(itemFrame(page, 2).locator('#dynamic-input')).toBeVisible();
        await button(page, 'Move down query 1').click();
        await expect.poll(() => titles(page)).toEqual(['B', 'A', 'C']);
        await expect(itemFrame(page, 2).locator('#dynamic-input')).toBeVisible();
        await button(page, 'Remove query 1').click();
        await expect(itemFrame(page, 1).locator('#dynamic-input')).toBeVisible();
        await button(page, 'Duplicate query 1').click();
        await expect(itemFrame(page, 2).locator('#dynamic-input')).toBeVisible();
    });

    test('actions and edits add nothing to the browser history', async ({page}) => {
        const before = await page.evaluate(() => history.length);
        await enterItemQuery(page, 0, 'kidney');
        await button(page, 'Duplicate query 1').click();
        await button(page, 'Remove query 1').click();
        await expect.poll(() => linkQueries(page)).toEqual(['kidney', B.query, C.query]);
        expect(await page.evaluate(() => history.length)).toBe(before);
    });

    test('Remove asks first: Cancel keeps the item, OK removes it', async ({page}) => {
        const prompts = removalPrompts(page);
        prompts.accept = false;
        await button(page, 'Remove query 2').click();
        await expect.poll(() => prompts.messages).toEqual(['Remove query 2 "B"?']);
        expect(await titles(page)).toEqual(['A', 'B', 'C']);
        prompts.accept = true;
        await button(page, 'Remove query 2').click();
        await waitForItems(page, 2);
        expect(await titles(page)).toEqual(['A', 'C']);
        expect(prompts.messages).toHaveLength(2);
    });

    test('Remove does not ask for an item without title and query, and names an item by number without a title', async ({page}) => {
        const prompts = removalPrompts(page);
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 4);
        await button(page, 'Remove query 2').click();
        await waitForItems(page, 3);
        expect(prompts.messages).toEqual([]);
        await enterItemTitle(page, 2, '');
        await button(page, 'Remove query 3').click();
        await expect.poll(() => prompts.messages).toEqual(['Remove query 3?']);
    });

    test('New workspace opens an empty WORKSPACE in a new tab', async ({page, context}) => {
        const link = page.getByRole('link', {name: 'New workspace (opens in a new tab)'});
        const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
        await waitForItems(tab, 1);
        expect(new URL(tab.url()).pathname).toBe('/workspace/');
        expect(await titles(tab)).toEqual(['']);
        expect(await titles(page)).toEqual(['A', 'B', 'C']);
    });

    test('Add query is in the button row, before Remove, also while it is collapsed', async ({page}) => {
        const add = button(page, '+ Add query after 1');
        await button(page, 'Collapse query 1').click();
        await expect(workspaceItem(page, 0).locator('.actions .btn:visible').nth(-2)).toHaveAccessibleName('+ Add query after 1');
        const remove = (await button(page, 'Remove query 1').boundingBox())!;
        expect(Math.abs((await add.boundingBox())!.y - remove.y)).toBeLessThan(2);
        await add.click();
        await waitForItems(page, 4);
        expect(await titles(page)).toEqual(['A', '', 'B', 'C']);
    });

    test('iframes and buttons are named after their item', async ({page}) => {
        for (let n = 1; n <= 3; n++) {
            await expect(workspaceItem(page, n - 1).locator('iframe')).toHaveAttribute('aria-label', 'Editor of query ' + n);
            for (const name of ['Collapse', 'Move up', 'Move down', 'Duplicate', 'Remove']) {
                await expect(button(page, `${name} query ${n}`)).toBeVisible();
            }
        }
    });
});

test.describe('WORKSPACE title', () => {
    test.beforeEach(async ({page}) => {
        await openWorkspace(page, [A, B, C]);
    });

    const clearName = (page: Page, n: number) => workspaceItem(page, n).locator('[data-part=clear]');
    const tree = (page: Page, n: number) => itemFrame(page, n).getByRole('tree', {includeHidden: true});

    test('23. it is in the card header, and the item shows no title field of its own', async ({page}) => {
        await expect(page.getByRole('textbox', {name: 'Title of query 2'})).toHaveValue('B');
        await expect(itemFrame(page, 1).locator('#query-title1')).toBeHidden();
        await button(page, 'Move up query 2').click();
        await expect(page.getByRole('textbox', {name: 'Title of query 1'})).toHaveValue('B');
    });

    test('typing fast goes into the link, the button name and the tree label', async ({page}) => {
        const title = 'Population "<b>&é 100% + 日本 #1';
        await titleField(page, 1).fill('');
        await titleField(page, 1).pressSequentially(title);
        await expect(titleField(page, 1)).toHaveValue(title);
        await expect.poll(() => linkTitles(page)).toEqual(['A', title, 'C']);
        await expect(clearName(page, 1)).toHaveAccessibleName('Clear query ' + title);
        await expect(tree(page, 1)).toHaveAttribute('aria-label', title);
        await page.reload();
        await waitForItems(page, 3);
        expect(await titles(page)).toEqual(['A', title, 'C']);
        await expect.poll(() => linkTitles(page)).toEqual(['A', title, 'C']);
        await enterItemTitle(page, 1, '');
        await expect(tree(page, 1)).toHaveAttribute('aria-label', 'Query 2');
    });

    test('an action right after typing keeps the title', async ({page}) => {
        await page.evaluate(() => {
            const field = document.querySelectorAll('.item-title')[0] as HTMLInputElement;
            field.value = 'New';
            field.dispatchEvent(new Event('input'));
            (document.querySelector('[data-part=duplicate]') as HTMLElement).click();
            (document.querySelectorAll('[data-part=down]')[0] as HTMLElement).click();
        });
        await expect.poll(() => linkTitles(page)).toEqual(['New', 'New', 'B', 'C']);
        await enterItemTitle(page, 2, 'Gone');
        await button(page, 'Remove query 3').click();
        await button(page, 'Undo').click();
        await waitForItems(page, 4);
        await expect.poll(() => linkTitles(page)).toEqual(['New', 'New', 'Gone', 'C']);
        await page.waitForTimeout(300);
        expect(await titles(page)).toEqual(['New', 'New', 'Gone', 'C']);
        expect(await linkQueries(page)).toEqual([A.query, A.query, B.query, C.query]);
    });

    test('a title typed while the item loads is kept', async ({page}) => {
        await page.evaluate(() => {
            (document.querySelector('[data-part=add]') as HTMLElement).click();
            const field = document.querySelectorAll('.item-title')[1] as HTMLInputElement;
            field.value = 'Early';
            field.dispatchEvent(new Event('input'));
        });
        await waitForItems(page, 4);
        await expect(tree(page, 1)).toHaveAttribute('aria-label', 'Early');
        await page.waitForTimeout(300);
        expect(await titles(page)).toEqual(['A', 'Early', 'B', 'C']);
        expect(await linkTitles(page)).toEqual(['A', 'Early', 'B', 'C']);
    });

    test('title and query edited one after the other both stay', async ({page}) => {
        await enterItemTitle(page, 0, 'T1');
        await enterItemQuery(page, 0, 'kidney');
        await enterItemTitle(page, 0, 'T2');
        await expect.poll(() => linkTitles(page)).toEqual(['T2', 'B', 'C']);
        expect(await linkQueries(page)).toEqual(['kidney', B.query, C.query]);
    });

    test('24. collapsed: it can be edited, and without a title it shows the query as placeholder', async ({page}) => {
        await button(page, 'Collapse query 2').click();
        await enterItemTitle(page, 1, 'Collapsed');
        await expect.poll(() => linkTitles(page)).toEqual(['A', 'Collapsed', 'C']);
        await enterItemTitle(page, 1, '');
        await expect(titleField(page, 1)).toHaveAttribute('placeholder', B.query);
        await button(page, 'Clear query 2').click();
        await expect(titleField(page, 1)).toHaveAttribute('placeholder', 'Empty query');
        await button(page, 'Expand query 2').click();
        await expect(titleField(page, 1)).toHaveAttribute('placeholder', 'Please input a title for your query here...');
    });

    test('its focus puts the WORKSPACE in edit mode', async ({page}) => {
        await titleField(page, 0).focus();
        expect(await page.evaluate('editMode')).toBe(true);
        await titleField(page, 0).blur();
        expect(await page.evaluate('editMode')).toBe(false);
    });
});

test.describe('WORKSPACE example', () => {
    const example = [
        ['P (Population/Problem)', 'handover OR "Patient Handoff"[Mesh] OR handoff OR "patient transfer"'],
        ['I (Intervention)', 'SBAR OR ISBAR OR SBAR-R OR ISBARR OR ISOBAR'],
        ['C (Comparison/Control)', ''],
        ['O (Outcome)', 'teamwork OR "inter-professional communication" OR ("communication"[Mesh] OR communication OR ("Interdisciplinary Communication"[Mesh] AND ("Patient Safety"[Mesh] OR "patient safety" OR "safety culture")))'],
    ];
    const show = (page: Page) => button(page, 'Show example');

    test.beforeEach(async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
    });

    test('25. it puts the four PICO items in place of the clear one, also after a reload', async ({page}) => {
        await show(page).click();
        await waitForItems(page, 4);
        await expect(page.locator('body')).toBeFocused();
        await expect(page.locator('#workspace-status')).toHaveText('Example added: 4 queries');
        await expect(show(page)).toBeHidden();
        for (const reload of [false, true]) {
            if (reload) {
                await page.reload();
                await waitForItems(page, 4);
            }
            await expect.poll(() => linkQueries(page)).toEqual(example.map(([, query]) => query));
            expect(await linkTitles(page)).toEqual(example.map(([title]) => title));
            for (let n = 0; n < 4; n++) {
                await expect(titleField(page, n)).toHaveValue(example[n][0]);
                expect(await itemQuery(page, n)).toBe(example[n][1]);
                await expect(badge(page, n)).toHaveCSS('background-color', colors[n]);
                await expect(itemFrame(page, n).locator('.warning-medsyntax:visible')).toHaveCount(0);
            }
        }
        await expect(show(page)).toBeHidden();
    });

    test('it replaces several clear items, and a double click adds four', async ({page}) => {
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 2);
        await show(page).dblclick();
        await waitForItems(page, 4);
    });

    test('it shows only while every item is clear', async ({page}) => {
        removalPrompts(page);
        await enterItemTitle(page, 0, 'x');
        await expect(show(page)).toBeHidden();
        await enterItemTitle(page, 0, '  ');
        await expect(show(page)).toBeVisible();
        await openItemBox(page, 0);
        await page.keyboard.type('heart');
        await expect(show(page)).toBeHidden();
        await button(page, 'Remove query 1').click();
        await expect(show(page)).toBeVisible();
        await show(page).click();
        await waitForItems(page, 4);
        await expect(page.locator('#undo-toast')).toBeHidden();
    });

    test('items have no demo button of their own', async ({page}) => {
        await expect(itemFrame(page, 0).locator('#demo-button')).toBeHidden();
        await page.goto('/index.html');
        await expect(page.locator('#demo-button')).toBeVisible();
    });
});

test.describe('WORKSPACE Clear query', () => {
    const status = (page: Page) => page.locator('#workspace-status');

    test.beforeEach(async ({page}) => {
        await openWorkspace(page, [A, B, C]);
    });

    test('22. it clears the query, and keeps the title and the other items', async ({page}) => {
        await button(page, 'Clear query B').click();
        await expect.poll(() => linkQueries(page)).toEqual([A.query, '', C.query]);
        expect(await linkTitles(page)).toEqual(['A', 'B', 'C']);
        await expect(itemBox(page, 1)).toHaveValue('');
        await expect(button(page, 'Clear query B')).toBeFocused();
        await expect(status(page)).toHaveText('Query B cleared');
        await page.reload();
        await waitForItems(page, 3);
        await expect.poll(() => linkQueries(page)).toEqual([A.query, '', C.query]);
    });

    test('it is just before + Add query and Remove, and the item has no clear button of its own', async ({page}) => {
        expect(await workspaceItem(page, 0).locator('.actions button:visible').evaluateAll(
            (all) => all.map((b) => (b as HTMLElement).dataset.tip))).toEqual(
            ['Collapse', 'Move up', 'Move down', 'Duplicate', 'Edit query', 'Copy query', 'Clear query', 'Add query after', 'Remove']);
        await expect(itemFrame(page, 0).locator('#clear-button')).toBeHidden();
    });

    test('it is named after the title, or the number without one', async ({page}) => {
        const clear = (n: number) => workspaceItem(page, n).locator('[data-part=clear]');
        await expect(clear(1)).toHaveAccessibleName('Clear query B');
        await titleField(page, 1).focus();
        await page.keyboard.press('End');
        await page.keyboard.type('x');
        await expect(clear(1)).toHaveAccessibleName('Clear query Bx');
        await enterItemTitle(page, 1, '  ');
        await expect(clear(1)).toHaveAccessibleName('Clear query 2');
        await button(page, 'Move up query 2').click();
        await expect(clear(0)).toHaveAccessibleName('Clear query 1');
        await expect(clear(1)).toHaveAccessibleName('Clear query A');
        await clear(0).click();
        await expect(status(page)).toHaveText('Query 1 cleared');
    });

    test('it works on a collapsed item', async ({page}) => {
        await button(page, 'Collapse query 1').click();
        await button(page, 'Clear query A').click();
        await expect.poll(() => linkQueries(page)).toEqual(['', B.query, C.query]);
        await button(page, 'Expand query 1').click();
        await expect(itemBox(page, 0)).toBeVisible();
    });

    test('it works while typing in the query box', async ({page}) => {
        await openItemBox(page, 0);
        await page.keyboard.type('kidney ');
        await button(page, 'Clear query A').click();
        await expect.poll(() => linkQueries(page)).toEqual(['', B.query, C.query]);
        await page.waitForTimeout(1000);
        expect(await linkQueries(page)).toEqual(['', B.query, C.query]);
        await enterItemQuery(page, 0, 'kidney');
        await expect(visual(page, 0)).toHaveText('kidney');
    });

    test('it drops an unfinished scope edit, only in that item', async ({page}) => {
        for (const n of [1, 2]) {
            const term = visual(page, n).locator(n === 1 ? '.term' : '.quote-term').first();
            await term.hover();
            await term.click();
            await expect(itemFrame(page, n).locator('#dynamic-input')).toBeVisible();
        }
        await button(page, 'Clear query C').click();
        await expect(itemFrame(page, 2).locator('#dynamic-input')).toHaveCount(0);
        await expect.poll(() => page.evaluate('editMode')).toBe(false);
        await expect(itemFrame(page, 1).locator('#dynamic-input')).toBeVisible();
        await enterItemQuery(page, 2, 'kidney');
        await expect(visual(page, 2)).toHaveText('kidney');
    });

    test('Undo of a removal stays available', async ({page}) => {
        await button(page, 'Remove query 1').click();
        await button(page, 'Clear query B').click();
        await button(page, 'Undo').click();
        await expect.poll(() => linkQueries(page)).toEqual([A.query, '', C.query]);
    });

    test('it works on an item that is still loading', async ({page}) => {
        await page.evaluate(() => {
            (document.querySelector('[data-part=down]') as HTMLElement).click();
            (document.querySelectorAll('[data-part=clear]')[1] as HTMLElement).click();
        });
        await expect.poll(() => linkQueries(page)).toEqual([B.query, '', C.query]);
        expect(await linkTitles(page)).toEqual(['B', 'A', 'C']);
    });
});

test.describe('WORKSPACE Edit, Copy and the icon buttons', () => {
    const D = {title: 'D', query: '"a b"[tiab] AND x*'};
    const status = (page: Page) => page.locator('#workspace-status');
    const copied = (page: Page) => page.evaluate(() => (window as any).copied);
    const shown = (page: Page) => workspaceItem(page, 0).locator('.actions button:visible');
    // Whether the tooltip of a card button (its ::after) shows.
    const tipShown = (page: Page, name: string) => button(page, name)
        .evaluate((element) => getComputedStyle(element, '::after').visibility === 'visible');

    test.beforeEach(async ({page}) => {
        await page.addInitScript(() => {
            (window as any).copied = [];
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {writeText: (text: string) => {
                    if ((window as any).refuse) {
                        return Promise.reject(new Error('refused'));
                    }
                    (window as any).copied.push(text);
                    return Promise.resolve();
                }},
            });
        });
        await openWorkspace(page, [A, B, D]);
    });

    test('26. every button is an icon with its text in a tooltip, in the row at any width', async ({page}) => {
        const tips = ['Collapse', 'Move up', 'Move down', 'Duplicate', 'Edit query', 'Copy query', 'Clear query',
            'Add query after', 'Remove'];
        for (const width of [1920, 1140, 800, 640, 375]) {
            await page.setViewportSize({width, height: 900});
            expect(await shown(page).evaluateAll((all) => all.map((b) => (b as HTMLElement).dataset.tip))).toEqual(tips);
            expect(await shown(page).evaluateAll((all) => all.every((b) => b.textContent!.trim() === ''))).toBe(true);
            // A narrow card wraps between groups, never inside one.
            const groupTops = await workspaceItem(page, 0).locator('.button-group').evaluateAll((groups) => groups.map(
                (group) => new Set([...group.querySelectorAll('button')].filter((b) => !(b as HTMLElement).hidden).map((b) => Math.round(b.getBoundingClientRect().top))).size));
            expect(groupTops).toEqual([1, 1, 1]);
            const tops = await shown(page).evaluateAll((all) => [...new Set(all.map((b) => Math.round(b.getBoundingClientRect().top)))]);
            if (width >= 800) {
                expect(tops.length).toBe(1);
                const title = (await titleField(page, 0).boundingBox())!;
                expect(Math.abs(tops[0] - title.y)).toBeLessThan(6);
                expect(title.width).toBeGreaterThan(190);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        }
    });

    test('items have no Edit or Copy buttons of their own', async ({page}) => {
        await expect(itemFrame(page, 0).locator('button:visible')).toHaveCount(0);
        await page.goto('/index.html');
        await expect(page.locator('#copy-query-button')).toBeVisible();
    });

    test('Edit and Copy are named after the title, or the number without one', async ({page}) => {
        await enterItemTitle(page, 0, 'New');
        await expect(button(page, 'Edit query New')).toBeVisible();
        await enterItemTitle(page, 0, '');
        await expect(button(page, 'Edit query 1')).toBeVisible();
        await expect(button(page, 'Copy query 1')).toBeVisible();
    });

    test('Edit opens the box: also when it is open, collapsed, or still loading', async ({page}) => {
        for (let turn = 0; turn < 2; turn++) {
            await button(page, 'Edit query A').click();
            await expect(itemBox(page, 0)).toBeFocused();
            await page.waitForTimeout(300);
            await expect(itemBox(page, 0)).toBeFocused();
        }
        await button(page, 'Collapse query 2').click();
        await button(page, 'Edit query B').click();
        await expect(itemBox(page, 1)).toBeFocused();
        await expect(button(page, 'Collapse query 2')).toBeVisible();
        await page.evaluate(() => {
            (document.querySelectorAll('[data-part=down]')[0] as HTMLElement).click();
            (document.querySelectorAll('[data-part=edit]')[1] as HTMLElement).click();
        });
        await expect(titleField(page, 1)).toHaveValue('A');
        await expect(itemBox(page, 1)).toBeFocused();
    });

    test('27. Copy copies the query and says so for a moment', async ({page}) => {
        const copy = button(page, 'Copy query D');
        await copy.click();
        await expect(copy).toHaveAttribute('data-tip', 'Copied');
        await expect(copy.locator('.icon')).toHaveAttribute('data-icon', 'check');
        expect(await tipShown(page, 'Copy query D')).toBe(true);
        await expect(status(page)).toHaveText('Query D: copied');
        expect(await copied(page)).toEqual([D.query]);
        await expect(copy).toBeFocused();
        await expect(copy).toHaveAttribute('data-tip', 'Copy query', {timeout: 4000});
        await expect(copy.locator('.icon')).toHaveAttribute('data-icon', 'copy');
        await page.evaluate(() => { (window as any).refuse = true; });
        await copy.click();
        await expect(copy).toHaveAttribute('data-tip', 'Not copied');
        await expect(copy.locator('.icon')).toHaveAttribute('data-icon', 'x');
        await expect(status(page)).toHaveText('Query D: not copied');
    });

    test('Copy: just typed, collapsed, and loading; disabled without a query', async ({page}) => {
        await openItemBox(page, 1);
        await page.keyboard.press('End');
        await page.keyboard.type(' AND kidney');
        await button(page, 'Copy query B').click();
        await expect.poll(() => copied(page)).toEqual([B.query + ' AND kidney']);
        await button(page, 'Collapse query 3').click();
        await button(page, 'Copy query D').click();
        await expect.poll(async () => (await copied(page)).length).toBe(2);
        await page.evaluate(() => {
            (document.querySelectorAll('[data-part=down]')[0] as HTMLElement).click();
            (document.querySelectorAll('[data-part=copy]')[1] as HTMLElement).click();
        });
        await expect.poll(async () => (await copied(page)).slice(1)).toEqual([D.query, A.query]);
        await waitForItems(page, 3);
        await button(page, 'Clear query A').click();
        await expect(button(page, 'Copy query A')).toBeDisabled();
        await openItemBox(page, 1);
        await page.keyboard.type('x');
        await expect(button(page, 'Copy query A')).toBeEnabled();
    });

    test('29. a tooltip shows on hover and keyboard focus; Escape hides it until the pointer moves', async ({page}) => {
        expect(await tipShown(page, 'Duplicate query 1')).toBe(false);
        await button(page, 'Duplicate query 1').hover();
        expect(await tipShown(page, 'Duplicate query 1')).toBe(true);
        await page.keyboard.press('Escape');
        expect(await tipShown(page, 'Duplicate query 1')).toBe(false);
        await page.mouse.move(5, 5);
        await button(page, 'Edit query A').hover();
        expect(await tipShown(page, 'Edit query A')).toBe(true);
        await page.mouse.move(5, 5);
        await button(page, 'Clear query B').focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(button(page, 'Clear query B')).toBeFocused();
        expect(await tipShown(page, 'Clear query B')).toBe(true);
    });

    test('the tooltips of the last buttons stay on the screen at 375px', async ({page}) => {
        await page.setViewportSize({width: 375, height: 812});
        for (const name of ['Remove query 1', '+ Add query after 3', 'Remove query 3']) {
            await button(page, name).hover();
            expect(await tipShown(page, name)).toBe(true);
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
        }
    });
});

test.describe('WORKSPACE links', () => {
    test('an old link with clear items and leading "&" opens', async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
        const link = await page.evaluate(() => {
            const pack = (window as any).LZString.compressToEncodedURIComponent;
            return ['', '&querytitle=Q&query=' + pack('heart'), '', 'querytitle=Q&query=' + pack('lung')]
                .map((value, n) => `00000000${n}iframequery=` + pack(value)).join('&');
        });
        await page.goto('/workspace/?' + link);
        await waitForItems(page, 2);
        expect(await itemQuery(page, 0)).toBe('heart');
        expect(await itemQuery(page, 1)).toBe('lung');
        await expect.poll(() => linkQueries(page)).toEqual(['heart', 'lung']);
    });

    test('an alert in an item is shown', async ({page}) => {
        const alerts = captureAlerts(page);
        await page.goto('/workspace/');
        await waitForItems(page, 1);
        await enterItemQuery(page, 0, '“heart”');
        await expect.poll(() => alerts.length).toBe(1);
    });
});

test.describe('WORKSPACE query box', () => {
    test('18. the box hides when it is left, and a click still reaches its target', async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
        await openItemBox(page, 0);
        await page.keyboard.type('(heart OR lung)');
        await expect(itemBox(page, 0)).toBeVisible();
        await expect(visual(page, 0)).toHaveText('(heart OR lung)');

        // A slow click on a button below the box.
        const add = await stableMiddle(page, button(page, '+ Add query after 1'));
        await page.mouse.move(add.x, add.y);
        await page.mouse.down();
        await page.waitForTimeout(400);
        await expect(itemBox(page, 0)).toBeVisible();
        await page.mouse.up();
        await waitForItems(page, 2);
        await expect(itemBox(page, 0)).toBeHidden();
        await expect(visual(page, 0)).toBeVisible();
        await expect(itemBox(page, 1)).toBeVisible();

        await button(page, 'Edit query 1').click();
        await expect(itemBox(page, 0)).toBeFocused();
        await expect(visual(page, 0)).toBeVisible();
        await page.keyboard.press('End');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Tab');
        await expect(itemFrame(page, 0).locator('#warning-bracket-open')).toBeVisible();
        await page.waitForTimeout(200);
        await expect(itemBox(page, 0)).toBeVisible();
    });

    test('a slow click in an item below reaches its target', async ({page}) => {
        await openWorkspace(page, [A, B]);
        await openItemBox(page, 0);
        const edit = await stableMiddle(page, button(page, 'Edit query B'));
        await page.mouse.move(edit.x, edit.y);
        await page.mouse.down();
        await page.waitForTimeout(400);
        await page.mouse.up();
        await expect(itemBox(page, 1)).toBeFocused();
        await expect(itemBox(page, 0)).toBeHidden();
    });

    test('clearing the query shows the box', async ({page}) => {
        await openWorkspace(page, [A]);
        await expect(itemBox(page, 0)).toBeHidden();
        await button(page, 'Clear query A').click();
        await expect(itemBox(page, 0)).toBeVisible();
        await expect(visual(page, 0)).toBeHidden();
    });
});

test.describe('WORKSPACE style', () => {
    test('header with its links', async ({page}) => {
        await page.goto('/workspace/');
        await expect(page.getByRole('heading', {level: 1})).toHaveText('MedSyntaxMulti');
        await expect(page.getByText('Workspace for multiline searches')).toBeVisible();
        await expect(page.getByRole('link', {name: 'MedSyntax Editor'})).toHaveAttribute('href', '../index.html');
        const framework = page.getByRole('link', {name: 'MedSyntax Framework'});
        await expect(framework).toHaveAttribute('href', 'https://mrgtverleg-lgtm.github.io/MedsyntaxQA/framework/');
        await expect(framework).toHaveAttribute('target', '_blank');
        await expect(page.getByRole('link', {name: 'Report an issue'}))
            .toHaveAttribute('href', 'https://github.com/tedgrm/medsyntaxexperimental/issues');
    });

    test('ten item colours that repeat, with readable badges', async ({page}) => {
        await openWorkspace(page, Array.from({length: 11}, (_, n) => ({title: 'T' + n, query: 'heart'})));
        const dark = 'rgb(28, 37, 37)', white = 'rgb(255, 255, 255)';
        const text = [white, dark, dark, white, white, dark, dark, white, white, white];
        for (let n = 0; n < 11; n++) {
            await expect(badge(page, n)).toHaveCSS('background-color', colors[n % 10]);
            await expect(badge(page, n)).toHaveCSS('color', text[n % 10]);
            await expect(visual(page, n)).toHaveCSS('border-top-color', colors[n % 10]);
        }
    });

    test('19./20. Dark mode: page and items are dark, the visualisation white, a direct EDITOR unchanged', async ({page}) => {
        await openWorkspace(page, [A]);
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(211, 211, 211)');
        await page.emulateMedia({colorScheme: 'dark'});
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(38, 39, 43)');
        await expect(itemFrame(page, 0).locator('body')).toHaveCSS('background-color', 'rgb(38, 39, 43)');
        await expect(visual(page, 0)).toHaveCSS('background-color', 'rgb(255, 255, 255)');

        await page.goto('/index.html');
        await enterQuery(page, A.query);
        // Computed styles, not screenshots: the help image is animated.
        const styles = () => page.evaluate(() => [...document.querySelectorAll('*')].map((element) => {
            const style = getComputedStyle(element);
            return [style.color, style.backgroundColor, style.borderTopColor, style.colorScheme].join();
        }));
        const dark = await styles();
        await page.emulateMedia({colorScheme: 'light'});
        expect(await styles()).toEqual(dark);
        await expect(page.locator('html')).not.toHaveClass(/ws-embedded/);
        await expect(page.locator('#iframeCss, #item-tree, #edit-query-button')).toHaveCount(0);
    });

    test('21. no horizontal scroll at 375px wide, also inside items', async ({page}) => {
        await page.setViewportSize({width: 375, height: 812});
        await openWorkspace(page, [A, {title: 'Long', query: 'x'.repeat(300) + ' AND (heart OR ' + 'y'.repeat(100) + ')'}]);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
            .toBeLessThanOrEqual(0);
        await openItemBox(page, 0);
        for (let n = 0; n < 2; n++) {
            expect(await itemFrame(page, n).locator('html').evaluate((html) => html.scrollWidth - html.clientWidth))
                .toBeLessThanOrEqual(0);
        }
    });
});

test.describe('WORKSPACE colour switch', () => {
    const choice = (page: Page, name: string) => page.getByRole('radio', {name, exact: true});
    const key = 'medsyntaxqa-color-mode';

    async function expectTheme(page: Page, theme: string, count: number) {
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('body')).toHaveCSS('background-color',
            {light: 'rgb(211, 211, 211)', dark: 'rgb(38, 39, 43)', greyscale: 'rgb(211, 211, 211)'}[theme]!);
        for (const part of ['header', 'main', '#undo-toast']) {
            await expect(page.locator(part)).toHaveCSS('filter', theme === 'greyscale' ? 'grayscale(1)' : 'none');
        }
        for (let n = 0; n < count; n++) {
            await expect(itemFrame(page, n).locator('html')).toHaveAttribute('data-theme', theme);
            await expect(itemFrame(page, n).locator('body')).toHaveCSS('background-color',
                theme === 'dark' ? 'rgb(38, 39, 43)' : 'rgb(211, 211, 211)');
            await expect(visual(page, n)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
        }
    }

    test('30. each choice changes the page and all items, and the link stays the same', async ({page}) => {
        await openWorkspace(page, [A, B]);
        const url = page.url();
        await expect(choice(page, 'System')).toBeChecked();
        for (const name of ['Dark', 'Greyscale', 'Light']) {
            await choice(page, name).check();
            await expectTheme(page, name.toLowerCase(), 2);
        }
        expect(page.url()).toBe(url);
    });

    test('System follows the system setting at once; another choice ignores it', async ({page}) => {
        await openWorkspace(page, [A]);
        await page.emulateMedia({colorScheme: 'dark'});
        await expectTheme(page, 'dark', 1);
        await choice(page, 'Light').check();
        await expectTheme(page, 'light', 1);
        await page.emulateMedia({colorScheme: 'light'});
        await page.emulateMedia({colorScheme: 'dark'});
        await expectTheme(page, 'light', 1);
        await choice(page, 'System').check();
        await expectTheme(page, 'dark', 1);
    });

    test('the choice survives a reload, and new items get it', async ({page}) => {
        await openWorkspace(page, [A]);
        await choice(page, 'Dark').check();
        await page.reload();
        await waitForItems(page, 1);
        await expect(choice(page, 'Dark')).toBeChecked();
        await expectTheme(page, 'dark', 1);
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 2);
        await expect(itemFrame(page, 1).locator('html')).toHaveAttribute('data-theme', 'dark');
    });

    test('switching does not reload items or lose an unfinished query', async ({page}) => {
        await openWorkspace(page, [A]);
        await itemFrame(page, 0).locator('html').evaluate((html) => html.setAttribute('data-not-reloaded', ''));
        await openItemBox(page, 0);
        await itemBox(page, 0).fill('(unfinished');
        await choice(page, 'Dark').check();
        await expectTheme(page, 'dark', 1);
        await expect(itemBox(page, 0)).toHaveValue('(unfinished');
        await expect(itemFrame(page, 0).locator('html')).toHaveAttribute('data-not-reloaded', '');
    });

    test('an unknown stored choice, or blocked storage, gives System', async ({page}) => {
        await page.addInitScript((name) => localStorage.setItem(name, 'purple'), key);
        await openWorkspace(page, [A]);
        await expect(choice(page, 'System')).toBeChecked();

        await page.addInitScript(() => Object.defineProperty(window, 'localStorage', {
            get() {
                throw new DOMException('blocked', 'SecurityError');
            },
        }));
        await page.reload();
        await waitForItems(page, 1);
        await expect(choice(page, 'System')).toBeChecked();
        await choice(page, 'Dark').check();
        await expectTheme(page, 'dark', 1);
    });

    test('a stored choice does not reach an EDITOR opened directly', async ({page}) => {
        await page.addInitScript((name) => localStorage.setItem(name, 'dark'), key);
        await page.goto('/index.html');
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
        await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(211, 211, 211)');
    });
});
