// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {
    captureAlerts, itemBox, itemFrame, itemQuery, linkQueries, normalise, openWorkspace, titleField,
    waitForItems,
} from './helpers';

// Keyboard navigation in the WORKSPACE: product-development/keyboard-navigation.md (its scenarios have a
// K before the number) and workspace-ux.md (14-17).

const query = '(aa OR (bb AND cc)) AND dd';
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

const markers = (page: Page, n: number) => itemFrame(page, n).locator('.current-scope');

test.describe('WORKSPACE keyboard navigation', () => {
    test.beforeEach(async ({page}) => {
        await openWorkspace(page, items);
        await selectItem(page, 0, 'A');
    });

    test('K1. Traverse', async ({page}) => {
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowRight', 0, 'AND dd');
        await press(page, 'ArrowRight', 0, 'AND dd');
        await press(page, 'ArrowLeft', 0, outer);
        await press(page, 'ArrowLeft', 0, outer);
        await press(page, 'ArrowUp', 0, 'A');
        await press(page, 'ArrowUp', 0, 'A');
    });

    test('K2. Nest', async ({page}) => {
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'ArrowDown', 0, 'aa OR');
        await press(page, 'ArrowRight', 0, inner);
        await press(page, 'ArrowDown', 0, 'bb AND cc');
        await press(page, 'ArrowDown', 0, 'bb AND cc');
        await press(page, 'ArrowUp', 0, inner);
        await press(page, 'ArrowUp', 0, outer);
        await press(page, 'ArrowUp', 0, 'A');
    });

    test('K3. Next and previous item, also from a scope', async ({page}) => {
        await press(page, 'ArrowRight', 0, 'A');
        await press(page, 'Alt+ArrowUp', 0, 'A');
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'Alt+ArrowDown', 1, 'B');
        await press(page, 'Alt+ArrowDown', 2, 'C');
        await press(page, 'Alt+ArrowDown', 2, 'C');
        await press(page, 'Alt+ArrowUp', 1, 'B');
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
        expect(await page.evaluate(() => (window as any).eval('editMode'))).toBe(false);
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

    for (const key of ['Escape', 'Tab']) {
        test(`K5. Cancel a scope edit with ${key}`, async ({page, browserName}) => {
            await press(page, 'ArrowDown', 0, outer);
            await page.keyboard.press('Enter');
            await expect(dynamicInput(page, 0)).toBeFocused();
            await page.keyboard.type('zzz');
            await page.keyboard.press(key);
            await expect(dynamicInput(page, 0)).toHaveCount(0);
            if (key === 'Escape') {
                await expectNode(page, 0, outer);
            } else if (browserName === 'webkit') {
                // Safari's Tab skips buttons.
                await expect(titleField(page, 1)).toBeFocused();
            } else {
                await expect(itemFrame(page, 0).getByRole('button', {name: 'Edit query'})).toBeFocused();
            }
            expect(await itemQuery(page, 0)).toBe(query);
        });
    }

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
        await press(page, 'Alt+ArrowDown', 1, 'B');
        await page.keyboard.press('Enter');
        await expect(itemBox(page, 1)).toBeFocused();
        await page.keyboard.press('ControlOrMeta+a');
        await page.keyboard.type('(aa OR bb');
        await press(page, 'Escape', 1, 'B');
        await press(page, 'ArrowDown', 1, 'B');
        await press(page, 'Alt+ArrowDown', 2, 'C');
    });

    test('K9. Keys in the text fields only edit text', async ({page}) => {
        await page.keyboard.press('Enter');
        await expect(itemBox(page, 0)).toBeFocused();
        await page.keyboard.press('End');
        for (const key of ['ArrowUp', 'ArrowDown', 'Alt+ArrowDown', 't']) {
            await page.keyboard.press(key);
            await expect(itemBox(page, 0)).toBeFocused();
        }
        await expect.poll(() => itemQuery(page, 0)).toContain('t');
        await press(page, 'Escape', 0, 'A');
        await expect(itemBox(page, 0)).toBeHidden();

        await page.keyboard.press('t');
        await expect(titleField(page, 0)).toBeFocused();
        await page.keyboard.press('End');
        await page.keyboard.type('t');
        await press(page, 'Escape', 0, 'At');
    });

    test('K10. Remove: the focus is on the neighbour\'s Collapse button, and Tab reaches its tree', async ({page, browserName}) => {
        await button(page, 'Remove query 2').click();
        await expect(button(page, 'Collapse query 2')).toBeFocused();
        // Safari's Tab skips buttons; Option+Tab does not.
        const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
        for (let presses = 0; presses < 8 && await currentNode(page) === ''; presses++) {
            await page.keyboard.press(tab);
        }
        await expectNode(page, 1, 'C');
    });

    test('the current node is marked, and only while the tree has the focus', async ({page}) => {
        const html = itemFrame(page, 0).locator('html');
        await expect(html).toHaveClass(/item-is-current/);
        await press(page, 'ArrowDown', 0, outer);
        await expect(html).not.toHaveClass(/item-is-current/);
        await expect(markers(page, 0)).toHaveCount(1);
        const marker = (await markers(page, 0).boundingBox())!;
        const group = (await itemFrame(page, 0).locator('.brackets').first().boundingBox())!;
        expect(Math.abs(marker.x + 3 - group.x)).toBeLessThan(2);
        expect(Math.abs(marker.width - 6 - group.width)).toBeLessThan(2);

        await press(page, 'Alt+ArrowDown', 1, 'B');
        await expect(markers(page, 0)).toHaveCount(0);
        await expect(itemFrame(page, 1).locator('html')).toHaveClass(/item-is-current/);
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
        await selectItem(page, 0, 'A');
        await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab');
        await expect(button(page, 'Remove query 1')).toBeFocused();
    });

    test('Clear query is between Duplicate and Remove, and works with Enter', async ({page, browserName}) => {
        const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
        await button(page, 'Duplicate query 1').focus();
        await page.keyboard.press(tab);
        await expect(button(page, 'Clear query A')).toBeFocused();
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
        await press(page, 'Escape', 1, 'B');
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
        await expectNode(page, 0, 'A');
    });

    test('navigating does not change the link', async ({page}) => {
        const link = page.url();
        await press(page, 'ArrowDown', 0, outer);
        await press(page, 'Alt+ArrowDown', 1, 'B');
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
        await selectItem(page, 0, 'B');
        await press(page, 'Alt+ArrowDown', 1, 'A');
        await press(page, 'ArrowDown', 1, outer);
    });

    test('15. Alt+Down expands a collapsed item, which stays expanded', async ({page}) => {
        await button(page, 'Collapse query 2').click();
        await selectItem(page, 0, 'A');
        await press(page, 'Alt+ArrowDown', 1, 'B');
        await expect(button(page, 'Collapse query 2')).toBeVisible();
        await press(page, 'Alt+ArrowDown', 2, 'C');
        await expect(button(page, 'Collapse query 2')).toBeVisible();
    });

    test('16. After Add, Escape selects the new item', async ({page}) => {
        await button(page, '+ Add query after 1').click();
        await waitForItems(page, 4);
        await expect(titleField(page, 1)).toBeFocused();
        await press(page, 'Escape', 1, 'Query 2');
        await press(page, 'ArrowDown', 1, 'Query 2');
        await press(page, 'Alt+ArrowDown', 2, 'B');
    });

    test('17. The keys do nothing on a card button', async ({page}) => {
        const duplicate = button(page, 'Duplicate query 1');
        await duplicate.focus();
        for (const key of ['ArrowDown', 'ArrowUp', 'Alt+ArrowDown', 't', 'Escape']) {
            await page.keyboard.press(key);
            await expect(duplicate).toBeFocused();
        }
    });
});
