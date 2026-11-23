// Shared helpers for the EDITOR (root index.html) tests. Not a spec file, so
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
// WORKSPACE (workspace/index.html): a list of EDITOR items, each an iframe
// #page_is_fresh_<n> inside li#li_item_<n>.

/** The WORKSPACE's list items, in order. */
export const workspaceItems = (page: Page) => page.locator('#myList li.item');

/** The EDITOR inside item n. */
export const itemFrame = (page: Page, n: number) => page.frameLocator(`#page_is_fresh_${n}`);

/** Wait until the WORKSPACE shows `count` items and each item's EDITOR has loaded. */
export async function waitForItems(page: Page, count: number) {
    await expect(workspaceItems(page)).toHaveCount(count);
    for (let n = 0; n < count; n++) {
        await expect(itemFrame(page, n).locator('#query-input1')).toBeVisible();
    }
}

/** Type a query into item n's EDITOR and let it render (see enterQuery). */
export async function enterItemQuery(page: Page, n: number, query: string) {
    const box = itemFrame(page, n).locator('#query-input1');
    await box.fill(query);
    await box.blur();
}

/** The query shown in item n's EDITOR. */
export const itemQuery = (page: Page, n: number) => itemFrame(page, n).locator('#query-input1').inputValue();

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
