// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {
    enterItemQuery, itemBox, itemFrame, itemQuery, linkQueries, openItemBox, openWorkspace, waitForItems, workspaceItem,
    workspaceItems,
} from './helpers';

// WORKSPACE (site/workspace/index.html): a list of EDITOR items, each an iframe of
// ../index.html?ws=<id>&…. The whole list is kept in the WORKSPACE link as
// <9-digit index>iframequery=<compressed EDITOR query string>.
// More about its UX: workspace-ux.spec.ts. Keyboard: workspace-keyboard.spec.ts.

const query1 = '(heart OR cardiac) AND lung';
const query2 = 'stroke NOT child*';
const query3 = '"myocardial infarction"[Mesh]';

const removeButton = (page: Page, n: number) => page.getByRole('button', {name: `Remove query ${n + 1}`, exact: true});
const addButton = (page: Page, n: number) => page.getByRole('button', {name: `+ Add query after ${n + 1}`, exact: true});
const topAddButton = (page: Page) => page.getByRole('button', {name: '+ Add query at the top'});

test.describe('WORKSPACE', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/workspace/');
        await waitForItems(page, 1);
    });

    test('loads its scripts without errors', async ({page}) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const response = await page.goto('/workspace/');
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle('MedsyntaxQA');
        await waitForItems(page, 1);
        expect(errors).toEqual([]);
    });

    test('starts with one clear item, in its link too', async ({page}) => {
        await expect(workspaceItem(page, 0).locator('iframe')).toHaveAttribute('src', '../index.html?ws=0&');
        await expect(removeButton(page, 0)).toBeDisabled();
        await expect(addButton(page, 0)).toBeVisible();
        await expect(topAddButton(page)).toBeVisible();
        expect(await itemQuery(page, 0)).toBe('');
        expect(await linkQueries(page)).toEqual(['']);
    });

    test('each item is an embedded EDITOR', async ({page}) => {
        await addButton(page, 0).click();
        await waitForItems(page, 2);
        for (let n = 0; n < 2; n++) {
            const frame = itemFrame(page, n);
            await expect(frame.locator('body')).toHaveClass(/ws-iframe-body/);
            await expect(frame.getByRole('button', {name: 'menu'})).toBeHidden();
            await expect(itemBox(page, n)).toBeVisible();
        }
    });

    test('a query typed in an item is stored in the WORKSPACE link', async ({page}) => {
        await addButton(page, 0).click();
        await waitForItems(page, 2);
        await enterItemQuery(page, 1, query1);

        await expect.poll(() => linkQueries(page)).toEqual(['', query1]);
        await expect(itemFrame(page, 1).locator('#medsyntax-target1 .brackets')).toHaveCount(1);
    });

    test('focusing an item\'s query box puts the WORKSPACE in edit mode', async ({page}) => {
        const editMode = () => page.evaluate(() => (window as any).eval('editMode'));
        expect(await editMode()).toBe(false);

        await itemBox(page, 0).focus();
        await expect.poll(editMode).toBe(true);

        await itemBox(page, 0).blur();
        await expect.poll(editMode).toBe(false);
    });

    test('Add inserts an empty item after that item and keeps the other queries', async ({page}) => {
        await openWorkspace(page, [{query: query1}, {query: query2}]);
        await addButton(page, 0).click();
        await waitForItems(page, 3);

        expect(await itemQuery(page, 0)).toBe(query1);
        expect(await itemQuery(page, 1)).toBe('');
        expect(await itemQuery(page, 2)).toBe(query2);
        await expect.poll(() => linkQueries(page)).toEqual([query1, '', query2]);
    });

    test('the top Add inserts an empty item first', async ({page}) => {
        await openWorkspace(page, [{query: query1}]);
        await topAddButton(page).click();
        await waitForItems(page, 2);

        expect(await itemQuery(page, 0)).toBe('');
        expect(await itemQuery(page, 1)).toBe(query1);
        await expect.poll(() => linkQueries(page)).toEqual(['', query1]);
    });

    test('Remove deletes that item and keeps the other queries in order', async ({page}) => {
        await openWorkspace(page, [{query: query1}, {query: query2}, {query: query3}]);
        await removeButton(page, 0).click();
        await expect(workspaceItems(page)).toHaveCount(2);

        expect(await itemQuery(page, 0)).toBe(query2);
        expect(await itemQuery(page, 1)).toBe(query3);
        // No key is left behind for the old third item.
        await expect.poll(() => linkQueries(page)).toEqual([query2, query3]);
    });

    test('removing every item leaves one clear item', async ({page}) => {
        await openWorkspace(page, [{query: query1}, {query: query2}]);
        await removeButton(page, 0).click();
        await removeButton(page, 0).click();
        await waitForItems(page, 1);
        expect(await itemQuery(page, 0)).toBe('');
        await expect.poll(() => linkQueries(page)).toEqual(['']);
        await expect(removeButton(page, 0)).toBeDisabled();
    });

    test('reloading the link restores every item\'s query', async ({page}) => {
        await addButton(page, 0).click();
        await waitForItems(page, 2);
        await addButton(page, 1).click();
        await waitForItems(page, 3);
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

    test('an item fits its content, also when iframe-resizer misses a change', async ({page}) => {
        const height = () => workspaceItem(page, 0).locator('iframe').evaluate((frame: any) => frame.offsetHeight);
        const content = () => itemFrame(page, 0).locator('body').evaluate((body) => body.offsetHeight);
        const fits = async () => Math.abs(await height() - await content()) < 3;
        await expect.poll(fits).toBe(true);
        // It ignores changes while the page is hidden.
        await page.evaluate(() => Object.defineProperty(document, 'hidden', {configurable: true, get: () => true}));
        for (const padding of ['300px', '8px']) {
            await itemFrame(page, 0).locator('body').evaluate((body, value) => { body.style.paddingBottom = value; }, padding);
            await page.waitForTimeout(300);
            expect(await fits()).toBe(true);
        }
        // Too tall, and then something happens in the item.
        await workspaceItem(page, 0).locator('iframe').evaluate((frame: any) => { frame.style.height = '600px'; });
        await itemFrame(page, 0).locator('body').evaluate((body) => { body.style.paddingBottom = '9px'; });
        await expect.poll(fits).toBe(true);
    });

    test('each item is sized to its content and grows with it', async ({page}) => {
        // iframe-resizer sets each iframe's height from its EDITOR's page height.
        const sizes = () => page.evaluate(() => [...document.querySelectorAll('#myList iframe')].map((frame) => ({
            frame: (frame as HTMLIFrameElement).getBoundingClientRect().height,
            content: (frame as HTMLIFrameElement).contentDocument!.body.offsetHeight,
        })));
        const fits = async () => (await sizes()).every(({frame, content}) => Math.abs(frame - content) <= 40);

        await expect.poll(fits).toBe(true);
        const before = (await sizes())[0].frame;

        await openItemBox(page, 0);
        await itemBox(page, 0).fill('heart) AND (lung');
        await itemBox(page, 0).press('End');

        await expect.poll(async () => (await sizes())[0].frame).toBeGreaterThan(before);
        await expect.poll(fits).toBe(true);
    });


});
