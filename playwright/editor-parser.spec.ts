// @ts-check
import {test, expect} from '@playwright/test';
import {enterQuery, expectWarnings, queryBox, target} from './helpers';

// EDITOR (site/index.html): how syntaxParser turns a query into visualisation
// elements, and how syntaxCheck cleans up the input first.

test.describe('EDITOR parser output', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    // Each case: a query and the number of elements expected per selector.
    const cases = [
        {name: 'a quoted phrase', query: '"heart attack"', expected: {'.quote-term': 1, '.term': 0}},
        {name: 'a field tag', query: 'heart[tiab]', expected: {'.term': 1, '.square-brackets': 1}},
        {name: 'a proximity operator', query: 'heart NEAR/3 lung', expected: {'.term': 2, '.near': 1}},
        {name: 'an Emtree term', query: "'aged'/exp", expected: {'.quote-term': 1, '.embase': 1}},
        {name: 'Embase field codes', query: 'heart:ti,ab', expected: {'.term': 1, '.embase': 2}},
        {name: 'nested brackets', query: '((heart OR lung) AND liver)', expected: {'.brackets': 2, '.brackets .brackets': 1, '.term': 3}},
        {name: 'lowercase operators', query: 'heart and lung not kidney', expected: {'.boolean.and': 1, '.boolean.not': 1, '.term': 3}},
        {name: 'an unpaired (', query: '(heart', expected: {'.lonely-bracket-open': 1, '.brackets': 0}},
        {name: 'an unpaired )', query: 'heart)', expected: {'.lonely-bracket-close': 1, '.brackets': 0}},
        {name: 'an unpaired [', query: 'heart[tiab', expected: {'.lonely-square-bracket-open': 1, '.square-brackets': 0}},
        {name: 'words and numbers', query: 'covid 2019', expected: {'.term': 1}},
    ];

    for (const {name, query, expected} of cases) {
        test(`renders ${name}: ${JSON.stringify(query)}`, async ({page}) => {
            await enterQuery(page, query);
            for (const [selector, count] of Object.entries(expected)) {
                await expect(target(page).locator(selector), selector).toHaveCount(count);
            }
            // The visualisation always shows the whole query text.
            await expect(target(page)).toHaveText(query);
        });
    }
});

test.describe('EDITOR input clean-up', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    // A missing space next to a bracket is added, so the operator is recognised.
    const spacing = [
        {query: 'heart AND(lung)', cleaned: 'heart AND (lung)', operator: '.boolean.and'},
        {query: '(heart)AND lung', cleaned: '(heart) AND lung', operator: '.boolean.and'},
        {query: 'heart OR(lung)', cleaned: 'heart OR (lung)', operator: '.boolean.or'},
        {query: '(heart)OR lung', cleaned: '(heart) OR lung', operator: '.boolean.or'},
        {query: 'heart NOT(lung)', cleaned: 'heart NOT (lung)', operator: '.boolean.not'},
        {query: '(heart)NOT lung', cleaned: '(heart) NOT lung', operator: '.boolean.not'},
    ];
    for (const {query, cleaned, operator} of spacing) {
        test(`adds a space: ${JSON.stringify(query)} becomes ${JSON.stringify(cleaned)}`, async ({page}) => {
            await enterQuery(page, query);
            await expect(queryBox(page)).toHaveValue(cleaned);
            await expect(target(page).locator(operator)).toHaveCount(1);
            await expect(target(page).locator('.brackets')).toHaveCount(1);
        });
    }

    test('line breaks become spaces', async ({page}) => {
        await enterQuery(page, 'heart\nAND\nlung');
        await expect(queryBox(page)).toHaveValue('heart AND lung');
        await expect(target(page).locator('.boolean.and')).toHaveCount(1);
        await expectWarnings(page, []);
    });

    test('repeated spaces collapse to one', async ({page}) => {
        await enterQuery(page, 'heart   AND    lung');
        await expect(queryBox(page)).toHaveValue('heart AND lung');
    });
});
