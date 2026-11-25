// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {
    enterItemQuery, itemFrame, itemQuery, linkQueries, waitForItems, workspaceItems,
} from './helpers';

// WORKSPACE (site/workspace/index.html): a list of EDITOR items, each an iframe of
// ../index.html?ws=<n>&…. The whole list is kept in the WORKSPACE link as
// <9-digit index>iframequery=<compressed EDITOR query string>.

const query1 = '(heart OR cardiac) AND lung';
const query2 = 'stroke NOT child*';
const query3 = '"myocardial infarction"[Mesh]';

const item = (page: Page, n: number) => page.locator(`#li_item_${n}`);
const removeButton = (page: Page, n: number) => item(page, n).getByRole('button', {name: 'Remove'});
const addButton = (page: Page, n: number) => item(page, n).getByRole('button', {name: 'Add'});
const topAddButton = (page: Page) => page.locator('.first-button');

test.describe('WORKSPACE', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 3);
    });

    test('loads its scripts without errors', async ({page}) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const response = await page.goto('/workspace/');
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle('MedsyntaxQA');
        await waitForItems(page, 3);
        expect(errors).toEqual([]);
    });

    test('starts with three empty items, each with Remove and Add and a coloured border', async ({page}) => {
        for (let n = 0; n < 3; n++) {
            await expect(page.locator(`#page_is_fresh_${n}`)).toHaveAttribute('src', `../index.html?ws=${n}&`);
            await expect(removeButton(page, n)).toBeVisible();
            await expect(addButton(page, n)).toBeVisible();
            await expect(item(page, n)).toHaveCSS('border-top-width', '10px');
            expect(await itemQuery(page, n)).toBe('');
        }
        await expect(topAddButton(page)).toBeVisible();
        expect(await linkQueries(page)).toEqual(['', '', '']);
    });

    test('each item is an embedded EDITOR', async ({page}) => {
        for (let n = 0; n < 3; n++) {
            const frame = itemFrame(page, n);
            await expect(frame.locator('body')).toHaveClass(/ws-iframe-body/);
            await expect(frame.getByRole('button', {name: 'menu'})).toBeHidden();
            await expect(frame.locator('#query-input1')).toBeVisible();
        }
    });

    test('a query typed in an item is stored in the WORKSPACE link', async ({page}) => {
        await enterItemQuery(page, 1, query1);

        await expect.poll(() => linkQueries(page)).toEqual(['', query1, '']);
        await expect(itemFrame(page, 1).locator('#medsyntax-target1 .brackets')).toHaveCount(1);
    });

    test('focusing an item\'s query box puts the WORKSPACE in edit mode', async ({page}) => {
        const editMode = () => page.evaluate(() => (window as any).eval('editMode'));
        expect(await editMode()).toBe(false);

        await itemFrame(page, 1).locator('#query-input1').focus();
        await expect.poll(editMode).toBe(true);

        await itemFrame(page, 1).locator('#query-input1').blur();
        await expect.poll(editMode).toBe(false);
    });

    test('Add inserts an empty item after that item and keeps the other queries', async ({page}) => {
        await enterItemQuery(page, 1, query1);
        await expect.poll(() => linkQueries(page)).toEqual(['', query1, '']);

        await addButton(page, 0).click();
        await waitForItems(page, 4);

        expect(await itemQuery(page, 1)).toBe('');
        expect(await itemQuery(page, 2)).toBe(query1);
        await expect.poll(() => linkQueries(page)).toEqual(['', '', query1, '']);
    });

    test('the top Add inserts an empty item first', async ({page}) => {
        await enterItemQuery(page, 0, query1);
        await expect.poll(() => linkQueries(page)).toEqual([query1, '', '']);

        await topAddButton(page).click();
        await waitForItems(page, 4);

        expect(await itemQuery(page, 0)).toBe('');
        expect(await itemQuery(page, 1)).toBe(query1);
        await expect.poll(() => linkQueries(page)).toEqual(['', query1, '', '']);
    });

    test('Remove deletes that item and keeps the other queries in order', async ({page}) => {
        await enterItemQuery(page, 1, query1);
        await enterItemQuery(page, 2, query2);
        await expect.poll(() => linkQueries(page)).toEqual(['', query1, query2]);

        await removeButton(page, 0).click();
        await waitForItems(page, 2);

        expect(await itemQuery(page, 0)).toBe(query1);
        expect(await itemQuery(page, 1)).toBe(query2);
        // No key is left behind for the old third item.
        await expect.poll(() => linkQueries(page)).toEqual([query1, query2]);
    });

    test('removing every item leaves an empty list and a bare link', async ({page}) => {
        for (let remaining = 3; remaining > 0; remaining--) {
            await removeButton(page, 0).click();
            await expect(workspaceItems(page)).toHaveCount(remaining - 1);
        }
        await expect.poll(() => linkQueries(page)).toEqual([]);
        await expect(topAddButton(page)).toBeVisible();
    });

    test('reloading the link restores every item\'s query', async ({page}) => {
        await enterItemQuery(page, 0, query1);
        await enterItemQuery(page, 1, query2);
        await enterItemQuery(page, 2, query3);
        await expect.poll(() => linkQueries(page)).toEqual([query1, query2, query3]);

        await page.reload();
        await waitForItems(page, 3);

        expect(await itemQuery(page, 0)).toBe(query1);
        expect(await itemQuery(page, 1)).toBe(query2);
        expect(await itemQuery(page, 2)).toBe(query3);
        await expect(itemFrame(page, 0).locator('#medsyntax-target1 .brackets')).toHaveCount(1);
        await expect(itemFrame(page, 2).locator('#medsyntax-target1 .quote-term')).toHaveCount(1);
    });

    test('each item is sized to its content and grows with it', async ({page}) => {
        // iframe-resizer sets each iframe's height from its EDITOR's page height.
        const sizes = () => page.evaluate(() => [...document.querySelectorAll('#myList iframe')].map((frame) => ({
            frame: (frame as HTMLIFrameElement).getBoundingClientRect().height,
            content: (frame as HTMLIFrameElement).contentDocument!.documentElement.scrollHeight,
        })));
        const fits = async () => (await sizes()).every(({frame, content}) => Math.abs(frame - content) <= 40);

        await expect.poll(fits).toBe(true);
        const before = (await sizes())[1].frame;

        await enterItemQuery(page, 1, query1);

        await expect.poll(async () => (await sizes())[1].frame).toBeGreaterThan(before);
        await expect.poll(fits).toBe(true);
    });

    test('reloading the link keeps empty items too', async ({page}) => {
        await enterItemQuery(page, 1, query1);
        await addButton(page, 0).click();
        await waitForItems(page, 4);
        await expect.poll(() => linkQueries(page)).toEqual(['', '', query1, '']);

        await page.reload();

        await expect(workspaceItems(page)).toHaveCount(4);
        await waitForItems(page, 4);
        expect(await itemQuery(page, 2)).toBe(query1);
    });
});
