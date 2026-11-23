// @ts-check
import {test, expect} from '@playwright/test';

// EDITOR (root index.html): bracket syntax warnings.
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

async function enterQuery(page, query) {
    const queryBox = page.getByRole('textbox', {name: 'query', exact: true});
    await queryBox.fill(query);
    // The EDITOR renders on keyup/change/focusout; fill() fires none of these.
    await queryBox.blur();
}

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
