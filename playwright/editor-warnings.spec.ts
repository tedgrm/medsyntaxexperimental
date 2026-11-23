// @ts-check
import {test, expect} from '@playwright/test';
import {enterQuery, expectWarnings, target} from './helpers';

// EDITOR (root index.html): syntax warnings. Bracket warnings first, then quote,
// duplicate-operator and ambiguous-operator warnings.
//
// Bracket warnings:
//
// afterParseFunction shows a warning when brackets don't balance, and both
// warnings when they are in the wrong order (a closing bracket before the first
// opening one). A missing closing bracket used to also trigger the order check,
// showing both warnings instead of one.

const warnings = {
    open: '#warning-bracket-open',          // Too many ( / not enough )
    close: '#warning-bracket-close',        // Too many ) / not enough (
    squareOpen: '#warning-square-bracket-open',
    squareClose: '#warning-square-bracket-close',
};

// Each case: the query and the bracket warnings that must be visible. All other
// bracket warnings must be hidden.
const cases = [
    // Round brackets
    {query: '(heart OR cardiac)', shown: []},
    {query: '(heart OR cardiac', shown: ['open']},
    {query: '(', shown: ['open']},
    {query: '((heart) OR cardiac', shown: ['open']},
    {query: 'heart OR cardiac)', shown: ['close']},
    {query: ')', shown: ['close']},
    {query: ') heart OR cardiac (', shown: ['open', 'close']},
    // Square brackets
    {query: 'heart[tiab]', shown: []},
    {query: 'heart[tiab', shown: ['squareOpen']},
    {query: '[', shown: ['squareOpen']},
    {query: 'heart tiab]', shown: ['squareClose']},
    {query: '] heart tiab [', shown: ['squareOpen', 'squareClose']},
];

test.describe('EDITOR bracket warnings', () => {
    test.beforeEach(async ({page}) => {
        page.on('dialog', (dialog) => dialog.dismiss());
        await page.goto('/index.html');
    });

    for (const {query, shown} of cases) {
        const label = shown.length ? shown.join(' + ') : 'no warning';
        test(`${JSON.stringify(query)} shows ${label}`, async ({page}) => {
            await enterQuery(page, query);
            for (const [name, selector] of Object.entries(warnings)) {
                if (shown.includes(name)) {
                    await expect(page.locator(selector), `${name} warning`).toBeVisible();
                } else {
                    await expect(page.locator(selector), `${name} warning`).toBeHidden();
                }
            }
        });
    }

    test('fixing the query hides the warning again', async ({page}) => {
        await enterQuery(page, '(heart OR cardiac');
        await expect(page.locator(warnings.open)).toBeVisible();

        await enterQuery(page, '(heart OR cardiac)');
        for (const selector of Object.values(warnings)) {
            await expect(page.locator(selector)).toBeHidden();
        }
    });
});

test.describe('EDITOR quote warning', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    const cases = [
        {query: '"heart', shown: ['warning-quotes']},
        {query: "'heart", shown: ['warning-quotes']},
        {query: '"heart" AND \'lung\'', shown: []},
        {query: '"heart attack" OR "stroke"', shown: []},
    ];
    for (const {query, shown} of cases) {
        test(`${JSON.stringify(query)} shows ${shown.length ? 'the quote warning' : 'no warning'}`, async ({page}) => {
            await enterQuery(page, query);
            await expectWarnings(page, shown);
        });
    }

    test('scope editing is off while the quotes are unbalanced', async ({page}) => {
        await enterQuery(page, '"heart OR lung');
        await expectWarnings(page, ['warning-quotes']);
        await target(page).locator('.term', {hasText: 'lung'}).hover();
        await expect(target(page).locator('.hover')).toHaveCount(0);
    });
});

test.describe('EDITOR duplicate operator warnings', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    const cases = [
        {query: 'heart AND AND lung', warning: 'warning-double-and', element: '.double-boolean-and'},
        {query: 'heart and and lung', warning: 'warning-double-and', element: '.double-boolean-and'},
        {query: 'heart OR OR lung', warning: 'warning-double-or', element: '.double-boolean-or'},
        {query: 'heart or OR lung', warning: 'warning-double-or', element: '.double-boolean-or'},
    ];
    for (const {query, warning, element} of cases) {
        test(`${JSON.stringify(query)} shows ${warning}`, async ({page}) => {
            await enterQuery(page, query);
            await expectWarnings(page, [warning]);
            await expect(target(page).locator(element)).toHaveCount(1);
        });
    }

    test('removing the duplicate hides the warning', async ({page}) => {
        await enterQuery(page, 'heart AND AND lung');
        await expectWarnings(page, ['warning-double-and']);
        await enterQuery(page, 'heart AND lung');
        await expectWarnings(page, []);
    });
});

test.describe('EDITOR ambiguous operator warning', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    for (const query of ['heart AND lung OR liver', 'heart and lung or liver']) {
        test(`AND and OR at one level (${JSON.stringify(query)}) show the warning and flag both operators`, async ({page}) => {
            await enterQuery(page, query);
            await expectWarnings(page, ['warning-ambiguous-and']);
            await expect(target(page).locator('.boolean-error-and')).toHaveCount(1);
            await expect(target(page).locator('.boolean-error-or')).toHaveCount(1);
        });
    }

    test('brackets that separate AND and OR give no warning', async ({page}) => {
        await enterQuery(page, '(heart AND lung) OR liver');
        await expectWarnings(page, []);
        await expect(target(page).locator('.boolean-error-and, .boolean-error-or')).toHaveCount(0);
    });

    test('NOT alongside AND gives no warning', async ({page}) => {
        await enterQuery(page, 'heart AND lung NOT liver');
        await expectWarnings(page, []);
    });

    test('is not checked while there is a bracket error', async ({page}) => {
        await enterQuery(page, '(heart AND lung OR liver');
        await expectWarnings(page, ['warning-bracket-open']);
        await expect(target(page).locator('.boolean-error-and, .boolean-error-or')).toHaveCount(0);
    });

    test('adding brackets hides the warning', async ({page}) => {
        await enterQuery(page, 'heart AND lung OR liver');
        await expectWarnings(page, ['warning-ambiguous-and']);
        await enterQuery(page, 'heart AND (lung OR liver)');
        await expectWarnings(page, []);
    });
});
