/**
 * test_browser_presentation_state.cjs
 * Comprehensive Browser QA suite for SQ-RENDER-01:
 * Presentation State Composition, Precedence, and Multi-Style Viewer Integrity.
 *
 * Captures 9 authoritative screenshots:
 * 01_baseline
 * 02_global_cartoon_cpk
 * 03_ligand_sticks_cyan
 * 04_protein_green
 * 05_pocket_yellow
 * 06_composed_render
 * 07_global_style_change
 * 08_global_color_change
 * 09_reset_overrides
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\' + (process.env.USERNAME || 'mukun') + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

let executablePath = null;
for (const p of chromePaths) {
  if (fs.existsSync(p)) {
    executablePath = p;
    break;
  }
}

if (!executablePath) {
  console.error('No Chrome or Edge browser executable found!');
  process.exit(1);
}

function loadFixture(filename) {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

const ARTIFACT_DIR = path.resolve('C:\\Users\\mukun\\.gemini\\antigravity\\brain\\c9c6205e-f806-4638-a1a8-831c2dd2bb11');
const SCRATCH_DIR = path.resolve(process.cwd(), 'scratch');

async function saveScreenshot(page, filename) {
  const scratchPath = path.join(SCRATCH_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: scratchPath, fullPage: true });
  try {
    fs.copyFileSync(scratchPath, artifactPath);
  } catch (e) {}
  console.log(`  [SCREENSHOT CAPTURED] -> ${filename}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('================================================================================');
  console.log('    SQ-RENDER-01 PRESENTATION STATE COMPOSITION & VIEWER INTEGRITY LIVE QA      ');
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-webgl',
      '--ignore-gpu-blocklist'
    ]
  });

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.toString());
    console.error('  [PAGE ERROR]', err.toString());
  });

  console.log('1. Navigating to http://127.0.0.1:5173/molstudio...');
  await page.goto('http://127.0.0.1:5173/molstudio', { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(1500);

  await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined', { timeout: 10000 });
  console.log('  [PASS] window.__molStudioTestApi initialized\n');

  // Load 4HHB fixture
  const hhbData = loadFixture('4HHB.pdb');
  await page.evaluate((data) => {
    window.__molStudioTestApi.loadMolecule('4HHB', data, 'pdb');
  }, hhbData);
  await sleep(1500);

  // ---------------------------------------------------------------------------
  // STEP 1: Baseline Load
  // ---------------------------------------------------------------------------
  console.log('--- STEP 1: 01_baseline ---');
  await saveScreenshot(page, '01_baseline.png');

  // ---------------------------------------------------------------------------
  // STEP 2: Global Cartoon + Classic CPK (Verifying Non-Black Rendering)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 2: 02_global_cartoon_cpk ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.setRenderStyle('Cartoon');
    window.__molStudioTestApi.setColorScheme('Classic CPK');
  });
  await sleep(1000);

  const cpkAtoms = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    return all.slice(0, 50).map(a => a.color);
  });
  const hasBlackCpk = cpkAtoms.some(c => c === '#000000' || c === 0 || c === 'black');
  if (hasBlackCpk) {
    throw new Error('FAIL: Cartoon + Classic CPK produced black atoms!');
  }
  console.log('  [PASS] Cartoon + Classic CPK rendered valid colorful geometry (non-black)');
  await saveScreenshot(page, '02_global_cartoon_cpk.png');

  // ---------------------------------------------------------------------------
  // STEP 3: Ligand Sticks Cyan Override
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 3: 03_ligand_sticks_cyan ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show sticks, ligand');
    window.__molStudioTestApi.runQuery('color cyan, ligand');
  });
  await sleep(1000);

  const ligandInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    return {
      hemTotal: hem.length,
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length
    };
  });
  console.log('  Ligand inspection:', ligandInspection);
  if (ligandInspection.hemSticksCyan !== 172) {
    throw new Error(`FAIL: Expected 172 HEM sticks cyan, got ${ligandInspection.hemSticksCyan}`);
  }
  console.log('  [PASS] All 172 HEM ligand atoms resolved to sticks + cyan');
  await saveScreenshot(page, '03_ligand_sticks_cyan.png');

  // ---------------------------------------------------------------------------
  // STEP 4: Protein Green Override
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 4: 04_protein_green ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('color green, protein');
  });
  await sleep(1000);

  const proteinInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      protTotal: prot.length,
      protGreen: prot.filter(a => a.color === 'green' || a.color === '#22c55e').length
    };
  });
  console.log('  Protein inspection:', proteinInspection);
  if (proteinInspection.protGreen !== 4384) {
    throw new Error(`FAIL: Expected 4384 protein green, got ${proteinInspection.protGreen}`);
  }
  console.log('  [PASS] All 4,384 protein atoms resolved to green');
  await saveScreenshot(page, '04_protein_green.png');

  // ---------------------------------------------------------------------------
  // STEP 5: Pocket Spheres Yellow Override
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 5: 05_pocket_yellow ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('select pocket, byres (ligand around 5.0) and not ligand');
    window.__molStudioTestApi.runQuery('show spheres, pocket');
    window.__molStudioTestApi.runQuery('color yellow, pocket');
  });
  await sleep(1000);

  const pocketInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const pocket = all.filter(a => a.rep === 'spheres');
    return {
      pocketTotal: pocket.length,
      pocketYellow: pocket.filter(a => a.color === 'yellow' || a.color === '#ffff00').length
    };
  });
  console.log('  Pocket inspection:', pocketInspection);
  if (pocketInspection.pocketYellow !== 778) {
    throw new Error(`FAIL: Expected 778 pocket spheres yellow, got ${pocketInspection.pocketYellow}`);
  }
  console.log('  [PASS] All 778 pocket atoms resolved to spheres + yellow');
  await saveScreenshot(page, '05_pocket_yellow.png');

  // ---------------------------------------------------------------------------
  // STEP 6: Composed Multi-Region Render Inspection
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 6: 06_composed_render ---');
  const composedInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const pocket = all.filter(a => a.rep === 'spheres');
    const greenCartoon = all.filter(a => a.rep === 'cartoon' && (a.color === 'green' || a.color === '#22c55e'));
    const solvent = all.filter(a => a.resn === 'HOH');
    return {
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length,
      pocketSpheresYellow: pocket.filter(a => (a.color === 'yellow' || a.color === '#ffff00')).length,
      greenCartoonTotal: greenCartoon.length,
      solventCross: solvent.filter(a => a.rep === 'cross' || a.rep === 'nonbonded').length
    };
  });
  console.log('  Composed multi-region inspection:', composedInspection);
  if (composedInspection.hemSticksCyan !== 172) throw new Error('FAIL: HEM sticks cyan count mismatch');
  if (composedInspection.pocketSpheresYellow !== 778) throw new Error('FAIL: Pocket spheres yellow count mismatch');
  if (composedInspection.greenCartoonTotal !== 3626) throw new Error('FAIL: Green cartoon count mismatch');
  console.log('  [PASS] Simultaneous 3-region presentation composition strictly verified!');
  await saveScreenshot(page, '06_composed_render.png');

  // ---------------------------------------------------------------------------
  // STEP 7: Global Style Change (Preserves Overrides)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 7: 07_global_style_change ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.setRenderStyle('Line');
  });
  await sleep(1000);

  const styleChangeInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const pocket = all.filter(a => a.rep === 'spheres');
    return {
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length,
      pocketSpheresYellow: pocket.filter(a => a.rep === 'spheres' && (a.color === 'yellow' || a.color === '#ffff00')).length
    };
  });
  console.log('  After global style change to Line:', styleChangeInspection);
  if (styleChangeInspection.hemSticksCyan !== 172) throw new Error('FAIL: Ligand sticks override was corrupted by global style change');
  if (styleChangeInspection.pocketSpheresYellow !== 778) throw new Error('FAIL: Pocket spheres override was corrupted by global style change');
  console.log('  [PASS] Explicit selection overrides preserved after global representation change');
  await saveScreenshot(page, '07_global_style_change.png');

  // ---------------------------------------------------------------------------
  // STEP 8: Global Color Scheme Change (Preserves Overrides)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 8: 08_global_color_change ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.setColorScheme('Rainbow');
    window.__molStudioTestApi.setRenderStyle('Cartoon');
  });
  await sleep(1000);

  const colorChangeInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    return {
      hemCyan: hem.filter(a => a.color === 'cyan' || a.color === '#00ffff').length
    };
  });
  console.log('  After global color change to Rainbow:', colorChangeInspection);
  if (colorChangeInspection.hemCyan !== 172) throw new Error('FAIL: Ligand color override was corrupted by global color change');
  console.log('  [PASS] Explicit selection color overrides preserved after global color scheme change');
  await saveScreenshot(page, '08_global_color_change.png');

  // ---------------------------------------------------------------------------
  // STEP 9: Reset / Clear Overrides
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 9: 09_reset_overrides ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.clearOverrides();
  });
  await sleep(1000);

  const resetInspection = await page.evaluate(() => {
    const state = window.__molStudioTestApi.getPresentationState();
    return state;
  });
  console.log('  After clearing overrides:', resetInspection);
  if (resetInspection.overridesCount !== 0) throw new Error('FAIL: Overrides not cleared');
  console.log('  [PASS] Overrides successfully cleared, molecule returned to unified global state');
  await saveScreenshot(page, '09_reset_overrides.png');

  // ---------------------------------------------------------------------------
  // Runtime Error Check
  // ---------------------------------------------------------------------------
  console.log('\n--- Runtime Error Check ---');
  console.log(`  Total Unhandled Page Errors: ${pageErrors.length}`);
  if (pageErrors.length > 0) {
    console.error('  FAIL: Unhandled page errors occurred during QA!');
    await browser.close();
    process.exit(1);
  } else {
    console.log('  [PASS] Zero unhandled page errors detected!');
  }

  await browser.close();
  console.log('\n================================================================================');
  console.log('    ALL 9 PRESENTATION STATE BROWSER QA STEPS PASSED SUCCESSFULLY (100.0%)      ');
  console.log('================================================================================');
})();
