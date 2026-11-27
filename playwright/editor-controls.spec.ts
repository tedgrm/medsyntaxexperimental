// @ts-check
import {test, expect, type Page} from './base-test';
import {enterQuery, expectWarnings, queryBox, target} from './helpers';

// EDITOR (site/index.html): title, buttons, colour mode, menu and help image.

const titleBox = (page: Page) => page.locator('#query-title1');

test.describe('EDITOR title', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    test('typing a title sets the page title and the link', async ({page}) => {
        // The title updates on keyup; fill() fires none, so finish with a key press.
        await titleBox(page).fill('Heart search');
        await titleBox(page).press('End');

        await expect(page).toHaveTitle('MedSyntax: Heart search');
        await expect(page).toHaveURL(/[?&]querytitle=(?!Q(&|$))/);
    });

    test('without a title the page title is "MedSyntax:"', async ({page}) => {
        await expect(page).toHaveTitle('MedSyntax:');
    });
});

test.describe('EDITOR demo button', () => {
    test('loads and renders the demo query, then hides itself', async ({page}) => {
        await page.goto('/index.html');
        await expect(page.locator('#demo-button')).toBeVisible();

        await page.locator('#demo-button').click();

        await expect(queryBox(page)).toHaveValue(/^\(\( librarian\* OR "information specialist"/);
        await expect(target(page).locator('.term').first()).toBeVisible();
        await expect(page.locator('#demo-button')).toBeHidden();
        await expectWarnings(page, []);
        await expect(page).toHaveURL(/[?&]query=./);
    });
});

test.describe('EDITOR clear button', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    test('empties the query and visualisation and shows the demo button again', async ({page}) => {
        await enterQuery(page, '(heart OR cardiac) AND lung');
        await expect(page.locator('#demo-button')).toBeHidden();

        await page.locator('#clear-button').click();

        await expect(queryBox(page)).toHaveValue('');
        await expect(target(page)).toHaveText('');
        await expect(page.locator('#demo-button')).toBeVisible();
        await expect(page).toHaveURL(/[?&]query=(&|$)/);
    });

    test('hides the syntax warnings of the cleared query', async ({page}) => {
        await enterQuery(page, '(heart OR cardiac');
        await expectWarnings(page, ['warning-bracket-open']);

        await page.locator('#clear-button').click();

        await expect(queryBox(page)).toHaveValue('');
        await expectWarnings(page, []);
    });

    test('the cleared query renders again when re-entered without a click', async ({page}) => {
        const query = '(heart OR cardiac) AND lung';
        await enterQuery(page, query);
        await page.locator('#clear-button').click();
        await expect(target(page)).toHaveText('');

        // Keyboard focus and a key press, as when pasting: no click (which
        // re-renders the empty box) and no blur (which forces a render).
        await queryBox(page).focus();
        await queryBox(page).fill(query);
        await queryBox(page).press('End');

        await expect(target(page).locator('.brackets')).toHaveCount(1);
        await expect(page).toHaveURL(/[?&]query=[^&]/);
        await expect(page.locator('#demo-button')).toBeHidden();
    });
});

test.describe('EDITOR copy buttons', () => {
    test.beforeEach(async ({page}) => {
        // Record clipboard writes instead of using the real clipboard (WebKit
        // tests can't read it back).
        await page.addInitScript(() => {
            (window as any).copied = [];
            Object.defineProperty(navigator, 'clipboard', {
                configurable: true,
                value: {writeText: (text: string) => { (window as any).copied.push(text); return Promise.resolve(); }},
            });
        });
        await page.goto('/index.html');
        await enterQuery(page, 'heart AND lung');
    });

    const copied = (page: Page) => page.evaluate(() => (window as any).copied);

    test('"Copy query" copies the query and confirms it in the tooltip', async ({page}) => {
        await page.locator('#copy-query-button').click();

        expect(await copied(page)).toEqual(['heart AND lung']);
        await expect(page.locator('#myQueryTooltip')).toHaveText('Copied: heart AND lung');

        await titleBox(page).hover();
        await expect(page.locator('#myQueryTooltip')).toHaveText('Copy query to clipboard');
    });

    test('"Copy link" copies the current link and confirms it in the tooltip', async ({page}) => {
        await page.locator('#copy-link-button').click();

        expect(await copied(page)).toEqual([page.url()]);
        expect(page.url()).toMatch(/[?&]query=./);
        await expect(page.locator('#myLinkTooltip')).toHaveText(`Copied: ${page.url()}`);

        await titleBox(page).hover();
        await expect(page.locator('#myLinkTooltip')).toHaveText('Copy link to clipboard');
    });
});

test.describe('EDITOR menu', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
    });

    const menuButton = (page: Page) => page.getByRole('button', {name: 'menu'});
    const dropdown = (page: Page) => page.locator('#myDropdown');

    test('the menu button opens and closes the menu', async ({page}) => {
        await expect(dropdown(page)).toBeHidden();
        await menuButton(page).click();
        await expect(dropdown(page)).toBeVisible();
        await menuButton(page).click();
        await expect(dropdown(page)).toBeHidden();
    });

    test('a click outside closes the menu', async ({page}) => {
        await menuButton(page).click();
        await expect(dropdown(page)).toBeVisible();
        await page.locator('#medsyntax-title').click();
        await expect(dropdown(page)).toBeHidden();
    });

    test('lists the contact, issues, licence, framework and workspace links', async ({page}) => {
        await menuButton(page).click();
        const links = dropdown(page).locator('a');
        await expect(links).toHaveCount(5);
        await expect(links.nth(0)).toHaveAttribute('href', /^mailto:/);
        await expect(links.nth(1)).toHaveAttribute('href', /\/issues$/);
        await expect(links.nth(2)).toHaveAttribute('href', /\/LICENSE$/);
        await expect(links.nth(3)).toHaveAttribute('href', 'https://mrgtverleg-lgtm.github.io/MedsyntaxQA/framework/');
        await expect(links.nth(3)).toHaveText('MedSyntax Framework');
        await expect(links.nth(4)).toHaveAttribute('href', 'https://tedoutlook.github.io/medsyntaxqa/workspace/');
        await expect(links.nth(4)).toHaveText('MedSyntaxMulti');
    });

    test('shows the framework and MedSyntaxMulti links next to the menu', async ({page}) => {
        await expect(dropdown(page)).toBeHidden();
        const nav = page.getByRole('navigation', {name: 'MedSyntax tools'});
        const framework = nav.getByRole('link', {name: 'MedSyntax Framework'});
        const multi = nav.getByRole('link', {name: 'MedSyntaxMulti'});
        await expect(framework).toBeVisible();
        await expect(framework).toHaveAttribute('href', 'https://mrgtverleg-lgtm.github.io/MedsyntaxQA/framework/');
        await expect(framework).toHaveAttribute('target', '_blank');
        await expect(multi).toBeVisible();
        await expect(multi).toHaveAttribute('href', 'https://tedoutlook.github.io/medsyntaxqa/workspace/');
        await expect(multi).toHaveAttribute('target', '_blank');
        // On the same line as the menu button.
        const button = await menuButton(page).boundingBox();
        const link = await framework.boundingBox();
        expect(Math.abs((link!.y + link!.height / 2) - (button!.y + button!.height / 2))).toBeLessThan(8);
    });
});

