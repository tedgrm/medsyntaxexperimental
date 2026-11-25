// Shared helpers for the EDITOR (site/index.html) tests. Not a spec file, so
// Playwright does not run it as tests.
import {expect, type Page} from '@playwright/test';

/** The EDITOR's query text area. */
export const queryBox = (page: Page) => page.getByRole('textbox', {name: 'query', exact: true});

/** The rendered visualisation of the query. */
export const target = (page: Page) => page.locator('#medsyntax-target1');

/**
 * Type a query into the EDITOR and let it render. The EDITOR renders on
 * keyup/change/focusout, and fill() fires none of these, so blur afterwards.
 */
export async function enterQuery(page: Page, query: string) {
    await queryBox(page).fill(query);
    await queryBox(page).blur();
}

/** Collapse whitespace, for comparing queries where spacing is not significant. */
export const normalise = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Dismiss every alert the page shows and record its message. Alerts block the
 * page, so call this before any action that might raise one.
 */
export function captureAlerts(page: Page): string[] {
    const alerts: string[] = [];
    page.on('dialog', async (dialog) => {
        alerts.push(dialog.message());
        await dialog.dismiss();
    });
    return alerts;
}

/** Ids of the syntax warnings that are currently visible. */
export async function visibleWarnings(page: Page): Promise<string[]> {
    return page.locator('.warning-medsyntax:visible').evaluateAll(
        (elements) => elements.map((element) => element.id));
}

/** Assert that exactly these warnings (ids, any order) are visible, and no others. */
export async function expectWarnings(page: Page, ids: string[]) {
    await expect.poll(async () => (await visibleWarnings(page)).sort()).toEqual([...ids].sort());
}

// ---------------------------------------------------------------------------
// WORKSPACE (site/workspace/index.html): a list of EDITOR items, each an iframe
// in an li.item. n is the position in the list, from 0 (not the item's id).

/** The WORKSPACE's list items, in order. */
export const workspaceItems = (page: Page) => page.locator('#myList li.item');

/** Item n in the list (its card). */
export const workspaceItem = (page: Page, n: number) => workspaceItems(page).nth(n);

/** The EDITOR inside item n. */
export const itemFrame = (page: Page, n: number) => workspaceItem(page, n).frameLocator('iframe');

/** Item n's title field, in its card header. */
export const titleField = (page: Page, n: number) => workspaceItem(page, n).locator('.item-title');

/** Item n's query box. Hidden while the item shows only its visualisation. */
export const itemBox = (page: Page, n: number) => itemFrame(page, n).locator('#query-input1');

/** The messages and ready handlers of item n are done: it has its number and colour. */
async function waitForItem(page: Page, n: number) {
    await expect.poll(() => itemFrame(page, n).locator('html').getAttribute('style')).toContain('--item-color');
    await expect(itemFrame(page, n).locator('body')).toHaveClass(/ws-iframe-body/);
}

/** Wait until the WORKSPACE shows `count` items and each item's EDITOR has loaded. */
export async function waitForItems(page: Page, count: number) {
    await expect(workspaceItems(page)).toHaveCount(count);
    for (let n = 0; n < count; n++) {
        await waitForItem(page, n);
    }
}

/** Show item n's query box and focus it. */
export async function openItemBox(page: Page, n: number) {
    if (await itemBox(page, n).isVisible()) {
        await itemBox(page, n).focus();
    } else {
        const more = workspaceItem(page, n).locator('[data-part=more]');
        if (await more.isVisible()) {
            await more.click();
        }
        await workspaceItem(page, n).locator('[data-part=edit]').click();
    }
    await expect(itemBox(page, n)).toBeFocused();
}

/** Type a query into item n's EDITOR and let it render (see enterQuery). */
export async function enterItemQuery(page: Page, n: number, query: string) {
    await openItemBox(page, n);
    await itemBox(page, n).fill(query);
    await itemBox(page, n).blur();
}

/** Type a title into item n's field. */
export async function enterItemTitle(page: Page, n: number, title: string) {
    await titleField(page, n).fill(title);
}

/** Open a WORKSPACE with these items in its link, and wait for them. */
export async function openWorkspace(page: Page, items: {title?: string, query?: string}[]) {
    await page.goto('/workspace/');
    await waitForItems(page, 1);
    const link = await page.evaluate((list) => {
        const lz = (window as any).LZString;
        const pack = lz.compressToEncodedURIComponent;
        return '?' + list.map(({title, query}, n) => String(n).padStart(9, '0') + 'iframequery='
            + pack(new URLSearchParams({querytitle: pack(title || ''), query: pack(query || '')}).toString())).join('&');
    }, items);
    await page.goto('/workspace/' + link);
    await waitForItems(page, items.length);
}

/** The titles stored in the WORKSPACE link, in item order. */
export async function linkTitles(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const lz = (window as any).LZString;
        return [...new URLSearchParams(location.search).entries()]
            .filter(([key]) => /^[0-9]{9}iframequery$/.test(key))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => lz.decompressFromEncodedURIComponent(new URLSearchParams(
                lz.decompressFromEncodedURIComponent(value) || '').get('querytitle') || '') || '');
    });
}

/** The query shown in item n's EDITOR. */
export const itemQuery = (page: Page, n: number) => itemBox(page, n).inputValue();

/**
 * The queries stored in the WORKSPACE link, in item order. Each
 * <9-digit index>iframequery value is an LZString-compressed EDITOR query
 * string (querytitle=…&query=…) whose query is compressed again.
 */
export async function linkQueries(page: Page): Promise<string[]> {
    return page.evaluate(() => {
        const lz = (window as any).LZString;
        return [...new URLSearchParams(location.search).entries()]
            .filter(([key]) => /^[0-9]{9}iframequery$/.test(key))
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, value]) => {
                const editorQueryString = lz.decompressFromEncodedURIComponent(value) || '';
                const query = new URLSearchParams(editorQueryString).get('query');
                return query ? lz.decompressFromEncodedURIComponent(query) || '' : '';
            });
    });
}
