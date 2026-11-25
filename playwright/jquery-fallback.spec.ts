// @ts-check
import {readFileSync} from 'node:fs';
import {test, expect, type Page} from '@playwright/test';
import {enterItemQuery, enterQuery, linkQueries, target, waitForItems} from './helpers';

// Both pages load jQuery from code.jquery.com, then jsDelivr, then cdnjs, then
// our local copy. Each source is only tried when the ones before it failed.
// A CDN fails when it cannot be reached, or when its file does not match the SRI
// hash in the page. The CDNs are stubbed, so these tests need no network.

const localJquery = 'site/scripts/third-party/jquery/jquery-3.6.0.js';

const sources = {
    main: 'https://code.jquery.com/jquery-3.6.0.js',
    jsdelivr: 'https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.js',
    cdnjs: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.js',
    local: 'http://127.0.0.1:8080/scripts/third-party/jquery/jquery-3.6.0.js',
};

// The real CDNs send this too; a script with an SRI hash needs it.
const cors = {'Access-Control-Allow-Origin': '*'};
const changedJquery = readFileSync(localJquery, 'utf8') + '\nwindow.changedJqueryRan = true;\n';

type Source = keyof typeof sources;
const order: Source[] = ['main', 'jsdelivr', 'cdnjs', 'local'];

/**
 * Make the jQuery sources before `working` fail (unreachable, or serving a
 * changed file) and let the rest serve jQuery.
 * Returns the sources requested, in order
 * of first request, and the page errors.
 */
async function serveJqueryFrom(page: Page, working: Source, failure: 'unreachable' | 'changed file' = 'unreachable') {
    const requested: Source[] = [];
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const source of order) {
        await page.route(sources[source], async (route) => {
            if (!requested.includes(source)) requested.push(source);
            if (order.indexOf(source) < order.indexOf(working)) {
                if (failure === 'unreachable') {
                    await route.abort();
                } else {
                    await route.fulfill({body: changedJquery, contentType: 'text/javascript', headers: cors});
                }
            } else if (source === 'local') {
                await route.continue(); // the real file, from our server
            } else {
                await route.fulfill({path: localJquery, contentType: 'text/javascript', headers: cors});
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

test.describe('jQuery SRI', () => {
    const changedJqueryRan = (page: Page) => Promise.all(page.frames().map(
        (frame) => frame.evaluate(() => (window as any).changedJqueryRan === true)));

    test('EDITOR refuses a changed file from every CDN and uses the local copy', async ({page}) => {
        const {requested, errors} = await serveJqueryFrom(page, 'local', 'changed file');
        await page.goto('/index.html');
        await enterQuery(page, '(heart OR lung)');
        await expect(target(page).locator('.term')).toHaveCount(2);
        expect(requested).toEqual(order);
        expect(await changedJqueryRan(page)).toEqual([false]);
        expect(errors).toEqual([]);
    });

    test('WORKSPACE and its items refuse a changed file from every CDN and use the local copy', async ({page}) => {
        const {requested, errors} = await serveJqueryFrom(page, 'local', 'changed file');
        await page.goto('/workspace/');
        await waitForItems(page, 3);
        await enterItemQuery(page, 1, 'heart OR lung');
        await expect.poll(() => linkQueries(page)).toContain('heart OR lung');
        expect(requested).toEqual(order);
        expect(await changedJqueryRan(page)).toEqual([false, false, false, false]);
        expect(errors).toEqual([]);
    });

    test('EDITOR and WORKSPACE accept the unchanged file from each CDN', async ({context}) => {
        for (const path of ['/index.html', '/workspace/']) {
            for (const working of order.filter((source) => source !== 'local')) {
                const page = await context.newPage();
                const {requested, errors} = await serveJqueryFrom(page, working, 'changed file');
                await page.goto(path);
                expect(requested, `${path} from ${working}`).toEqual(order.slice(0, order.indexOf(working) + 1));
                expect(await page.evaluate(() => (window as any).jQuery?.fn.jquery)).toBe('3.6.0');
                expect(errors).toEqual([]);
                await page.close();
            }
        }
    });
});
