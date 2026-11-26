// The `test` that spec files import instead of the one of @playwright/test.
// Not a spec file, so Playwright does not run it as tests.
import {test as base} from '@playwright/test';

export {expect, type Locator, type Page} from '@playwright/test';

// Both pages load jQuery from code.jquery.com first. In tests that request gets
// our local copy instead, so a slow or unreachable CDN cannot delay the pages
// (WORKSPACE items wait for their iframe's load event). The CDNs after it are
// tried only when this one fails, so they are not requested at all.
// jquery-fallback.spec.ts stubs the CDNs itself and does not use this.
const mainCdn = 'https://code.jquery.com/jquery-3.6.0.js';
const localJquery = 'site/scripts/third-party/jquery/jquery-3.6.0.js';
// The real CDN sends this too; a script with an SRI hash needs it.
const cors = {'Access-Control-Allow-Origin': '*'};

export const test = base.extend<{localJquery: void}>({
    localJquery: [async ({context}, use) => {
        // On the context, so it also covers iframes and pages a test opens.
        await context.route(mainCdn, (route) =>
            route.fulfill({path: localJquery, contentType: 'text/javascript', headers: cors}));
        await use();
    }, {auto: true}],
});
