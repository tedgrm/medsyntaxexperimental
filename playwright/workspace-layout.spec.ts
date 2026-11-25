// @ts-check
import {test, expect} from '@playwright/test';
import {openItemBox, openWorkspace} from './helpers';

// WORKSPACE layout: screenshots, light, dark and greyscale. After an intended change:
// npx playwright test workspace-layout --update-snapshots, look at the new images, and commit them.

for (const colorScheme of ['light', 'dark', 'greyscale'] as const) {
    test(`WORKSPACE layout, ${colorScheme}`, async ({page}) => {
        // Light and dark through the system setting, greyscale through the switch.
        await page.emulateMedia({colorScheme: colorScheme === 'dark' ? 'dark' : 'light'});
        await openWorkspace(page, [
            {title: 'Heart', query: '(heart OR (cardiac AND lung)) AND child*[tiab]'},
            {query: 'stroke NOT "young child"'},
            {title: 'With a warning', query: '(heart OR lung'},
            {title: 'Open query box', query: 'kidney OR renal'},
        ]);
        if (colorScheme === 'greyscale') {
            await page.getByRole('radio', {name: 'Greyscale', exact: true}).check();
        }
        await openItemBox(page, 3);
        // iframe-resizer has fitted every item
        await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#myList iframe')].every((frame) =>
            Math.abs((frame as HTMLIFrameElement).offsetHeight
                - (frame as HTMLIFrameElement).contentDocument!.body.offsetHeight) < 3))).toBe(true);
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(page).toHaveScreenshot(`workspace-${colorScheme}.png`, {fullPage: true, maxDiffPixelRatio: 0.01});
    });
}
