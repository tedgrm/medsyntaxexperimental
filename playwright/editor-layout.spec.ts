// @ts-check
import {test, expect} from '@playwright/test';

// EDITOR (root index.html) layout checks.
//
// 1. Structural checks: run everywhere, no baseline images needed.
// 2. Visual checks: compare full-page screenshots with stored baselines in
//    playwright/editor-layout.spec.ts-snapshots/ (one per browser and OS).
//    After an intended layout change, refresh them with:
//      npx playwright test editor-layout --update-snapshots

const shortQuery = '(heart OR cardiac) AND ("myocardial infarction"[Mesh] OR infarct*[tiab]) NOT child*[tiab]';

async function enterQuery(page, query) {
    const queryBox = page.getByRole('textbox', {name: 'query', exact: true});
    await queryBox.fill(query);
    // The EDITOR renders on keyup/change/focusout; fill() fires none of these.
    await queryBox.blur();
}

async function topOf(locator) {
    const box = await locator.boundingBox();
    expect(box, 'element should be rendered').not.toBeNull();
    return box!.y;
}

test.describe('EDITOR layout: structure', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    test('main controls are visible on load', async ({page}) => {
        await expect(page.getByRole('button', {name: 'menu'})).toBeVisible();
        await expect(page.locator('#query-title1')).toBeVisible();
        await expect(page.locator('#clear-button')).toBeVisible();
        await expect(page.locator('#query-input1')).toBeVisible();
        await expect(page.locator('#medsyntax-title')).toBeVisible();
        await expect(page.locator('#demo-button')).toBeVisible();
        await expect(page.locator('#copy-query-button')).toBeVisible();
        await expect(page.locator('#copy-link-button')).toBeVisible();
        await expect(page.locator('.manual')).toBeVisible();
    });

    test('hidden-by-default parts stay hidden on load', async ({page}) => {
        await expect(page.locator('#myDropdown')).toBeHidden();
        await expect(page.locator('#myModal')).toBeHidden();
        await expect(page.locator('.warning-medsyntax:visible')).toHaveCount(0);
    });

    test('sections appear top to bottom in the expected order', async ({page}) => {
        const order = [
            page.locator('#query-title1'),
            page.locator('#query-input1'),
            page.locator('#medsyntax'),
            page.locator('#copy-query-button'),
            page.locator('.manual'),
        ];
        let previous = -Infinity;
        for (const locator of order) {
            const y = await topOf(locator);
            expect(y).toBeGreaterThan(previous);
            previous = y;
        }
    });

    test('the visualisation stays between the query box and the copy buttons', async ({page}) => {
        await enterQuery(page, shortQuery);
        await expect(page.locator('#demo-button')).toBeHidden();

        const queryBox = await page.locator('#query-input1').boundingBox();
        const visual = await page.locator('#medsyntax').boundingBox();
        const copy = await page.locator('#copy-query-button').boundingBox();
        expect(visual!.y).toBeGreaterThanOrEqual(queryBox!.y + queryBox!.height);
        expect(copy!.y).toBeGreaterThanOrEqual(visual!.y + visual!.height);
    });

    test('a syntax warning appears between the query box and the visualisation', async ({page}) => {
        await enterQuery(page, '(heart OR cardiac');
        const warning = page.locator('#warning-bracket-open');
        await expect(warning).toBeVisible();

        const warningTop = await topOf(warning);
        const queryBox = await page.locator('#query-input1').boundingBox();
        expect(warningTop).toBeGreaterThanOrEqual(queryBox!.y + queryBox!.height);
        expect(warningTop).toBeLessThan(await topOf(page.locator('#medsyntax')));
    });

    for (const width of [1920, 375]) {
        test(`no horizontal page scroll at ${width}px wide`, async ({page}) => {
            // Known issue: #query-title1 has size="100" (about 814px wide), so the
            // EDITOR scrolls sideways on phone-sized screens. This test is marked
            // as expected to fail at 375px; once that is fixed, Playwright reports
            // it as "passed unexpectedly", and this line should be removed.
            test.fail(width === 375, 'Known issue: #query-title1 is wider than a phone screen');

            // Load at the target size: the query box takes its width at page load.
            await page.setViewportSize({width, height: 1080});
            await page.reload();
            await enterQuery(page, shortQuery);
            const overflow = await page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow).toBeLessThanOrEqual(0);
        });
    }
});

test.describe('EDITOR layout: visual', () => {
    // The demo GIF in the manual animates, so mask it out of every screenshot.
    const screenshotOptions = (page) => ({
        fullPage: true,
        mask: [page.locator('#myImg')],
        maxDiffPixelRatio: 0.01,
    });

    // Screenshots use the default 1920x1080 viewport from playwright.config.js.
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    test('empty EDITOR matches the baseline', async ({page}) => {
        await expect(page).toHaveScreenshot('editor-empty.png', screenshotOptions(page));
    });

    test('EDITOR with a rendered query matches the baseline', async ({page}) => {
        await enterQuery(page, shortQuery);
        await expect(page.locator('#medsyntax-target1 .boolean.and')).toHaveCount(1);
        await expect(page).toHaveScreenshot('editor-with-query.png', screenshotOptions(page));
    });

    test('EDITOR with a syntax warning matches the baseline', async ({page}) => {
        await enterQuery(page, '(heart OR cardiac');
        await expect(page.locator('#warning-bracket-open')).toBeVisible();
        await expect(page).toHaveScreenshot('editor-with-warning.png', screenshotOptions(page));
    });
});
