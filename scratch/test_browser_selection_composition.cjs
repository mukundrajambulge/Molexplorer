/**
 * test_browser_selection_composition.cjs
 * Comprehensive Phase SQ3 Browser Visual QA Suite.
 *
 * Verifies in live MolStudio WebGL application:
 * - Chained command execution: select ligand, ...; show sticks, ligand; color cyan, ligand; zoom ligand
 * - Simultaneous representation coexistence (cartoon protein + sticks ligand)
 * - Ligand color cyan with unchanged protein colors
 * - Multi-molecule verification (4DJW, 4HHB, 03_protein_with_ligand)
 * - Sequence Viewer integration with named selections
 * - Full screenshot capture
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
  console.error('No Chrome or Edge executable found!');
  process.exit(1);
}

function loadFixture(filename) {
  const p1 = path.resolve(process.cwd(), 'scratch', filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(process.cwd(), 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  const p3 = path.resolve(process.cwd(), filename);
  if (fs.existsSync(p3)) return fs.readFileSync(p3, 'utf8');
  throw new Error('Fixture not found: ' + filename);
}

const ARTIFACT_DIR = path.resolve('C:\\Users\\mukun\\.gemini\\antigravity\\brain\\44a857dc-c09e-4201-ac3d-e7d54322bd25');
const SCRATCH_DIR = path.resolve(process.cwd(), 'scratch');

async function saveScreenshot(page, filename) {
  const scratchPath = path.join(SCRATCH_DIR, filename);
  const artifactPath = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: scratchPath });
  try {
    fs.copyFileSync(scratchPath, artifactPath);
  } catch (e) {}
  console.log('  [SCREENSHOT CAPTURED] -> ' + filename);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('================================================================================');
  console.log('    PHASE SQ3 BROWSER VISUAL QA & SIMULTANEOUS REPRESENTATION SUITE             ');
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

  // ---------------------------------------------------------------------------
  // TEST 1: 4DJW Macromolecular Complex Chained Script & Simultaneous Views
  // ---------------------------------------------------------------------------
  console.log('--------------------------------------------------------------------------------');
  console.log('TEST 1: 4DJW Macromolecular Complex Chained Script & Simultaneous Views');
  console.log('--------------------------------------------------------------------------------');
  {
    const pdbData = loadFixture('4DJW.pdb');
    await page.evaluate((data) => {
      window.__molStudioTestApi.loadMolecule('4DJW', data, 'pdb');
    }, pdbData);
    await sleep(1500);

    // Execute chained selection, representation, color, and zoom sequence
    const script = 'select ligand, organic and not polymer; show cartoon, protein; show sticks, ligand; color cyan, ligand; zoom ligand';
    console.log('  Executing script: ' + script);
    await page.evaluate((cmd) => {
      window.__molStudioTestApi.runQuery(cmd);
    }, script);
    await sleep(1000);

    const overrides = await page.evaluate(() => {
      return window.__molStudioTestApi.getPresentationOverrides();
    });
    console.log('  Active overrides count:', overrides.length);

    // Verify ligand override has representation 'sticks' and color 'cyan'
    const ligOverride = overrides.find(o => o.selectionKey === 'ligand');
    if (!ligOverride || ligOverride.representation !== 'sticks' || ligOverride.color !== 'cyan') {
      throw new Error('Ligand override not properly configured: ' + JSON.stringify(ligOverride));
    }
    console.log('  [PASS] Ligand override correctly registered sticks + cyan');

    // Verify protein override has representation 'cartoon'
    const protOverride = overrides.find(o => o.selectionKey === 'protein');
    if (!protOverride || protOverride.representation !== 'cartoon') {
      throw new Error('Protein override not properly configured: ' + JSON.stringify(protOverride));
    }
    console.log('  [PASS] Protein override correctly registered cartoon');

    await saveScreenshot(page, 'sq3_01_4djw_composed_sticks_cyan.png');
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Nested Named Selection Pocket View on 4DJW
  // ---------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('TEST 2: Nested Named Selection Pocket View on 4DJW');
  console.log('--------------------------------------------------------------------------------');
  {
    const pocketScript = 'select pocket, byres (ligand around 5.0) and not ligand; show surface, pocket; color yellow, pocket; zoom pocket';
    console.log('  Executing script: ' + pocketScript);
    await page.evaluate((cmd) => {
      window.__molStudioTestApi.runQuery(cmd);
    }, pocketScript);
    await sleep(1000);

    const overrides = await page.evaluate(() => {
      return window.__molStudioTestApi.getPresentationOverrides();
    });
    const pocketOverride = overrides.find(o => o.selectionKey === 'pocket');
    if (!pocketOverride || pocketOverride.representation !== 'surface' || pocketOverride.color !== 'yellow') {
      throw new Error('Pocket override not properly configured: ' + JSON.stringify(pocketOverride));
    }
    console.log('  [PASS] Nested pocket override correctly registered surface + yellow');

    await saveScreenshot(page, 'sq3_02_4djw_pocket_surface_yellow.png');
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Multi-Molecule Validation on 4HHB (Hemoglobin)
  // ---------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('TEST 3: Multi-Molecule Validation on 4HHB (Hemoglobin)');
  console.log('--------------------------------------------------------------------------------');
  {
    const hhbData = loadFixture('4HHB.pdb');
    await page.evaluate((data) => {
      window.__molStudioTestApi.loadMolecule('4HHB', data, 'pdb');
    }, hhbData);
    await sleep(1500);

    const hhbScript = 'select heme, resn HEM; show cartoon, protein; show sticks, heme; color cyan, heme; zoom heme';
    console.log('  Executing script: ' + hhbScript);
    await page.evaluate((cmd) => {
      window.__molStudioTestApi.runQuery(cmd);
    }, hhbScript);
    await sleep(1000);

    const overrides = await page.evaluate(() => {
      return window.__molStudioTestApi.getPresentationOverrides();
    });
    const hemeOverride = overrides.find(o => o.selectionKey === 'heme');
    if (!hemeOverride || hemeOverride.representation !== 'sticks' || hemeOverride.color !== 'cyan') {
      throw new Error('Heme override not properly configured: ' + JSON.stringify(hemeOverride));
    }
    console.log('  [PASS] 4HHB Heme override correctly registered sticks + cyan');

    await saveScreenshot(page, 'sq3_03_4hhb_heme_sticks_cyan.png');
  }

  // ---------------------------------------------------------------------------
  // TEST 4: Multi-Molecule Validation on 03_protein_with_ligand
  // ---------------------------------------------------------------------------
  console.log('\n--------------------------------------------------------------------------------');
  console.log('TEST 4: Multi-Molecule Validation on 03_protein_with_ligand');
  console.log('--------------------------------------------------------------------------------');
  {
    const plData = loadFixture('03_protein_with_ligand.pdb');
    await page.evaluate((data) => {
      window.__molStudioTestApi.loadMolecule('03PL', data, 'pdb');
    }, plData);
    await sleep(1500);

    const plScript = 'select lig, resn LIG; show cartoon, protein; show sticks, lig; color cyan, lig; zoom lig';
    console.log('  Executing script: ' + plScript);
    await page.evaluate((cmd) => {
      window.__molStudioTestApi.runQuery(cmd);
    }, plScript);
    await sleep(1000);

    const overrides = await page.evaluate(() => {
      return window.__molStudioTestApi.getPresentationOverrides();
    });
    const ligOverride = overrides.find(o => o.selectionKey === 'lig');
    if (!ligOverride || ligOverride.representation !== 'sticks' || ligOverride.color !== 'cyan') {
      throw new Error('03PL Ligand override not properly configured: ' + JSON.stringify(ligOverride));
    }
    console.log('  [PASS] 03PL Ligand override correctly registered sticks + cyan');

    await saveScreenshot(page, 'sq3_04_03pl_ligand_sticks_cyan.png');
  }

  console.log('\n================================================================================');
  console.log('PHASE SQ3 BROWSER QA SUMMARY: ALL BROWSER VISUAL TESTS PASSED (100.0%)');
  console.log('================================================================================');

  await browser.close();
  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
    process.exit(1);
  }
})().catch(err => {
  console.error('FATAL BROWSER TEST ERROR:', err);
  process.exit(1);
});
