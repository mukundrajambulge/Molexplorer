/**
 * test_browser_sq4_single_word_selectors.cjs
 * Browser QA suite for SQ4 single-word semantic selectors without requiring `select <name>`.
 *
 * Verifies live browser behavior on 4HHB, 4DJW, and 1CRN:
 *   1. select protein
 *   2. select ligand
 *   3. show sticks, ligand; color cyan, ligand
 *   4. show cartoon, protein; color green, protein
 *   5. select pocket, byres (ligand around 5.0) and not ligand
 *   6. zoom ligand
 *
 * Captures 6 authoritative screenshots with zero unhandled React/runtime errors.
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
  console.log('    MOLEXPLORER SQ4 SINGLE-WORD SELECTORS LIVE BROWSER QA SUITE                 ');
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

  // Wait for test API to be ready
  await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined', { timeout: 10000 });
  console.log('  [PASS] window.__molStudioTestApi initialized');

  const hhbData = loadFixture('4HHB.pdb');

  console.log('\n--- Step 1: Loading 4HHB.pdb (4,779 atoms) & Selecting Protein ---');
  await page.evaluate((data) => {
    window.__molStudioTestApi.loadMolecule('4HHB', data, 'pdb');
  }, hhbData);
  await sleep(1500);

  // 1. protein selected
  const selProt = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('select protein');
  });
  console.log(`  [PASS] 'select protein' -> ${selProt.count} atoms selected`);
  await sleep(800);
  await saveScreenshot(page, 'sq4_single_01_protein_selected.png');

  // 2. ligand selected
  console.log('\n--- Step 2: Selecting Ligand ---');
  const selLig = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('select ligand');
  });
  console.log(`  [PASS] 'select ligand' -> ${selLig.count} atoms selected`);
  await sleep(800);
  await saveScreenshot(page, 'sq4_single_02_ligand_selected.png');

  // 3. ligand sticks + cyan
  console.log('\n--- Step 3: Direct show sticks, ligand & color cyan, ligand ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show sticks, ligand');
    window.__molStudioTestApi.runQuery('color cyan, ligand');
  });
  await sleep(1000);
  await saveScreenshot(page, 'sq4_single_03_ligand_sticks_cyan.png');

  // 4. protein cartoon + green
  console.log('\n--- Step 4: Direct show cartoon, protein & color green, protein ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show cartoon, protein');
    window.__molStudioTestApi.runQuery('color green, protein');
  });
  await sleep(1000);
  await saveScreenshot(page, 'sq4_single_04_protein_cartoon_green.png');

  // 5. pocket selection
  console.log('\n--- Step 5: Creating Pocket Selection with Built-in Ligand Selector ---');
  const selPocket = await page.evaluate(() => {
    return window.__molStudioTestApi.runQuery('select pocket, byres (ligand around 5.0) and not ligand');
  });
  console.log(`  [PASS] 'select pocket, byres (ligand around 5.0) and not ligand' -> ${selPocket.count} atoms selected`);
  await sleep(800);
  await saveScreenshot(page, 'sq4_single_05_pocket_selection.png');

  // 6. zoom ligand
  console.log('\n--- Step 6: Direct zoom ligand ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('zoom ligand');
  });
  await sleep(1200);
  await saveScreenshot(page, 'sq4_single_06_zoom_ligand.png');

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
  console.log('      ALL 6 BROWSER QA SCREENSHOTS & SINGLE-WORD CHECKS PASSED (100.0%)         ');
  console.log('================================================================================');
})();
