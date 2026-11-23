// @ts-check
import {test, expect} from '@playwright/test';
import {enterQuery} from './helpers';
import * as fs from 'fs';
import * as path from 'path';

// EDITOR (root index.html) tests. Recorded with `npm run pw-codegen`, then tidied.

// A real-world PubMed query: four AND-ed concept blocks and a NOT block,
// with [tiab]/[Mesh] field tags, quoted phrases and nested brackets.
const pubmedQuery = '( "Hospital patient*"[tiab] OR "hosp* patient"[tiab] OR "Hospitalization"[Mesh] OR hospitali*[tiab] OR "Inpatients"[Mesh] OR "Outpatients"[Mesh] OR (hospital*[tiab] AND ( inpatient*[tiab] OR admitted[tiab] OR in-patient*[tiab] OR out-patient*[tiab] OR outpatient*[tiab]))) \nAND \n( Multimorbid*[tiab] OR "Multimorbidity"[Mesh] OR "Multiple Chronic Conditions"[Mesh] OR multi-morbid* OR "multi morbid*" OR comorbid*[tiab] OR "Comorbidity"[Mesh] OR "multiple long-term condition*"[tiab] OR MLTC[tiab] OR MCC[tiab] OR "noncommunicable diseas*"[tiab] OR SC-NCD[tiab] OR "Multiple Chronic Conditions"[Mesh] OR "multiple chronic" OR "Polypharmacy"[Mesh] OR multidisea*[tiab] OR multi-diseas*[tiab] OR "multi diseas*"[tiab] OR "multipatholog*"[tiab] OR "multi patholog*"[tiab] OR High-need high-cost[tiab] OR HNHC OR "frequent attender*"[tiab] OR "multiple diagnoses"[tiab]) \nAND \n( "Integrated care"[tiab] OR "integrated health*"[tiab] OR "integrated health"[tiab:~3] OR "integrated care"[tiab:~3] OR "coordinated care"[tiab] OR "comprehensive care"[tiab] OR "seamless care"[tiab] OR "interprofessional care"[tiab] or "transmural care"[tiab] OR "Delivery of Health Care, Integrated"[Mesh] OR "interprofessional health care"[tiab] OR "coordinated health services"[tiab] OR "collaborative care"[tiab] OR "multidisciplinary team*"[tiab] OR "interdiscipl* health care"[tiab]) \nAND \n("Outcomes of care"[tiab] OR "Emergency Room Visits"[Mesh] OR "emergency room visit"[tiab] OR "ER visit*"[tiab] OR "Patient Admission"[Mesh] OR "patient admission"[tiab] OR "Patient Readmission"[Mesh] OR "readmission*"[tiab] OR "rehospitalization"[tiab] OR "Quality of Life"[Mesh] OR QOL[tiab] OR "Quality of life"[tiab] OR "Health Status"[Mesh] OR "health status"[tiab] OR "healthcare use"[tiab] OR "health care use"[tiab] OR PROM[tiab] OR "patient reported outcome"[tiab] OR "complication rates"[tiab] OR "clinical outcomes"[tiab] OR LOS[tiab] OR "length of stay"[tiab] OR "unplanned admission*"[tiab] OR "hospital use*"[tiab] OR "healthcare resource utilization"[tiab] OR HCRU[tiab] OR morbid*[tiab] OR mort*[tiab])\nNOT\n( Child*[tiab] OR pediatric*[tiab] OR infant*[tiab] OR neonate*[tiab])\n';

test.describe('EDITOR with a PubMed query', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
        await enterQuery(page, pubmedQuery);
    });

    test('renders the query structure', async ({page}) => {
        const target = page.locator('#medsyntax-target1');
        await expect(target.locator('.boolean.and')).toHaveCount(4);
        await expect(target.locator('.boolean.not')).toHaveCount(1);
        await expect(target.locator('.brackets')).toHaveCount(7);
        await expect(target).toContainText('"Hospital patient*"[tiab]');
        await expect(target).toContainText('"Multiple Chronic Conditions"[Mesh]');
    });

    test('shows no syntax warnings', async ({page}) => {
        await expect(page.locator('.warning-medsyntax:visible')).toHaveCount(0);
    });

    test('stores the query in a shareable URL', async ({page}) => {
        await expect(page).toHaveURL(/[?&]query=/);

        // Opening the shared link in a new page restores the query. The EDITOR
        // normalises it first (syntaxCheck): line breaks become spaces and, on
        // blur, runs of spaces collapse to one.
        const normalisedQuery = pubmedQuery.replace(/\r?\n|\r/g, ' ').replace(/  +/g, ' ');
        const shared = await page.context().newPage();
        await shared.goto(page.url());
        await expect(shared.getByRole('textbox', {name: 'query', exact: true})).toHaveValue(normalisedQuery);
    });
});

// A real Embase.com search, copied from product-development/external documents/
// embase string example.xlsx. The fixture's "source" field says where from; see
// also playwright/fixtures/README.md.
const embaseFixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'embase-query.json'), 'utf8'));
const embaseQuery: string = embaseFixture.query;

test.describe('EDITOR with an Embase query', () => {
    test.beforeEach(async ({page}) => {
        await page.goto('/index.html');
        await enterQuery(page, embaseQuery);
    });

    test('renders the Embase syntax', async ({page}) => {
        const target = page.locator('#medsyntax-target1');
        await expect(target.locator('.embase')).toHaveCount(176);      // /de, /exp, :ti,ab,kw, /lim, ...
        await expect(target.locator('.near')).toHaveCount(4);          // NEXT/2, NEAR/3
        await expect(target.locator('.brackets')).toHaveCount(38);
        await expect(target.locator('.boolean.and')).toHaveCount(11);
        await expect(target.locator('.boolean.not')).toHaveCount(8);
        await expect(target).toContainText("'aged'/de");
        await expect(target).toContainText('NEAR/3');
        await expect(target).toContainText('[english]/lim');
    });

    test('brackets inside quoted terms are not bracket groups', async ({page}) => {
        // 'turkey (republic)' is an Emtree term; its brackets are part of the term.
        await expect(page.locator('#medsyntax-target1')).toContainText("'turkey (republic)'");
        await expect(page.locator('#warning-bracket-open')).toBeHidden();
        await expect(page.locator('#warning-bracket-close')).toBeHidden();
    });

    test('shows only the ambiguous-operator warning', async ({page}) => {
        // Correct: the export joins numbered lines (e.g. #18 OR #19) without extra
        // brackets, so NOT/OR and AND/NOT mix at one level.
        await expect(page.locator('#warning-ambiguous-and')).toBeVisible();
        await expect(page.locator('.warning-medsyntax:visible')).toHaveCount(1);

        const target = page.locator('#medsyntax-target1');
        await expect(target.locator('.boolean-error-and')).toHaveCount(3);
        await expect(target.locator('.boolean-error-or')).toHaveCount(9);
    });

    test('stores the query in a shareable URL', async ({page}) => {
        await expect(page).toHaveURL(/[?&]query=/);

        const normalisedQuery = embaseQuery.replace(/\r?\n|\r/g, ' ').replace(/  +/g, ' ');
        const shared = await page.context().newPage();
        await shared.goto(page.url());
        await expect(shared.getByRole('textbox', {name: 'query', exact: true})).toHaveValue(normalisedQuery);
    });
});
