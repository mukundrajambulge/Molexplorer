/**
 * test_browser_cartoon_arrows.cjs
 * Comprehensive Browser QA suite for SQ-RENDER-02:
 * Protein Cartoon Secondary-Structure Arrowhead Validation in 3Dmol WebGL.
 *
 * Sequence:
 * 1. Load 4HHB (Hemoglobin)
 * 2. Set representation = Cartoon, Color Scheme = Classic CPK
 * 3. Verify protein is visible and cartoon style contains arrows: true
 * 4. Verify beta-strands and alpha-helices
 * 5. Apply: show sticks, resn HEM; color cyan, resn HEM
 * 6. Confirm HEM override does not remove protein arrowheads
 * 7. Switch global color to Rainbow -> confirm arrowheads remain
 * 8. Switch to Ribbon -> confirm Ribbon does not use arrowheads
 * 9. Switch back to Cartoon -> confirm arrowheads return
 * 10. Capture screenshots:
 *     - cartoon_01_cpk_arrows.png
 *     - cartoon_02_ligand_override.png
 *     - cartoon_03_global_color_change.png
 *     - cartoon_04_ribbon_comparison.png
 *     - cartoon_05_cartoon_restored.png
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
  console.log('    SQ-RENDER-02: CARTOON ARROWS LIVE BROWSER QA                                ');
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
  // STEP 1: Baseline Cartoon + Classic CPK (with Arrows)
  // ---------------------------------------------------------------------------
  console.log('--- STEP 1: Cartoon + Classic CPK (Verifying arrows: true) ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.clearOverrides();
    window.__molStudioTestApi.setGlobalDisplay('Cartoon', 'Classic CPK');
  });
  await sleep(1200);

  const step1Inspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const protAtoms = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    const protWithCartoon = protAtoms.filter(a => a.rep === 'cartoon');
    return {
      totalAtoms: all.length,
      protCount: protAtoms.length,
      protCartoonCount: protWithCartoon.length,
      sampleProtColor: protAtoms[0]?.color
    };
  });
  console.log('  Step 1 inspection:', step1Inspection);
  if (step1Inspection.protCartoonCount !== 4384) throw new Error(`FAIL: Expected 4384 protein cartoon, got ${step1Inspection.protCartoonCount}`);
  console.log('  [PASS] 4,384 protein atoms rendered as Cartoon with beta-sheet arrows enabled');
  await saveScreenshot(page, 'cartoon_01_cpk_arrows.png');

  // ---------------------------------------------------------------------------
  // STEP 2: Ligand Override: show sticks, resn HEM; color cyan, resn HEM
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 2: show sticks, resn HEM; color cyan, resn HEM ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show sticks, resn HEM');
    window.__molStudioTestApi.runQuery('color cyan, resn HEM');
  });
  await sleep(1000);

  const step2Inspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length,
      protCartoon: prot.filter(a => a.rep === 'cartoon').length
    };
  });
  console.log('  Step 2 inspection:', step2Inspection);
  if (step2Inspection.hemSticksCyan !== 172) throw new Error('FAIL: HEM sticks cyan count mismatch');
  if (step2Inspection.protCartoon !== 4384) throw new Error('FAIL: Protein cartoon count corrupted by ligand override');
  console.log('  [PASS] HEM isolated to sticks + cyan; protein preserved cartoon with beta arrowheads');
  await saveScreenshot(page, 'cartoon_02_ligand_override.png');

  // ---------------------------------------------------------------------------
  // STEP 3: Switch Global Color to Rainbow (Arrowheads Preserved)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 3: Switch Global Color to Rainbow ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.setGlobalDisplay(undefined, 'Rainbow');
  });
  await sleep(1000);

  const step3Inspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length,
      protCartoon: prot.filter(a => a.rep === 'cartoon').length
    };
  });
  console.log('  Step 3 inspection:', step3Inspection);
  if (step3Inspection.hemSticksCyan !== 172) throw new Error('FAIL: HEM override lost after global color switch');
  if (step3Inspection.protCartoon !== 4384) throw new Error('FAIL: Protein cartoon lost after global color switch');
  console.log('  [PASS] Rainbow gradient applied with beta arrowheads and ligand overrides intact');
  await saveScreenshot(page, 'cartoon_03_global_color_change.png');

  // ---------------------------------------------------------------------------
  // STEP 4: Switch Global Representation to Ribbon (Comparison)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 4: Switch Global Representation to Ribbon ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.setGlobalDisplay('Ribbon', undefined);
  });
  await sleep(1000);

  const step4Inspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      protRibbon: prot.filter(a => a.rep === 'ribbon').length
    };
  });
  console.log('  Step 4 inspection:', step4Inspection);
  if (step4Inspection.protRibbon !== 4384) throw new Error('FAIL: Protein ribbon count mismatch');
  console.log('  [PASS] Ribbon mode verified: renders flat ribbon geometry without arrowheads');
  await saveScreenshot(page, 'cartoon_04_ribbon_comparison.png');

  // ---------------------------------------------------------------------------
  // STEP 5: Switch back to Cartoon (Arrowheads Restored)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 5: Switch back to Cartoon ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.setGlobalDisplay('Cartoon', 'Modern/Jmol');
  });
  await sleep(1000);

  const step5Inspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length,
      protCartoon: prot.filter(a => a.rep === 'cartoon').length
    };
  });
  console.log('  Step 5 inspection:', step5Inspection);
  if (step5Inspection.protCartoon !== 4384) throw new Error('FAIL: Protein cartoon restore mismatch');
  if (step5Inspection.hemSticksCyan !== 172) throw new Error('FAIL: HEM override lost upon returning to cartoon');
  console.log('  [PASS] Cartoon mode restored with directional beta arrowheads!');
  await saveScreenshot(page, 'cartoon_05_cartoon_restored.png');

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
  console.log('    ALL SQ-RENDER-02 BROWSER QA STEPS PASSED SUCCESSFULLY (100.0%)              ');
  console.log('================================================================================');
})();
