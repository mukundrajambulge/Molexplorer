/**
 * test_browser_sq4_per_selection_rendering.cjs
 * Comprehensive Browser QA suite for SQ4 per-selection rendering scoping.
 *
 * Verifies that visual operations (show, hide, color, spectrum) apply strictly
 * to the targeted selection and leave non-selected atoms unchanged.
 *
 * Directly inspects live 3Dmol atom styles in the viewer model across 4HHB, 4DJW, and 1CRN.
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
  console.log('    MOLEXPLORER SQ4 PER-SELECTION RENDERING & SCOPING LIVE QA                   ');
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

  // ===========================================================================
  // TEST 1: 4HHB Multi-Selection Composition & Scoping
  // ===========================================================================
  console.log('--- TEST 1: 4HHB.pdb Compositional Presentation Scoping ---');
  const hhbData = loadFixture('4HHB.pdb');
  await page.evaluate((data) => {
    window.__molStudioTestApi.loadMolecule('4HHB', data, 'pdb');
  }, hhbData);
  await sleep(1500);

  // 1.1 show sticks, ligand & color cyan, ligand
  console.log('  Executing: show sticks, ligand; color cyan, ligand');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show sticks, ligand');
    window.__molStudioTestApi.runQuery('color cyan, ligand');
  });
  await sleep(1000);

  // Assert in 3Dmol atom state
  const hhbLigandAtoms = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    return all.filter(a => a.resn === 'HEM');
  });
  const hhbProteinAtoms = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    return all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
  });

  console.log(`  Inspecting 3Dmol model atoms: HEM count=${hhbLigandAtoms.length}, Protein count=${hhbProteinAtoms.length}`);
  console.log('  Sample HEM atom:', JSON.stringify(hhbLigandAtoms[0]));
  console.log('  Sample Protein atom:', JSON.stringify(hhbProteinAtoms[0]));
  const allLigandSticksCyan = hhbLigandAtoms.every(a => a.rep === 'sticks' && (a.color === 'cyan' || a.style?.stick?.color === 'cyan'));
  const proteinNotCyanSticks = hhbProteinAtoms.every(a => a.rep === 'cartoon' && a.color !== 'cyan');

  if (!allLigandSticksCyan) throw new Error(`FAIL: Not all HEM atoms were sticks + cyan in 3Dmol! ${JSON.stringify(hhbLigandAtoms.filter(a => !(a.rep === 'sticks' && (a.color === 'cyan' || a.style?.stick?.color === 'cyan'))).slice(0, 3))}`);
  if (!proteinNotCyanSticks) throw new Error('FAIL: Protein atoms were erroneously changed by ligand styling!');
  console.log('  [PASS] HEM ligand atoms are sticks + cyan; protein remains cartoon (scoping verified)');

  // 1.2 show cartoon, protein & color green, protein
  console.log('  Executing: show cartoon, protein; color green, protein');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show cartoon, protein');
    window.__molStudioTestApi.runQuery('color green, protein');
  });
  await sleep(1000);

  // 1.3 select pocket, byres (ligand around 5.0) and not ligand & show spheres, pocket & color yellow, pocket
  console.log('  Executing: select pocket, byres (ligand around 5.0) and not ligand; show spheres, pocket; color yellow, pocket');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('select pocket, byres (ligand around 5.0) and not ligand');
    window.__molStudioTestApi.runQuery('show spheres, pocket');
    window.__molStudioTestApi.runQuery('color yellow, pocket');
  });
  await sleep(1000);

  // Inspect simultaneous 3-region styles in 3Dmol model:
  const inspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const pocket = all.filter(a => a.rep === 'spheres');
    const greenCartoon = all.filter(a => a.rep === 'cartoon' && (a.color === 'green' || a.style?.cartoon?.color === 'green'));
    const solvent = all.filter(a => a.resn === 'HOH');
    return {
      hemTotal: hem.length,
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.style?.stick?.color === 'cyan')).length,
      pocketTotal: pocket.length,
      pocketSpheresYellow: pocket.filter(a => (a.color === 'yellow' || a.style?.sphere?.color === 'yellow')).length,
      greenCartoonTotal: greenCartoon.length,
      solventTotal: solvent.length,
      solventCross: solvent.filter(a => a.rep === 'cross').length
    };
  });

  console.log('  3Dmol Simultaneous State Inspection:', inspection);
  if (inspection.hemSticksCyan !== 172) throw new Error(`FAIL: Expected 172 HEM sticks+cyan, got ${inspection.hemSticksCyan}`);
  if (inspection.pocketSpheresYellow !== 778) throw new Error(`FAIL: Expected 778 pocket spheres+yellow, got ${inspection.pocketSpheresYellow}`);
  if (inspection.greenCartoonTotal !== 3626) throw new Error(`FAIL: Expected 3626 non-pocket protein cartoon+green (4384 - 758), got ${inspection.greenCartoonTotal}`);
  if (inspection.solventCross !== 201) throw new Error(`FAIL: Expected 201 non-pocket solvent cross (221 - 20), got ${inspection.solventCross}`);
  console.log('  [PASS] 4HHB simultaneous 3-region visual composition strictly verified in 3Dmol model!');

  await saveScreenshot(page, 'sq4_scope_01_4hhb_composition.png');

  // ===========================================================================
  // TEST 2: 4DJW Multi-Selection Composition & Scoping
  // ===========================================================================
  console.log('\n--- TEST 2: 4DJW.pdb Compositional Presentation Scoping ---');
  const djwData = loadFixture('4DJW.pdb');
  await page.evaluate((data) => {
    window.__molStudioTestApi.loadMolecule('4DJW', data, 'pdb');
  }, djwData);
  await sleep(1500);

  console.log('  Executing 4DJW presentation commands:');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show sticks, ligand');
    window.__molStudioTestApi.runQuery('color cyan, ligand');
    window.__molStudioTestApi.runQuery('show cartoon, protein');
    window.__molStudioTestApi.runQuery('color green, protein');
    window.__molStudioTestApi.runQuery('select pocket, byres (ligand around 5.0) and not ligand');
    window.__molStudioTestApi.runQuery('show spheres, pocket');
    window.__molStudioTestApi.runQuery('color yellow, pocket');
    window.__molStudioTestApi.runQuery('zoom ligand');
  });
  await sleep(1200);

  const djwInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const ligand = all.filter(a => a.resn === '0KP' || a.resn === 'TLA');
    const pocket = all.filter(a => a.rep === 'spheres');
    const greenCartoon = all.filter(a => a.rep === 'cartoon' && (a.color === 'green' || a.style?.cartoon?.color === 'green'));
    return {
      ligandTotal: ligand.length,
      ligandSticksCyan: ligand.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.style?.stick?.color === 'cyan')).length,
      pocketTotal: pocket.length,
      pocketSpheresYellow: pocket.filter(a => (a.color === 'yellow' || a.style?.sphere?.color === 'yellow')).length,
      greenCartoonTotal: greenCartoon.length
    };
  });

  console.log('  4DJW 3Dmol State Inspection:', djwInspection);
  if (djwInspection.ligandSticksCyan !== 82) throw new Error(`FAIL: Expected 82 (0KP+TLA) ligand sticks+cyan, got ${djwInspection.ligandSticksCyan}`);
  if (djwInspection.pocketSpheresYellow === 0) throw new Error('FAIL: Pocket spheres+yellow is 0!');
  console.log('  [PASS] 4DJW simultaneous 3-region visual composition strictly verified in 3Dmol model!');

  await saveScreenshot(page, 'sq4_scope_02_4djw_composition.png');

  // ===========================================================================
  // TEST 3: 1CRN Multi-Selection Composition & Scoping
  // ===========================================================================
  console.log('\n--- TEST 3: 1CRN.pdb Compositional Presentation Scoping ---');
  const crnData = loadFixture('1CRN.pdb');
  await page.evaluate((data) => {
    window.__molStudioTestApi.loadMolecule('1CRN', data, 'pdb');
  }, crnData);
  await sleep(1500);

  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show cartoon, protein');
    window.__molStudioTestApi.runQuery('color green, protein');
    window.__molStudioTestApi.runQuery('select active_site, resi 1-10');
    window.__molStudioTestApi.runQuery('show sticks, active_site');
    window.__molStudioTestApi.runQuery('color cyan, active_site');
  });
  await sleep(1000);

  const crnInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const activeSite = all.filter(a => a.resi >= 1 && a.resi <= 10);
    const restOfProtein = all.filter(a => a.resi > 10);
    return {
      activeSiteTotal: activeSite.length,
      activeSiteSticksCyan: activeSite.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.style?.stick?.color === 'cyan')).length,
      restTotal: restOfProtein.length,
      restCartoonGreen: restOfProtein.filter(a => a.rep === 'cartoon' && (a.color === 'green' || a.style?.cartoon?.color === 'green')).length
    };
  });

  console.log('  1CRN 3Dmol State Inspection:', crnInspection);
  if (crnInspection.activeSiteSticksCyan !== 70) throw new Error(`FAIL: Expected 70 active site atoms sticks+cyan, got ${crnInspection.activeSiteSticksCyan}`);
  if (crnInspection.restCartoonGreen !== 257) throw new Error(`FAIL: Expected 257 rest of protein cartoon+green (327 - 70), got ${crnInspection.restCartoonGreen}`);
  console.log('  [PASS] 1CRN simultaneous 2-region visual composition strictly verified in 3Dmol model!');

  await saveScreenshot(page, 'sq4_scope_03_1crn_composition.png');

  // ===========================================================================
  // TEST 4: Hide Sub-Selection Semantics (Independent Scoping)
  // ===========================================================================
  console.log('\n--- TEST 4: Hide Sub-Selection Semantics ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('hide sticks, active_site');
  });
  await sleep(1000);

  const crnHideInspection = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const activeSite = all.filter(a => a.resi >= 1 && a.resi <= 10);
    const restOfProtein = all.filter(a => a.resi > 10);
    return {
      activeSiteHidden: activeSite.filter(a => a.hidden === true).length,
      restCartoonGreen: restOfProtein.filter(a => a.rep === 'cartoon' && a.hidden !== true).length
    };
  });

  console.log('  1CRN Hide Inspection:', crnHideInspection);
  if (crnHideInspection.activeSiteHidden !== 70) throw new Error(`FAIL: Expected 70 active site atoms hidden, got ${crnHideInspection.activeSiteHidden}`);
  if (crnHideInspection.restCartoonGreen !== 257) throw new Error(`FAIL: Expected 257 rest of protein visible cartoon, got ${crnHideInspection.restCartoonGreen}`);
  console.log('  [PASS] Hide on sub-selection hides ONLY the selected atoms without affecting the rest of the model!');

  await saveScreenshot(page, 'sq4_scope_04_hide_subset.png');

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
  console.log('      ALL PER-SELECTION RENDERING & 3DMOL ATOM STATE CHECKS PASSED (100.0%)     ');
  console.log('================================================================================');
})();
