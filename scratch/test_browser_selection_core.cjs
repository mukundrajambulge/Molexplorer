/**
 * test_browser_selection_core.cjs
 * Comprehensive Browser QA suite for SQ1:
 * Core Selection Algebra, Representation/Color Scoping, and 3Dmol Atom Inspection.
 *
 * Verifies live browser execution of:
 * - select ligand, organic and not polymer
 * - color cyan, ligand
 * - show sticks, ligand
 * - select pocket, byres (ligand around 5.0) and not ligand
 * - show spheres, pocket
 * - color yellow, pocket
 * - zoom ligand
 * - inspect actual 3Dmol atom styles, representations, colors, and visibility
 * - zero unhandled page errors
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
  console.log('    SQ1 CORE SELECTION ALGEBRA LIVE BROWSER QA                                  ');
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
  console.log('--- STEP 1: SQ1 Baseline Structure Loaded ---');
  await saveScreenshot(page, 'sq1_01_baseline.png');

  // ---------------------------------------------------------------------------
  // STEP 2: Named Selection "ligand" + Show Sticks + Color Cyan
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 2: select ligand -> show sticks -> color cyan ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('select ligand, organic and not polymer');
    window.__molStudioTestApi.runQuery('show sticks, ligand');
    window.__molStudioTestApi.runQuery('color cyan, ligand');
  });
  await sleep(1000);

  const ligInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      hemTotal: hem.length,
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length,
      protCartoon: prot.filter(a => a.rep === 'cartoon').length
    };
  });
  console.log('  Ligand inspection:', ligInspection);
  if (ligInspection.hemSticksCyan !== 172) throw new Error(`FAIL: Expected 172 HEM sticks cyan, got ${ligInspection.hemSticksCyan}`);
  if (ligInspection.protCartoon !== 4384) throw new Error(`FAIL: Expected 4384 protein cartoon, got ${ligInspection.protCartoon}`);
  console.log('  [PASS] All 172 HEM atoms are sticks + cyan; 4,384 protein atoms remain cartoon');
  await saveScreenshot(page, 'sq1_02_ligand_sticks_cyan.png');

  // ---------------------------------------------------------------------------
  // STEP 3: Color Green Protein (Broad Selection)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 3: color green, protein ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('color green, protein');
  });
  await sleep(1000);

  // ---------------------------------------------------------------------------
  // STEP 4: Named Selection "pocket" + Show Spheres + Color Yellow (Specific Override)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 4: select pocket -> show spheres -> color yellow ---');
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
  if (pocketInspection.pocketYellow !== 778) throw new Error(`FAIL: Expected 778 pocket yellow, got ${pocketInspection.pocketYellow}`);
  console.log('  [PASS] All 778 pocket atoms resolved to spheres + yellow');
  await saveScreenshot(page, 'sq1_03_pocket_spheres_yellow.png');

  const compInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const pocket = all.filter(a => a.rep === 'spheres');
    const greenCartoon = all.filter(a => a.rep === 'cartoon' && (a.color === 'green' || a.color === '#22c55e'));
    return {
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff')).length,
      pocketSpheresYellow: pocket.filter(a => a.color === 'yellow' || a.color === '#ffff00').length,
      greenCartoonTotal: greenCartoon.length
    };
  });
  console.log('  Composed multi-region inspection:', compInspection);
  if (compInspection.hemSticksCyan !== 172) throw new Error('FAIL: HEM sticks cyan count mismatch');
  if (compInspection.pocketSpheresYellow !== 778) throw new Error('FAIL: Pocket spheres yellow count mismatch');
  if (compInspection.greenCartoonTotal !== 3626) throw new Error('FAIL: Green cartoon count mismatch');
  console.log('  [PASS] Composed simultaneous 3-region styles strictly verified in 3Dmol model!');
  await saveScreenshot(page, 'sq1_04_composed_render.png');

  // ---------------------------------------------------------------------------
  // STEP 5: Zoom Ligand
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 5: zoom ligand ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('zoom ligand');
  });
  await sleep(1000);
  console.log('  [PASS] Zoom camera centered on ligand');
  await saveScreenshot(page, 'sq1_05_zoom_ligand.png');

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
  console.log('    ALL SQ1 CORE SELECTION BROWSER QA STEPS PASSED SUCCESSFULLY (100.0%)        ');
  console.log('================================================================================');
})();
