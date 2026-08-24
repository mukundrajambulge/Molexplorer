/**
 * test_browser_advanced_queries.cjs
 * Puppeteer browser automation verification for Phase 4.6 Advanced Scientific Query, Measurement, and Interaction Layer.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'scratch');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const FIXTURE_PDB = fs.readFileSync(
  path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb'),
  'utf8'
);

let totalSteps = 0;
let passedSteps = 0;

async function step(name, fn) {
  totalSteps++;
  console.log(`\n[STEP ${totalSteps}] ${name}`);
  try {
    await fn();
    passedSteps++;
    console.log(`  -> PASSED`);
  } catch (err) {
    console.error(`  -> FAILED: ${err.message}`);
    throw err;
  }
}

async function shot(page, name) {
  const p = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  -> Screenshot saved: ${p}`);
}

async function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('================================================================================');
  console.log('       MOLEXPLORER P4.6 BROWSER SCIENTIFIC QUERY & MEASUREMENT SUITE            ');
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate to MolStudio
    await step('Navigate to MolStudio', async () => {
      await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
      await waitMs(1500);
      const title = await page.title();
      console.log(`  [✓] Page loaded, title="${title}"`);
    });

    // Load fixture molecule 03_protein_with_ligand.pdb
    await step('Load 03_protein_with_ligand.pdb fixture', async () => {
      await page.evaluate((pdb) => {
        window.__molStudioTestApi.loadMolecule('03_protein_with_ligand.pdb', pdb, 'pdb');
      }, FIXTURE_PDB);
      await waitMs(1500);
      const state = await page.evaluate(() => window.__molStudioTestApi.getState());
      if (!state.atomsCount || state.atomsCount === 0) {
        throw new Error('Molecule fixture failed to load');
      }
      console.log(`  [✓] Fixture loaded with ${state.atomsCount} atoms`);
    });

    // Open Selection Query Console
    await step('Open Selection Query Console', async () => {
      await page.evaluate(() => {
        window.__molStudioTestApi.openSelectionConsole();
      });
      await waitMs(500);
      await page.waitForSelector('textarea', { timeout: 5000 });
      console.log('  [✓] Selection Query Console open');
    });

    // Helper to run query via testApi and verify textOutput
    async function testQueryViaApi(q) {
      return await page.evaluate((query) => {
        return window.__molStudioTestApi.runQuery(query);
      }, q);
    }

    // Step 1: Define Named Selections in MolStudio
    await step('Define named selections: select ligand, resn LIG and select protein, polymer', async () => {
      const resLig = await testQueryViaApi('select ligand, resn LIG');
      console.log(`  [select ligand] count=${resLig.count}, textOutput="${resLig.textOutput}"`);
      if (resLig.count !== 4) throw new Error(`Expected 4 ligand atoms, got ${resLig.count}`);

      const resProt = await testQueryViaApi('select protein, polymer');
      console.log(`  [select protein] count=${resProt.count}, textOutput="${resProt.textOutput}"`);
      if (resProt.count !== 16) throw new Error(`Expected 16 protein atoms, got ${resProt.count}`);
    });

    // Step 2: Named Selection resolution: bychain ligand vs bychain (resn LIG)
    await step('Execute bychain ligand and verify equivalence with bychain (resn LIG)', async () => {
      const resNamed = await testQueryViaApi('bychain ligand');
      const resRaw = await testQueryViaApi('bychain (resn LIG)');
      console.log(`  [bychain ligand] count=${resNamed.count}, [bychain (resn LIG)] count=${resRaw.count}`);
      if (resNamed.count !== resRaw.count || resNamed.count !== 20) {
        throw new Error(`Equivalence mismatch: named=${resNamed.count}, raw=${resRaw.count}`);
      }
    });

    // Step 3: Named Selection resolution: byres ligand vs byres (resn LIG)
    await step('Execute byres ligand and verify equivalence with byres (resn LIG)', async () => {
      const resNamed = await testQueryViaApi('byres ligand');
      const resRaw = await testQueryViaApi('byres (resn LIG)');
      console.log(`  [byres ligand] count=${resNamed.count}, [byres (resn LIG)] count=${resRaw.count}`);
      if (resNamed.count !== resRaw.count || resNamed.count !== 4) {
        throw new Error(`Equivalence mismatch: named=${resNamed.count}, raw=${resRaw.count}`);
      }
    });

    // Step 4: Named Selection resolution: bymolecule ligand vs bymolecule (resn LIG)
    await step('Execute bymolecule ligand and verify equivalence with bymolecule (resn LIG)', async () => {
      const resNamed = await testQueryViaApi('bymolecule ligand');
      const resRaw = await testQueryViaApi('bymolecule (resn LIG)');
      console.log(`  [bymolecule ligand] count=${resNamed.count}, [bymolecule (resn LIG)] count=${resRaw.count}`);
      if (resNamed.count !== resRaw.count || resNamed.count !== 4) {
        throw new Error(`Equivalence mismatch: named=${resNamed.count}, raw=${resRaw.count}`);
      }
    });

    // Step 5: Named Selection resolution: within 5.0 of ligand vs within 5.0 of (resn LIG)
    await step('Execute within 5.0 of ligand and verify equivalence with within 5.0 of (resn LIG)', async () => {
      const resNamed = await testQueryViaApi('within 5.0 of ligand');
      const resRaw = await testQueryViaApi('within 5.0 of (resn LIG)');
      console.log(`  [within 5.0 of ligand] count=${resNamed.count}, [within 5.0 of (resn LIG)] count=${resRaw.count}`);
      if (resNamed.count !== resRaw.count || resNamed.count !== 4) {
        throw new Error(`Equivalence mismatch: named=${resNamed.count}, raw=${resRaw.count}`);
      }
    });

    // Step 6: Named Selection resolution: ligand expand 5.0 vs (resn LIG) expand 5.0
    await step('Execute ligand expand 5.0 and verify equivalence with (resn LIG) expand 5.0', async () => {
      const resNamed = await testQueryViaApi('ligand expand 5.0');
      const resRaw = await testQueryViaApi('(resn LIG) expand 5.0');
      console.log(`  [ligand expand 5.0] count=${resNamed.count}, [(resn LIG) expand 5.0] count=${resRaw.count}`);
      if (resNamed.count !== resRaw.count || resNamed.count !== 4) {
        throw new Error(`Equivalence mismatch: named=${resNamed.count}, raw=${resRaw.count}`);
      }
    });

    // Step 7: Distance measurement using named selections
    await step('Execute distance command with named selections: distance d_lig_prot, ligand, protein', async () => {
      const res = await testQueryViaApi('distance d_lig_prot, ligand, protein');
      console.log(`  [Output] count=${res.count}, textOutput="${res.textOutput}"`);
      if (!res.textOutput || (!res.textOutput.includes('Distance') && !res.textOutput.includes('pairs'))) {
        throw new Error(`Expected distance output, got: ${res.textOutput}`);
      }
    });

    // Step 8: Polar contacts analysis using named selections
    await step('Execute polar_contacts with named selections: polar_contacts ligand, protein', async () => {
      const res = await testQueryViaApi('polar_contacts ligand, protein');
      console.log(`  [Output] count=${res.count}, textOutput="${res.textOutput}"`);
      if (!res.textOutput || !res.textOutput.includes('Analysis "polar_contacts"')) {
        throw new Error(`Expected polar_contacts analysis output, got: ${res.textOutput}`);
      }
    });

    // Step 9: Angle measurement
    await step('Execute angle command: angle a1, (chain A and resi 1 and name N), (chain A and resi 1 and name CA), (chain A and resi 1 and name C)', async () => {
      const res = await testQueryViaApi('angle a1, (chain A and resi 1 and name N), (chain A and resi 1 and name CA), (chain A and resi 1 and name C)');
      console.log(`  [Output] count=${res.count}, textOutput="${res.textOutput}"`);
      if (!res.textOutput || (!res.textOutput.includes('Angle') && !res.textOutput.includes('°'))) {
        throw new Error(`Expected angle output, got: ${res.textOutput}`);
      }
    });

    // Step 10: Dihedral measurement
    await step('Execute dihedral command: dihedral dih1, (chain A and resi 1 and name N), (chain A and resi 1 and name CA), (chain A and resi 1 and name C), (chain A and resi 2 and name N)', async () => {
      const res = await testQueryViaApi('dihedral dih1, (chain A and resi 1 and name N), (chain A and resi 1 and name CA), (chain A and resi 1 and name C), (chain A and resi 2 and name N)');
      console.log(`  [Output] count=${res.count}, textOutput="${res.textOutput}"`);
      if (!res.textOutput || (!res.textOutput.includes('Dihedral') && !res.textOutput.includes('°'))) {
        throw new Error(`Expected dihedral output, got: ${res.textOutput}`);
      }
    });

    // Step 11: Advanced Selection Operator (bycalpha)
    await step('Execute advanced selection: bycalpha (chain A and resi 1-3)', async () => {
      const res = await testQueryViaApi('bycalpha (chain A and resi 1-3)');
      console.log(`  [Output] count=${res.count}, textOutput="${res.textOutput}"`);
      if (res.count !== 3) {
        throw new Error(`Expected 3 alpha carbons, got ${res.count}`);
      }
    });

    // Step 12: Verify typed error on non-existent named selection
    await step('Verify typed Unknown selection reference error on unregistered named selection', async () => {
      let errCaught = false;
      try {
        await page.evaluate(() => {
          window.__molStudioTestApi.runQuery('bychain non_existent_named_sel');
        });
      } catch (err) {
        errCaught = true;
        console.log(`  [Caught error] ${err.message}`);
        if (!err.message.includes("Unknown selection reference 'non_existent_named_sel'")) {
          throw new Error(`Expected Unknown selection reference error, got: ${err.message}`);
        }
      }
      if (!errCaught) throw new Error('Expected unknown named selection to throw typed error');
    });

    // Step 13: State Immutability Verification
    await step('Verify underlying scientific state immutability', async () => {
      const state = await page.evaluate(() => window.__molStudioTestApi.getState());
      console.log(`  [✓] Atom count verified strictly unchanged: ${state.atomsCount}`);
      if (state.atomsCount !== 20) {
        throw new Error(`Atom count mutated: expected 20, got ${state.atomsCount}`);
      }
    });

    // Step 14: Capture proof screenshot
    await step('Capture visual proof screenshot', async () => {
      await shot(page, 'p4_6_browser_queries_proof.png');
    });

    console.log('\n================================================================================');
    console.log(`BROWSER SUITE SUMMARY: ${passedSteps} / ${totalSteps} Steps Passed (100.0%)`);
    console.log('================================================================================');

  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('Fatal error in P4.6 browser test suite:', err);
  process.exit(1);
});

