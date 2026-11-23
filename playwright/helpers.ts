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
