// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {enterQuery, queryBox, target} from './helpers';

// EDITOR (site/index.html): sharing via the link. The query and title are
// compressed with LZString into ?query=…&querytitle=…, and restored on load.

/** Build a link the way the EDITOR does, using its own LZString. */
async function makeLink(page: Page, query: string, title: string) {
    return page.evaluate(([q, t]) => {
        const lz = (window as any).LZString;
        return `/index.html?query=${lz.compressToEncodedURIComponent(q)}&querytitle=${lz.compressToEncodedURIComponent(t)}`;
    }, [query, title]);
}

test.describe('EDITOR sharing', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    test('a copied link restores the query and the title', async ({page}) => {
        await page.locator('#query-title1').fill('Heart search');
        await page.locator('#query-title1').press('End');
        await enterQuery(page, '(heart OR cardiac) AND lung');

        const shared = await page.context().newPage();
        await shared.goto(page.url());

        await expect(queryBox(shared)).toHaveValue('(heart OR cardiac) AND lung');
        await expect(shared.locator('#query-title1')).toHaveValue('Heart search');
        await expect(shared).toHaveTitle('Medsyntax: Heart search');
        await expect(target(shared).locator('.brackets')).toHaveCount(1);
        await expect(shared.locator('#demo-button')).toBeHidden();
    });

    test('a hand-made link is restored and rendered', async ({page}) => {
        await page.goto(await makeLink(page, 'lung NOT cancer', 'Lungs'));

        await expect(queryBox(page)).toHaveValue('lung NOT cancer');
        await expect(page).toHaveTitle('Medsyntax: Lungs');
        await expect(target(page).locator('.boolean.not')).toHaveCount(1);
    });

    test('a link with an unreadable query opens an empty EDITOR', async ({page}) => {
        await page.goto('/index.html?query=not-lzstring!!');

        await expect(queryBox(page)).toHaveValue('');
        await expect(page.locator('#demo-button')).toBeVisible();
    });

    test('editing the query updates the link', async ({page}) => {
        await enterQuery(page, 'heart');
        const first = page.url();
        await enterQuery(page, 'heart AND lung');
        expect(page.url()).not.toBe(first);

        const shared = await page.context().newPage();
        await shared.goto(page.url());
        await expect(queryBox(shared)).toHaveValue('heart AND lung');
    });
});
