// @ts-check
import {test, expect, type Page} from '@playwright/test';
import {captureAlerts, enterQuery, expectWarnings, queryBox, target} from './helpers';

// EDITOR (root index.html): unusual input. Tests marked 'Known bug' describe
// the wanted behaviour and are expected to fail; remove their test.fail line
// when the bug is fixed. The bugs are listed in FEATURES.md.

const dynamicInput = (page: Page) => page.locator('#dynamic-input');
const knownBug = (bug?: string) => test.fail(bug !== undefined, `Known bug: ${bug}`);

/** Open the scope editor on the scope that `part` belongs to. */
async function startEdit(page: Page, part: ReturnType<Page['locator']>) {
    await part.hover();
    // Count, not visibility: at the top level the first match is an empty dummy div.
    await expect(target(page).locator('.hover')).not.toHaveCount(0);
    await part.click();
    await expect(dynamicInput(page)).toBeVisible();
}

test.describe('EDITOR edge cases', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    test.describe('HTML in a query', () => {
        // The payload only sets a global variable in the test page.
        const html = '<img src=x onerror=pwn=1>';

        /** Wait until the image in the query has had time to run its handler. */
        async function expectNotRun(page: Page) {
            await expect(queryBox(page)).toHaveValue(html);
            await page.waitForTimeout(500);
            expect(await page.evaluate(() => (window as any).pwn)).toBeUndefined();
        }

        test('HTML typed in the query does not run', async ({page}) => {
            knownBug('the query is put in innerHTML unescaped (XSS)');
            await enterQuery(page, html);
            await expectNotRun(page);
        });

        test('HTML in a shared link does not run', async ({page}) => {
            knownBug('the query is put in innerHTML unescaped (XSS)');
            const link = await page.evaluate((query) =>
                `/index.html?query=${(window as any).LZString.compressToEncodedURIComponent(query)}`, html);
            await page.goto(link);
            await expectNotRun(page);
        });

        for (const query of ['<b>bold</b> AND heart', 'heart &amp; lung', 'heart___lung']) {
            test(`the visualisation shows ${JSON.stringify(query)} unchanged`, async ({page}) => {
                knownBug('HTML, entities and ___ in a query are changed in the visualisation');
                await enterQuery(page, query);
                await expect(queryBox(page)).toHaveValue(query);
                expect(await target(page).textContent()).toBe(query);
            });
        }

        test('HTML typed in the scope editor is kept as text', async ({page}) => {
            knownBug('HTML in the scope editor is stripped when the edit is confirmed');
            await enterQuery(page, '(heart OR lung) AND liver');
            await startEdit(page, target(page).locator('.term', {hasText: 'heart'}));
            await dynamicInput(page).fill('(heart <i>x</i> OR lung)');
            await dynamicInput(page).press('Enter');
            await expect(dynamicInput(page)).toHaveCount(0);
            await expect(queryBox(page)).toHaveValue(/<i>x<\/i>/);
        });
    });

    test.describe('terms', () => {
        const cases: {query: string, terms: string[], bug?: string}[] = [
            {query: 'vitamin AND D', terms: ['vitamin', 'D'], bug: 'a one-letter last term is not recognised'},
            {query: '#1 AND #2', terms: ['#1', '#2'], bug: 'a term starting with a symbol is not recognised'},
            {query: 'heart OR *itis', terms: ['heart', '*itis'], bug: 'a term starting with a symbol is not recognised'},
            {query: 'é AND écart', terms: ['é', 'écart'], bug: 'a term starting with a non-ASCII letter is not recognised'},
            {query: '2019 AND 2020', terms: ['2019', '2020']},
            {query: '2019', terms: ['2019']},
            {query: 'heart$ OR lun?', terms: ['heart$', 'lun?']},
        ];
        for (const {query, terms, bug} of cases) {
            test(`${JSON.stringify(query)} has terms ${terms.join(', ')}`, async ({page}) => {
                knownBug(bug);
                await enterQuery(page, query);
                await expect(target(page).locator('#search-string')).toBeAttached();
                await expect(target(page).locator('.term')).toHaveText(terms);
            });
        }

        test('the scope of a query ending in a one-letter term is the whole query', async ({page}) => {
            knownBug('a one-letter last term is left out of the scope');
            await enterQuery(page, 'vitamin AND D');
            await startEdit(page, target(page).locator('.term', {hasText: 'vitamin'}));
            await expect(dynamicInput(page)).toHaveValue('vitamin AND D');
        });

        test('Embase field codes ending in a dot are recognised', async ({page}) => {
            await enterQuery(page, 'heart.ti,ab.');
            await expect(target(page).locator('.term')).toHaveText(['heart']);
            await expect(target(page).locator('.embase')).toHaveText(['.ti', ',ab', '.']);
        });
    });

    test.describe('brackets', () => {
        const cases: {query: string, shown: string[], bug?: string}[] = [
            {query: '"smile :)" AND heart', shown: [], bug: 'brackets inside quotes count as brackets'},
            {query: '"a [b" AND heart', shown: [], bug: 'brackets inside quotes count as brackets'},
            {query: '(heart))((lung)', shown: ['warning-bracket-open', 'warning-bracket-close'],
                bug: 'only the first ( and ) are compared for the wrong order'},
            {query: '()', shown: []},
            {query: '[]', shown: []},
            {query: '(heart)(lung)', shown: []},
        ];
        for (const {query, shown, bug} of cases) {
            test(`${JSON.stringify(query)} shows ${shown.join(' + ') || 'no warning'}`, async ({page}) => {
                knownBug(bug);
                await enterQuery(page, query);
                await expect(target(page).locator('#search-string')).toBeAttached();
                await expectWarnings(page, shown);
            });
        }

        test('interleaved brackets "([)]" show a warning', async ({page}) => {
            knownBug('interleaved ( and [ are not noticed');
            await enterQuery(page, '([)]');
            await expect(target(page)).toHaveText('([)]');
            await expect(page.locator('.warning-medsyntax:visible')).not.toHaveCount(0);
        });

        test('the scope editor refuses brackets in the wrong order', async ({page}) => {
            knownBug('only the first ( and ) are compared for the wrong order');
            const alerts = captureAlerts(page);
            await enterQuery(page, '(heart OR cardiac) AND lung');
            await startEdit(page, target(page).locator('.term', {hasText: 'cardiac'}));
            await dynamicInput(page).fill('(heart) OR) (cardiac');
            await dynamicInput(page).press('Enter');
            await expect.poll(() => alerts).toEqual([expect.stringContaining('bracket error')]);
        });

        test('60 nested bracket levels all render', async ({page}) => {
            const query = '('.repeat(60) + 'heart' + ')'.repeat(60);
            await enterQuery(page, query);
            await expect(target(page).locator('.brackets')).toHaveCount(60);
            await expect(target(page)).toHaveText(query);
            await expectWarnings(page, []);
        });
    });

    test.describe('apostrophes', () => {
        test('one apostrophe in a word gives no quote warning', async ({page}) => {
            knownBug('an apostrophe counts as a quote');
            await enterQuery(page, "Crohn's disease");
            await expect(target(page)).toHaveText("Crohn's disease");
            await expectWarnings(page, []);
        });

        test('an operator between two words with an apostrophe is recognised', async ({page}) => {
            knownBug('the text between two apostrophes becomes a quoted term');
            await enterQuery(page, "Crohn's AND Parkinson's");
            await expect(target(page)).toHaveText("Crohn's AND Parkinson's");
            await expect(target(page).locator('.boolean.and')).toHaveCount(1);
        });
    });

    test.describe('operators', () => {
        for (const query of ['AND heart', 'heart AND', 'heart AND OR lung', 'heart NOT NOT lung']) {
            test(`the misplaced operator in ${JSON.stringify(query)} gives a warning`, async ({page}) => {
                knownBug('a missing operand or stray operator gives no warning');
                await enterQuery(page, query);
                await expect(target(page)).toHaveText(query);
                await expect(page.locator('.warning-medsyntax:visible')).not.toHaveCount(0);
            });
        }

        for (const [name, space] of [['tabs', '\t'], ['non-breaking spaces', ' ']]) {
            test(`AND between ${name} is recognised`, async ({page}) => {
                knownBug('only regular spaces around an operator are recognised');
                await enterQuery(page, `heart${space}AND${space}lung`);
                await expect(target(page).locator('#search-string')).toBeAttached();
                await expect(target(page).locator('.boolean.and')).toHaveCount(1);
            });
        }

        for (const query of ['"heart AND(lung)"', '(door)ORAL drug', 'FOR(heart)']) {
            test(`the clean-up leaves ${JSON.stringify(query)} alone`, async ({page}) => {
                knownBug('the clean-up also adds spaces inside quotes and next to words containing an operator');
                await enterQuery(page, query);
                await expect(target(page).locator('#search-string')).toBeAttached();
                await expect(queryBox(page)).toHaveValue(query);
            });
        }

        test('operators inside quotes are not operators', async ({page}) => {
            await enterQuery(page, '"heart AND lung"');
            await expect(target(page).locator('.quote-term')).toHaveText(['"heart AND lung"']);
            await expect(target(page).locator('.boolean')).toHaveCount(0);
        });
    });

    test.describe('typing', () => {
        test('typing fast renders everything', async ({page, browserName}) => {
            test.fail(browserName === 'webkit',
                'Known bug: WebKit allows 100 history changes per 10 seconds; updateUrl makes two per key');
            const query = 'abcdefghij '.repeat(12) + 'heart';
            await queryBox(page).focus();
            await page.keyboard.type(query, {delay: 30});
            await expect(queryBox(page)).toHaveValue(query);
            await expect(target(page)).toHaveText(query);
        });

        test('typing in the middle of a query keeps the caret there', async ({page}) => {
            await queryBox(page).focus();
            await page.keyboard.type('heart lung');
            for (let i = 0; i < 5; i++) {
                await page.keyboard.press('ArrowLeft');
            }
            await page.keyboard.type('xyz');
            await expect(queryBox(page)).toHaveValue('heartxyz lung');
        });

        test('a query of 1000 terms renders completely', async ({page}) => {
            const query = Array.from({length: 1000}, (_, i) => `term${i}[tiab]`).join(' OR ');
            await enterQuery(page, query);
            await expect(target(page).locator('.term')).toHaveCount(1000);
            await expect(target(page).locator('.boolean.or')).toHaveCount(999);
        });

        test('emptying the query box by hand shows the demo button again', async ({page}) => {
            knownBug('only the clear button shows the demo button again');
            await enterQuery(page, 'heart');
            await expect(page.locator('#demo-button')).toBeHidden();
            await enterQuery(page, '');
            await expect(target(page)).toHaveText('');
            await expect(page.locator('#demo-button')).toBeVisible();
        });
    });

    test.describe('during a scope edit', () => {
        test.beforeEach(async ({page}) => {
            await enterQuery(page, '(heart OR cardiac) AND lung');
            await startEdit(page, target(page).locator('.term', {hasText: 'cardiac'}));
        });

        test('Clear ends the edit and empties the query', async ({page}) => {
            await page.locator('#clear-button').click();
            await expect(dynamicInput(page)).toHaveCount(0);
            await expect(queryBox(page)).toHaveValue('');
            await expect(target(page)).toHaveText('');
        });

        test('typing in the query box keeps the visualisation in step', async ({page}) => {
            knownBug('the visualisation is not updated while a scope edit is open');
            await queryBox(page).focus();
            await page.keyboard.type('s');
            await expect(queryBox(page)).toHaveValue('(heart OR cardiac) AND lungs');
            await expect(target(page)).toHaveText('(heart OR cardiac) AND lungs');
        });
    });

    test.describe('links and history', () => {
        for (const search of ['?query=', '?querytitle=', '?unknown=1']) {
            test(`${search} opens an empty EDITOR without errors`, async ({page}) => {
                const errors: string[] = [];
                page.on('pageerror', (error) => errors.push(error.message));
                await page.goto(`/index.html${search}`);
                await expect(page).toHaveTitle('Medsyntax:');
                await expect(queryBox(page)).toHaveValue('');
                await expect(page.locator('#demo-button')).toBeVisible();
                expect(errors).toEqual([]);
            });
        }

        test('a link with malformed percent-encoding opens an empty EDITOR', async ({page}) => {
            knownBug('decodeURIComponent throws, so the rest of the start-up is skipped');
            await page.goto('/index.html?query=%E0%A4%A');
            await expect(queryBox(page)).toHaveValue('');
            // The title is set by the start-up code after the query is read.
            await expect(page).toHaveTitle('Medsyntax:');
        });

        test('the Back button brings back the previous query', async ({page}) => {
            knownBug('Back changes the link but not the query');
            await enterQuery(page, 'heart');
            const link = page.url();
            await enterQuery(page, 'heart AND lung');
            expect(page.url()).not.toBe(link);
            // Each change may leave more than one entry; go back to the first link.
            for (let i = 0; i < 4 && page.url() !== link; i++) {
                await page.goBack();
            }
            expect(page.url()).toBe(link);
            await expect(queryBox(page)).toHaveValue('heart');
        });
    });
});