test.describe('EDITOR colour mode', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
        await enterQuery(page, 'heart AND lung');
    });

    // The filter is set inline at once; the computed value follows a 0.2s
    // transition, so check the inline style.
    const filter = (page: Page) => page.locator('#search-string').evaluate((element) => element.style.filter);

    async function chooseMode(page: Page, value: '1' | '2') {
        await page.getByRole('button', {name: 'menu'}).click();
        await page.locator(`input[name=myRadios][value="${value}"]`).check();
    }

    test('greyscale turns the visualisation grey and keeps it grey after re-rendering', async ({page}) => {
        expect(await filter(page)).toBe('');

        await chooseMode(page, '2');
        await expect.poll(() => filter(page)).toBe('grayscale(100%)');

        await enterQuery(page, 'heart OR lung OR liver');
        await expect.poll(() => filter(page)).toBe('grayscale(100%)');
    });

    test('colour removes the grey again', async ({page}) => {
        await chooseMode(page, '2');
        await expect.poll(() => filter(page)).toBe('grayscale(100%)');

        await chooseMode(page, '1');
        await expect.poll(() => filter(page)).toBe('');

        await enterQuery(page, 'heart OR lung OR liver');
        await expect.poll(() => filter(page)).toBe('');
    });
});

test.describe('EDITOR help image', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
        await page.locator('#myImg').click();
    });

    test('clicking the example image opens it enlarged with a caption', async ({page}) => {
        await expect(page.locator('#myModal')).toBeVisible();
        await expect(page.locator('#img01')).toHaveAttribute('src', /medsyntax_demo_1\.gif$/);
        await expect(page.locator('#caption')).toHaveText('Press the Enter key to confirm edits');
    });

    test('the close button closes it', async ({page}) => {
        await page.locator('#myModal .close').click();
        await expect(page.locator('#myModal')).toBeHidden();
    });

    test('a click on the enlarged image closes it', async ({page}) => {
        await page.locator('#img01').click();
        await expect(page.locator('#myModal')).toBeHidden();
    });
});
