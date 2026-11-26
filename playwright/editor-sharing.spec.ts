// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {enterItemQuery, enterQuery, itemFrame, openItemBox, openWorkspace, queryBox, target} from './helpers';

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

// Opened directly, the EDITOR writes its link 200 ms after the last key, as one history entry (writeEditorLink in
// editor.js), or at once after a finished action. Safari allows only 100 history changes in 10 seconds.
test.describe('EDITOR link after a pause', () => {
    const pause = 200;

    test.beforeEach(async ({page}) => {
        // Count the history changes, and let a test refuse them as Safari does.
        await page.addInitScript(() => {
            const w = window as any;
            w.historyChanges = 0; // new entries: Back steps
            w.refuseHistory = false;
            for (const name of ['pushState', 'replaceState'] as const) {
                const original = history[name].bind(history);
                history[name] = (...args: Parameters<History['pushState']>) => {
                    if (w.refuseHistory) {
                        throw new DOMException('Too many calls', 'SecurityError');
                    }
                    if (name === 'pushState') {
                        w.historyChanges++;
                    }
                    return original(...args);
                };
            }
        });
        await page.goto('/index.html');
    });

    const changes = (page: Page) => page.evaluate(() => (window as any).historyChanges);
    /** The query in the current link */
    const linkQuery = (page: Page) => page.evaluate(() => (window as any).LZString
        .decompressFromEncodedURIComponent(new URLSearchParams(location.search).get('query') || '') || '');

    async function type(page: Page, text: string) {
        await queryBox(page).focus();
        await page.keyboard.press('End');
        await page.keyboard.type(text, {delay: 20});
    }

    /**
     * Type in one go, key by key in the page: Playwright's own typing can take over 200 ms per key. Returns the
     * number of new history entries right after the last key, before the pause can be over.
     */
    async function typeAtOnce(page: Page, text: string): Promise<number> {
        await queryBox(page).focus();
        return queryBox(page).evaluate((box: HTMLTextAreaElement, characters) => {
            for (const character of characters) {
                box.value += character;
                box.dispatchEvent(new KeyboardEvent('keyup', {key: character, bubbles: true}));
            }
            return (window as any).historyChanges;
        }, text);
    }

    test('opening the page adds no Back step', async ({page}) => {
        await page.waitForTimeout(3 * pause);
        expect(await changes(page)).toBe(0);
    });

    test('typing gives one history entry, after the pause, and the visualisation follows every key', async ({page}) => {
        expect(await typeAtOnce(page, 'heart AND lung')).toBe(0); // within the pause
        await expect(target(page)).toHaveText('heart AND lung');
        await expect.poll(() => linkQuery(page)).toBe('heart AND lung');
        await page.waitForTimeout(3 * pause);
        expect(await changes(page)).toBe(1);
    });

    test('one Back step per pause, and Forward again', async ({page}) => {
        await typeAtOnce(page, 'heart');
        await expect.poll(() => linkQuery(page)).toBe('heart');
        await typeAtOnce(page, ' AND lung');
        await expect.poll(() => linkQuery(page)).toBe('heart AND lung');
        await page.waitForTimeout(2 * pause);
        expect(await changes(page)).toBe(2);

        await page.goBack();
        await expect(queryBox(page)).toHaveValue('heart');
        await expect(target(page)).toHaveText('heart');
        await page.goBack();
        await expect(queryBox(page)).toHaveValue('');
        await page.goForward();
        await expect(queryBox(page)).toHaveValue('heart');
        await page.goForward();
        await expect(queryBox(page)).toHaveValue('heart AND lung');
        await page.waitForTimeout(2 * pause);
        expect(await changes(page)).toBe(2); // Back and Forward write nothing
    });

    test('Back while a link is still waiting: the step back stays', async ({page}) => {
        await type(page, 'heart');
        await expect.poll(() => linkQuery(page)).toBe('heart');
        await type(page, ' AND lung');
        await page.goBack(); // the link is still that of "heart"
        await page.waitForTimeout(3 * pause);
        await expect(queryBox(page)).toHaveValue('');
        expect(await linkQuery(page)).toBe('');
        expect(await changes(page)).toBe(1);
    });

    test('Copy link right after typing copies the new link', async ({page}) => {
        await page.addInitScript(() => {
            (window as any).copied = [];
            Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: (text: string) => {
                (window as any).copied.push(text);
                return Promise.resolve();
            }}});
        });
        await page.reload();
        await type(page, 'heart AND lung');
        // Not a click: that would leave the box, which writes the link too.
        await page.evaluate(() => (window as any).copyLinkFunction());
        const copied = await page.evaluate(() => (window as any).copied[0]);
        expect(copied).toBe(page.url());
        expect(await linkQuery(page)).toBe('heart AND lung');
        await expect(queryBox(page)).toBeFocused();
    });

    test('leaving the box, a scope edit, Clear and Demo write the link at once', async ({page}) => {
        // At once: before the pause is over, so with timers stopped.
        await type(page, 'heart OR cardiac');
        await page.evaluate(() => {
            (window as any).setTimeout = () => 0;
        });
        await queryBox(page).blur();
        expect(await linkQuery(page)).toBe('heart OR cardiac');

        const term = target(page).locator('.term', {hasText: 'cardiac'});
        await term.hover();
        await term.click();
        await page.locator('#dynamic-input').fill('heart OR lung');
        await page.locator('#dynamic-input').press('Enter');
        await expect.poll(async () => (await queryBox(page).inputValue()).trim()).toBe('heart OR lung');
        expect(await linkQuery(page)).toBe(await queryBox(page).inputValue());

        await page.locator('#clear-button').click();
        expect(await linkQuery(page)).toBe('');
        await page.locator('#demo-button').click();
        await expect(target(page).locator('.boolean').first()).toBeAttached();
        expect(await linkQuery(page)).toBe(await queryBox(page).inputValue());
    });

    test('a query and a title changed within the pause both end up in the link', async ({page}) => {
        await type(page, 'heart');
        await page.locator('#query-title1').focus();
        await page.keyboard.type('Heart', {delay: 20});
        await page.waitForTimeout(3 * pause);
        const shared = await page.context().newPage();
        await shared.goto(page.url());
        await expect(queryBox(shared)).toHaveValue('heart');
        await expect(shared.locator('#query-title1')).toHaveValue('Heart');
    });

    test('when the browser refuses a history change, typing still renders, and the link follows later', async ({page}) => {
        await page.evaluate(() => { (window as any).refuseHistory = true; });
        await type(page, 'heart AND lung');
        await page.waitForTimeout(3 * pause);
        await expect(target(page)).toHaveText('heart AND lung');
        await expect(target(page).locator('.boolean.and')).toHaveCount(1);
        expect(await linkQuery(page)).toBe('');
        await page.evaluate(() => { (window as any).refuseHistory = false; });
        await expect.poll(() => linkQuery(page), {timeout: 3000}).toBe('heart AND lung');
    });

    test('typing very fast for 15 seconds gives few history entries', async ({page}) => {
        test.slow();
        await queryBox(page).focus();
        const words = Array.from({length: 120}, (_, n) => 'w' + n).join(' ');
        await page.keyboard.type(words, {delay: 15});
        await expect(target(page)).toHaveText(words);
        await expect.poll(() => linkQuery(page)).toBe(words);
        expect(await changes(page)).toBeLessThan(20);
    });
});

test.describe('EDITOR link in a WORKSPACE item', () => {
    test('an item still writes its link at once, and adds nothing to the history', async ({page}) => {
        await openWorkspace(page, [{title: 'A', query: 'heart'}]);
        const length = await page.evaluate(() => history.length);
        await openItemBox(page, 0);
        await page.keyboard.press('End');
        await page.keyboard.type(' AND lung', {delay: 20});
        // At once, without waiting for a pause: the WORKSPACE and the item's own link
        expect(await itemFrame(page, 0).locator('html').evaluate(() => (window as any).itemQueryString)).toContain('query=');
        expect(await itemFrame(page, 0).locator('html').evaluate(() => (window as any).LZString
            .decompressFromEncodedURIComponent(new URLSearchParams(location.search).get('query') || ''))).toBe('heart AND lung');
        await enterItemQuery(page, 0, 'lung');
        expect(await page.evaluate(() => history.length)).toBe(length);
    });
});
