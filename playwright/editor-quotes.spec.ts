// @ts-check
import {test, expect} from '@playwright/test';
import {captureAlerts, enterQuery, expectWarnings, queryBox, target} from './helpers';

// EDITOR (site/index.html): converting quote signs (syntaxCheck).
// Curly and other look-alike quotes, e.g. from Word, are replaced with straight
// quotes, and an alert says so: one alert per kind (double, single).

const doubleQuoteAlert = 'unexpected types of double quote signs';
const singleQuoteAlert = 'unexpected types of single quote signs';

// The look-alikes the EDITOR replaces, by name.
const doubleQuotes = {
    'left double quotation mark': '\u201C',  // “
    'right double quotation mark': '\u201D', // ”
    'double prime': '\u2033',                // ″
    'reversed double prime': '\u2036',       // ‶
};
const singleQuotes = {
    'left single quotation mark': '\u2018',  // ‘
    'right single quotation mark': '\u2019', // ’
    'prime': '\u2032',                       // ′
    'reversed prime': '\u2035',              // ‵
};

test.describe('EDITOR quote conversion', () => {
    let alerts: string[];

    test.beforeEach(async ({page}) => {
        alerts = captureAlerts(page);
        await page.goto('/index.html');
    });

    for (const [name, quote] of Object.entries(doubleQuotes)) {
        test(`${name} ${quote} becomes "`, async ({page}) => {
            await enterQuery(page, `${quote}heart attack${quote}`);

            await expect(queryBox(page)).toHaveValue('"heart attack"');
            await expect(target(page).locator('.quote-term')).toHaveCount(1);
            await expect.poll(() => alerts).toEqual([expect.stringContaining(doubleQuoteAlert)]);
            await expectWarnings(page, []);
        });
    }

    for (const [name, quote] of Object.entries(singleQuotes)) {
        test(`${name} ${quote} becomes '`, async ({page}) => {
            await enterQuery(page, `${quote}aged${quote}/de`);

            await expect(queryBox(page)).toHaveValue("'aged'/de");
            await expect(target(page).locator('.quote-term')).toHaveCount(1);
            await expect(target(page).locator('.embase')).toHaveCount(1);
            await expect.poll(() => alerts).toEqual([expect.stringContaining(singleQuoteAlert)]);
            await expectWarnings(page, []);
        });
    }

    test('both kinds in one query: both replaced, one alert each (double first)', async ({page}) => {
        await enterQuery(page, '“heart attack” AND ‘aged’/de');

        await expect(queryBox(page)).toHaveValue('"heart attack" AND \'aged\'/de');
        await expect(target(page).locator('.quote-term')).toHaveCount(2);
        await expect.poll(() => alerts).toEqual([
            expect.stringContaining(doubleQuoteAlert),
            expect.stringContaining(singleQuoteAlert),
        ]);
    });

    test('several curly quotes of one kind: all replaced, still one alert', async ({page}) => {
        await enterQuery(page, '“heart” OR “lung” OR “liver”');

        await expect(queryBox(page)).toHaveValue('"heart" OR "lung" OR "liver"');
        await expect(target(page).locator('.quote-term')).toHaveCount(3);
        await expect.poll(() => alerts).toEqual([expect.stringContaining(doubleQuoteAlert)]);
    });

    test('straight quotes only: unchanged, no alert', async ({page}) => {
        await enterQuery(page, '"heart attack" AND \'aged\'/de');

        await expect(queryBox(page)).toHaveValue('"heart attack" AND \'aged\'/de');
        await expect(target(page).locator('.quote-term')).toHaveCount(2);
        // Give any alert time to appear before checking there was none.
        await page.waitForTimeout(200);
        expect(alerts).toEqual([]);
    });

    test('a mismatched pair (“ and ") becomes a balanced pair', async ({page}) => {
        await enterQuery(page, '“heart"');

        await expect(queryBox(page)).toHaveValue('"heart"');
        await expect(target(page).locator('.quote-term')).toHaveCount(1);
        await expectWarnings(page, []);
    });

    test('an unpaired curly quote is converted, then the quote warning shows', async ({page}) => {
        await enterQuery(page, '“heart');

        await expect(queryBox(page)).toHaveValue('"heart');
        await expectWarnings(page, ['warning-quotes']);
        await expect.poll(() => alerts).toEqual([expect.stringContaining(doubleQuoteAlert)]);
    });

    test('the share link holds the straight quotes, and reopening it raises no alert', async ({page}) => {
        await enterQuery(page, '“heart attack”');
        await expect(queryBox(page)).toHaveValue('"heart attack"');

        const shared = await page.context().newPage();
        const sharedAlerts = captureAlerts(shared);
        await shared.goto(page.url());
        await expect(queryBox(shared)).toHaveValue('"heart attack"');
        await shared.waitForTimeout(200);
        expect(sharedAlerts).toEqual([]);
    });

    test('curly quotes typed in the scope editor are converted when the edit is confirmed', async ({page}) => {
        await enterQuery(page, '(heart OR cardiac) AND lung');
        const cardiac = target(page).locator('.term', {hasText: 'cardiac'});
        await cardiac.hover();
        await cardiac.click();
        await page.locator('#dynamic-input').fill('(“heart attack” OR cardiac)');
        await page.locator('#dynamic-input').press('Enter');

        await expect(page.locator('#dynamic-input')).toHaveCount(0);
        await expect.poll(async () => (await queryBox(page).inputValue()).trim())
            .toBe('("heart attack" OR cardiac) AND lung');
        await expect(target(page).locator('.quote-term')).toHaveCount(1);
        await expect.poll(() => alerts).toEqual([expect.stringContaining(doubleQuoteAlert)]);
    });
});
