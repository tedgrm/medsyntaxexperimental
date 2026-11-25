// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {enterItemQuery, enterQuery, linkQueries, target, waitForItems} from './helpers';

// Both pages load jQuery from code.jquery.com, then jsDelivr, then cdnjs, then
// our local copy. Each source is only tried when the ones before it failed.
// The CDNs are stubbed, so these tests need no network.

const localJquery = 'site/scripts/third-party/jquery/jquery-3.6.0.js';

const sources = {
    main: 'https://code.jquery.com/jquery-3.6.0.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.js',
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.js',
    local: 'http://127.0.0.1:8080/scripts/third-party/jquery/jquery-3.6.0.js',
};

type Source = keyof typeof sources;
const order: Source[] = ['main', 'jsdelivr', 'cdnjs', 'local'];

/**
 * Abort the jQuery sources before `working` and let the rest serve jQuery.
 * Returns the sources requested, in order
 * of first request, and the page errors.
 */
async function serveJqueryFrom(page: Page, working: Source) {
    const requested: Source[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const source of order) {
        await page.route(sources[source], async (route) => {
            if (!requested.includes(source)) requested.push(source);
            if (order.indexOf(source) < order.indexOf(working)) {
                await route.abort();
            } else if (source === 'local') {
                await route.continue(); // the real file, from our server
            } else {
                await route.fulfill({path: localJquery, contentType: 'text/javascript'});
            }
        });
    }
    return {requested, errors};
}

for (const [index, working] of order.entries()) {
    const expected = order.slice(0, index + 1);

    test.describe(`jQuery from ${working} (${index} earlier source(s) failing)`, () => {
        test('EDITOR renders a query', async ({page}) => {
            const {requested, errors} = await serveJqueryFrom(page, working);
            await page.goto('/index.html');
            await enterQuery(page, '(heart OR lung)');
            await expect(target(page).locator('.term')).toHaveCount(2);
            expect(requested).toEqual(expected);
            expect(errors).toEqual([]);
        });

        test('WORKSPACE loads its items and keeps a query in its link', async ({page}) => {
            const {requested, errors} = await serveJqueryFrom(page, working);
            await page.goto('/workspace/');
            await waitForItems(page, 3);
            await enterItemQuery(page, 1, 'heart OR lung');
            await expect.poll(() => linkQueries(page)).toContain('heart OR lung');
            expect(requested).toEqual(expected);
            expect(errors).toEqual([]);
        });
    });
}
