// @ts-check
import {test, expect} from '@playwright/test';
import {enterQuery, normalise, queryBox, target} from './helpers';

// EDITOR (root index.html): the scope-driven editor.
//
// How it works:
//  1. Hover over the visualisation: the part under the mouse and its scope get the `.hover` class.
//     - Inside a bracket group, the scope is the whole group, brackets included.
//     - At the top level, it is the run of siblings up to the nearest bracket group.
//  2. Press the mouse on the highlight: it is replaced by a focused `#dynamic-input` with the scope text.
//  3. Enter confirms: the edited query goes back into the query box and is rendered again.
//     Clicking anywhere outside the dynamic input cancels the edit.
//  Scope editing is off while the query has unbalanced brackets or quotes.

const query = '(heart OR cardiac) AND ("myocardial infarction"[Mesh] OR infarct*[tiab]) NOT child*[tiab]';

const highlighted = (page) => target(page).locator('.hover');
const dynamicInput = (page) => page.locator('#dynamic-input');

async function scopeText(page) {
    return (await highlighted(page).allTextContents()).join('');
}

async function startEdit(page, part) {
    await part.hover();
    await expect(highlighted(page).first()).toBeVisible();
    await part.click();
    await expect(dynamicInput(page)).toBeVisible();
}


test.describe('EDITOR scope-driven editor', () => {
    // Alerts block the page, so dismiss each one and keep its message.
    // Tests that expect an alert read `alerts`; any other test fails if one appeared.
    let alerts = [];

    test.beforeEach(async ({page}) => {
        alerts = [];
        page.on('dialog', async (dialog) => {
            alerts.push(dialog.message());
            await dialog.dismiss();
        });
        await page.goto('/index.html');
        await enterQuery(page, query);
    });

    test.afterEach(async () => {
        if (!test.info().annotations.some((a) => a.type === 'expects-alert')) {
            expect(alerts, 'no alerts expected').toEqual([]);
        }
    });

    test.describe('choosing a scope by hovering', () => {
        test('hovering a term inside brackets selects the whole bracket group', async ({page}) => {
            await target(page).locator('.term', {hasText: 'cardiac'}).hover();
            await expect.poll(() => scopeText(page)).toBe('(heart OR cardiac)');
        });

        test('hovering a field tag selects its bracket group', async ({page}) => {
            await target(page).locator('.square-brackets', {hasText: '[Mesh]'}).hover();
            await expect.poll(() => scopeText(page)).toBe('("myocardial infarction"[Mesh] OR infarct*[tiab])');
        });

        test('hovering a top-level term selects its run up to the nearest bracket group', async ({page}) => {
            await target(page).locator('.term', {hasText: 'child*'}).hover();
            await expect.poll(async () => normalise(await scopeText(page))).toBe('NOT child*[tiab]');
        });

        test('moving to another part moves the highlight', async ({page}) => {
            await target(page).locator('.term', {hasText: 'heart'}).hover();
            await expect.poll(() => scopeText(page)).toBe('(heart OR cardiac)');

            await target(page).locator('.term', {hasText: 'infarct*'}).hover();
            await expect.poll(() => scopeText(page)).toBe('("myocardial infarction"[Mesh] OR infarct*[tiab])');
        });

        test('leaving the visualisation removes the highlight', async ({page}) => {
            await target(page).locator('.term', {hasText: 'cardiac'}).hover();
            await expect(highlighted(page).first()).toBeVisible();

            await page.locator('#query-title1').hover();
            await expect(highlighted(page)).toHaveCount(0);
        });

        test('scope editing is off while the query has unbalanced brackets', async ({page}) => {
            await enterQuery(page, '(heart OR cardiac');
            await expect(page.locator('#warning-bracket-open')).toBeVisible();

            await target(page).locator('.term', {hasText: 'cardiac'}).hover();
            await expect(highlighted(page)).toHaveCount(0);
        });
    });

    test.describe('editing a scope', () => {
        test('clicking a scope opens a focused input with the scope text', async ({page}) => {
            await startEdit(page, target(page).locator('.term', {hasText: 'cardiac'}));

            await expect(dynamicInput(page)).toHaveValue('(heart OR cardiac)');
            await expect(dynamicInput(page)).toBeFocused();
            // Only the chosen scope is replaced; the rest of the visualisation stays.
            await expect(target(page)).toContainText('"myocardial infarction"');
            await expect(target(page)).toContainText('child*');
        });

        test('Enter confirms the edit and updates the query, visualisation and link', async ({page}) => {
            await startEdit(page, target(page).locator('.term', {hasText: 'cardiac'}));
            await dynamicInput(page).fill('(heart OR cardiac OR coronary)');
            await dynamicInput(page).press('Enter');

            await expect(dynamicInput(page)).toHaveCount(0);
            await expect.poll(async () => normalise(await queryBox(page).inputValue())).toBe(
                '(heart OR cardiac OR coronary) AND ("myocardial infarction"[Mesh] OR infarct*[tiab]) NOT child*[tiab]');
            await expect(target(page).locator('.term', {hasText: 'coronary'})).toBeVisible();
            await expect(target(page).locator('.boolean.or')).toHaveCount(3);

            // The shared link carries the edited query.
            const shared = await page.context().newPage();
            await shared.goto(page.url());
            await expect.poll(async () => normalise(await queryBox(shared).inputValue())).toContain('coronary');
        });

        test('Enter confirms an edit of a top-level scope', async ({page}) => {
            await startEdit(page, target(page).locator('.term', {hasText: 'child*'}));
            await dynamicInput(page).fill('NOT (child*[tiab] OR infant*[tiab])');
            await dynamicInput(page).press('Enter');

            await expect(dynamicInput(page)).toHaveCount(0);
            await expect.poll(async () => normalise(await queryBox(page).inputValue())).toBe(
                '(heart OR cardiac) AND ("myocardial infarction"[Mesh] OR infarct*[tiab]) NOT (child*[tiab] OR infant*[tiab])');
            await expect(target(page).locator('.brackets')).toHaveCount(3);
        });

        test('editing a nested scope in the demo query', async ({page}) => {
            // The demo query nests "(medical OR … OR junior )" two bracket levels deep.
            // Moved here from the original example.spec.ts.
            const oldGroup = '(medical OR academic OR research OR special OR college OR junior )';
            const newGroup = '(medical OR academic OR research OR special OR college OR test value )';
            // Spacing around brackets can change after an edit (")) " vs ") )"),
            // so compare queries without any whitespace.
            const compact = (text) => text.replace(/\s+/g, '');

            // beforeEach entered a query, which hides the demo button; clear it first.
            await page.locator('#clear-button').click();
            await page.locator('#demo-button').click();
            const demoQuery = await queryBox(page).inputValue();
            expect(demoQuery).toContain(oldGroup);
            const bracketGroups = await target(page).locator('.brackets').count();

            await startEdit(page, target(page).locator('.term', {hasText: 'junior'}));
            await expect(dynamicInput(page)).toHaveValue(oldGroup);
            await dynamicInput(page).fill(newGroup);
            await dynamicInput(page).press('Enter');

            await expect(dynamicInput(page)).toHaveCount(0);
            await expect.poll(async () => compact(await queryBox(page).inputValue()))
                .toBe(compact(demoQuery.replace(oldGroup, newGroup)));
            await expect(queryBox(page)).not.toHaveValue(/junior/);
            await expect(target(page).locator('.term', {hasText: 'test value'})).toBeVisible();
            await expect(target(page).locator('.brackets')).toHaveCount(bracketGroups);
            await expect(page.locator('.warning-medsyntax:visible')).toHaveCount(0);
        });

        test('clicking outside the input cancels the edit', async ({page}) => {
            await startEdit(page, target(page).locator('.term', {hasText: 'cardiac'}));
            await dynamicInput(page).fill('(this edit is thrown away)');

            await page.locator('#medsyntax-title').click();

            await expect(dynamicInput(page)).toHaveCount(0);
            await expect(queryBox(page)).toHaveValue(query);
            await expect(target(page).locator('.term', {hasText: 'cardiac'})).toBeVisible();
            await expect(target(page)).not.toContainText('thrown away');
        });

        test('Enter with unbalanced brackets shows an alert and keeps the edit open', async ({page}) => {
            test.info().annotations.push({type: 'expects-alert'});

            await startEdit(page, target(page).locator('.term', {hasText: 'cardiac'}));
            await dynamicInput(page).fill('(heart OR cardiac');
            await dynamicInput(page).press('Enter');

            await expect.poll(() => alerts).toEqual([expect.stringContaining('bracket error')]);
            await expect(dynamicInput(page)).toBeVisible();
            await expect(queryBox(page)).toHaveValue(query);
        });

        test('Enter with an odd number of quotes shows an alert and keeps the edit open', async ({page}) => {
            test.info().annotations.push({type: 'expects-alert'});

            await startEdit(page, target(page).locator('.term', {hasText: 'cardiac'}));
            await dynamicInput(page).fill('("heart OR cardiac)');
            await dynamicInput(page).press('Enter');

            await expect.poll(() => alerts).toEqual([expect.stringContaining('number of " error')]);
            await expect(dynamicInput(page)).toBeVisible();
            await expect(queryBox(page)).toHaveValue(query);
        });
    });
});
