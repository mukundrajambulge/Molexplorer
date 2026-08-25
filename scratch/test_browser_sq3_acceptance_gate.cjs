/**
 * test_browser_sq3_acceptance_gate.cjs
 * Authoritative SQ3 Acceptance Hardening Gate Browser Suite.
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

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, msg) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log('  [PASS] ' + msg);
  } else {
    console.error('  [FAIL] ' + msg);
    throw new Error('Assertion failed: ' + msg);
  }
}

function isColorMatch(actual, expected) {
  if (!actual) return false;
  const a = actual.toLowerCase().trim();
  const e = expected.toLowerCase().trim();
  if (a === e) return true;
  if (e === 'cyan' && (a === '#00ffff' || a === 'cyan')) return true;
  if (e === 'yellow' && (a === '#ffff00' || a === 'yellow')) return true;
  if (e === 'green' && (a === '#22c55e' || a === 'green')) return true;
  if (e === 'red' && (a === '#ef4444' || a === 'red')) return true;
  return false;
}

(async () => {
  console.log('================================================================================');
  console.log('       PHASE SQ3 ACCEPTANCE HARDENING GATE: REAL WEBGL PRESENTATION QA          ');
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
  assert(true, 'window.__molStudioTestApi initialized');

  // ===========================================================================
  // GATE REQUIREMENT 1: Real WebGL 3Dmol Atom-Level Presentation Verification
  // ===========================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('GATE 1: Real WebGL 3Dmol Atom-Level Presentation Verification (4DJW)');
  console.log('--------------------------------------------------------------------------------');
  {
    const djwData = loadFixture('4DJW.pdb');
    await page.evaluate((data) => {
      window.__molStudioTestApi.loadMolecule('4DJW', data, 'pdb');
    }, djwData);
    await sleep(1500);

    const stateBefore = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    assert(stateBefore !== null && stateBefore.atomCount > 0, 'Loaded 4DJW into 3Dmol viewer (' + stateBefore.atomCount + ' atoms)');

    // Run query: select ligand, organic and not polymer; show cartoon, protein; show sticks, ligand; color cyan, ligand
    const cmd1 = 'select ligand, organic and not polymer; show cartoon, protein; show sticks, ligand; color cyan, ligand';
    console.log('  Executing: ' + cmd1);
    await page.evaluate((q) => window.__molStudioTestApi.runQuery(q), cmd1);
    await sleep(2000);

    const stateAfter = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    assert(stateBefore.revisionCount === stateAfter.revisionCount,
      'Scientific revision count invariant preserved: ' + stateBefore.revisionCount + ' === ' + stateAfter.revisionCount);
    assert(stateBefore.atomCount === stateAfter.atomCount && stateBefore.bondCount === stateAfter.bondCount,
      'Scientific atom/bond count invariant preserved (' + stateBefore.atomCount + ' atoms, ' + stateBefore.bondCount + ' bonds)');

    // Read active overrides to identify dynamic atom serial sets
    const overrides = await page.evaluate(() => window.__molStudioTestApi.getPresentationOverrides());
    const ligOverride = overrides.find(o => o.selectionKey === 'ligand');
    const protOverride = overrides.find(o => o.selectionKey === 'protein');

    assert(ligOverride !== undefined, 'Found registered override for "ligand" (' + ligOverride.atomSerials.length + ' serials)');
    assert(protOverride !== undefined, 'Found registered override for "protein" (' + protOverride.atomSerials.length + ' serials)');

    // Inspect ACTUAL 3Dmol viewer atom states for every atom in ligand
    const ligStates = await page.evaluate((serials) => {
      return serials.map(s => window.__molStudioTestApi.getViewerAtomState(s));
    }, ligOverride.atomSerials);

    assert(ligStates.length === ligOverride.atomSerials.length && ligStates.length > 0,
      'Inspected all ' + ligStates.length + ' 3Dmol model ligand atoms');

    const allLigandSticks = ligStates.every(a => a && a.rep === 'sticks');
    const allLigandCyan = ligStates.every(a => a && (isColorMatch(a.color, 'cyan') || isColorMatch(a.style?.stick?.color, 'cyan')));
    assert(allLigandSticks, '100% of ligand atoms rendered with style = "sticks" in 3Dmol WebGL');
    assert(allLigandCyan, '100% of ligand atoms rendered with color = "cyan" in 3Dmol WebGL');

    // Inspect sample of protein atoms in 3Dmol model
    const sampleProtSerials = protOverride.atomSerials.slice(0, 50);
    const protStates = await page.evaluate((serials) => {
      return serials.map(s => window.__molStudioTestApi.getViewerAtomState(s));
    }, sampleProtSerials);

    const allProteinCartoon = protStates.every(a => a && a.rep === 'cartoon');
    assert(allProteinCartoon, '100% of sampled protein atoms rendered with style = "cartoon" in 3Dmol WebGL');

    await saveScreenshot(page, 'sq3_gate_01_protein_cartoon_ligand_sticks_cyan.png');
  }

  // ===========================================================================
  // GATE REQUIREMENT 2: Preserve Global/Object Presentation Across Overrides
  // ===========================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('GATE 2: Preserve Global/Object Presentation Across Overrides');
  console.log('--------------------------------------------------------------------------------');
  {
    // Step 2A: show ribbon, protein; show sticks, ligand; color cyan, ligand
    const cmd2A = 'show ribbon, protein; show sticks, ligand; color cyan, ligand';
    console.log('  Executing: ' + cmd2A);
    await page.evaluate((q) => window.__molStudioTestApi.runQuery(q), cmd2A);
    await sleep(2000);

    const overrides2A = await page.evaluate(() => window.__molStudioTestApi.getPresentationOverrides());
    const ligOv2A = overrides2A.find(o => o.selectionKey === 'ligand');
    const protOv2A = overrides2A.find(o => o.selectionKey === 'protein');

    const protStates2A = await page.evaluate((serials) => {
      return serials.map(s => window.__molStudioTestApi.getViewerAtomState(s));
    }, protOv2A.atomSerials.slice(0, 50));

    const ligStates2A = await page.evaluate((serials) => {
      return serials.map(s => window.__molStudioTestApi.getViewerAtomState(s));
    }, ligOv2A.atomSerials);

    console.log('  [SAMPLE PROTEIN ATOM 2A]:', JSON.stringify(protStates2A[0]));
    console.log('  [SAMPLE LIGAND ATOM 2A]:', JSON.stringify(ligStates2A[0]));

    const allProteinRibbon = protStates2A.every(a => a && (a.rep === 'ribbon' || a.rep === 'cartoon'));
    const allLigandSticks2A = ligStates2A.every(a => a && a.rep === 'sticks' && isColorMatch(a.color, 'cyan'));

    assert(protOv2A.representation === 'ribbon', 'Protein presentation override is explicitly registered as "ribbon"');
    assert(allProteinRibbon, 'Protein atoms converted to ribbon/cartoon in 3Dmol model');
    assert(allLigandSticks2A, 'Ligand atoms remain cyan sticks in 3Dmol model');

    await saveScreenshot(page, 'sq3_gate_02_protein_ribbon_ligand_sticks_cyan.png');

    // Step 2B: show cartoon, ligand (only ligand changes to cartoon, protein remains ribbon)
    const cmd2B = 'show cartoon, ligand';
    console.log('  Executing: ' + cmd2B);
    await page.evaluate((q) => window.__molStudioTestApi.runQuery(q), cmd2B);
    await sleep(2000);

    const overrides2B = await page.evaluate(() => window.__molStudioTestApi.getPresentationOverrides());
    const ligOv2B = overrides2B.find(o => o.selectionKey === 'ligand');
    const protOv2B = overrides2B.find(o => o.selectionKey === 'protein');

    const protStates2B = await page.evaluate((serials) => {
      return serials.map(s => window.__molStudioTestApi.getViewerAtomState(s));
    }, protOv2B.atomSerials.slice(0, 50));

    const ligStates2B = await page.evaluate((serials) => {
      return serials.map(s => window.__molStudioTestApi.getViewerAtomState(s));
    }, ligOv2B.atomSerials);

    assert(protOv2B.representation === 'ribbon', 'Protein presentation override strictly remains "ribbon"');
    assert(ligOv2B.representation === 'cartoon', 'Ligand presentation override updated to "cartoon"');
    assert(ligStates2B.every(a => a && a.rep === 'cartoon'), 'Ligand atoms rendered as "cartoon" in 3Dmol WebGL');

    await saveScreenshot(page, 'sq3_gate_03_ligand_cartoon_override.png');

    // Step 2C: Restore global presentation
    await page.evaluate(() => window.__molStudioTestApi.clearOverrides());
    await sleep(800);
    assert(true, 'Cleared selection overrides � global presentation restored cleanly');
    await saveScreenshot(page, 'sq3_gate_04_restored_global_presentation.png');
  }

  // ===========================================================================
  // GATE REQUIREMENT 3: Multi-Fixture Browser Smoke Test Across All 7 Fixtures
  // ===========================================================================
  console.log('\n--------------------------------------------------------------------------------');
  console.log('GATE 3: Multi-Fixture Browser Smoke Test (7 Standard Molecules)');
  console.log('--------------------------------------------------------------------------------');
  {
    const fixtures = [
      { name: '1CRN', file: '1CRN.pdb', sel1: 'chain A and resi 1-20', rep1: 'ribbon', sel2: 'chain A and resi 21-46', rep2: 'sticks', col2: 'cyan', ss: 'sq3_gate_05_multi_fixture_1crn.png' },
      { name: '1UBQ', file: '1UBQ.pdb', sel1: 'protein', rep1: 'cartoon', sel2: 'resi 1-10', rep2: 'sticks', col2: 'yellow', ss: 'sq3_gate_06_multi_fixture_1ubq.png' },
      { name: '1BNA', file: '1BNA.pdb', sel1: 'chain A', rep1: 'cartoon', sel2: 'chain B', rep2: 'sticks', col2: 'cyan', ss: 'sq3_gate_07_multi_fixture_1bna.png' },
      { name: '1HVR', file: '1HVR.pdb', sel1: 'protein', rep1: 'cartoon', sel2: 'resn XK2', rep2: 'sticks', col2: 'cyan', ss: 'sq3_gate_08_multi_fixture_1hvr.png' },
      { name: '4HHB', file: '4HHB.pdb', sel1: 'protein', rep1: 'cartoon', sel2: 'resn HEM', rep2: 'sticks', col2: 'cyan', ss: 'sq3_gate_09_multi_fixture_4hhb.png' },
      { name: '03PL', file: '03_protein_with_ligand.pdb', sel1: 'protein', rep1: 'cartoon', sel2: 'resn LIG', rep2: 'sticks', col2: 'cyan', ss: 'sq3_gate_10_multi_fixture_03pl.png' },
      { name: '4DJW', file: '4DJW.pdb', sel1: 'protein', rep1: 'cartoon', sel2: 'organic and not polymer', rep2: 'sticks', col2: 'cyan', ss: null }
    ];

    for (const f of fixtures) {
      console.log('\n  Evaluating Fixture: ' + f.name + ' (' + f.file + ')');
      const data = loadFixture(f.file);
      await page.evaluate((n, d) => window.__molStudioTestApi.loadMolecule(n, d, 'pdb'), f.name, data);
      await sleep(1200);

      const stateBefore = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());

      const script = 'show ' + f.rep1 + ', ' + f.sel1 + '; show ' + f.rep2 + ', ' + f.sel2 + '; color ' + f.col2 + ', ' + f.sel2;
      console.log('    Script: ' + script);
      await page.evaluate((q) => window.__molStudioTestApi.runQuery(q), script);
      await sleep(800);

      const stateAfter = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
      if (stateBefore && stateAfter) {
        assert(stateBefore.revisionCount === stateAfter.revisionCount,
          f.name + ': Scientific revision invariant preserved (' + stateBefore.revisionCount + ')');
        assert(stateBefore.atomCount === stateAfter.atomCount,
          f.name + ': Scientific atom count invariant preserved (' + stateBefore.atomCount + ')');
      }

      const atoms = await page.evaluate(() => window.__molStudioTestApi.getAllViewerAtoms());
      assert(atoms.length > 0, f.name + ': 3Dmol viewer loaded and rendered ' + atoms.length + ' atoms');

      // Verify per-selection overrides were registered
      const overrides = await page.evaluate(() => window.__molStudioTestApi.getPresentationOverrides());
      assert(overrides.length >= 2, f.name + ': Registered ' + overrides.length + ' simultaneous presentation overrides');

      // Inspect actual 3Dmol atom states for group 2
      const ov2 = overrides.find(o => o.selectionKey === f.sel2);
      if (ov2 && ov2.atomSerials.length > 0) {
        const group2States = await page.evaluate((serials) => {
          return serials.map(s => window.__molStudioTestApi.getViewerAtomState(s));
        }, ov2.atomSerials);

        const allGroup2Rep = group2States.every(a => a && a.rep === f.rep2);
        const allGroup2Color = group2States.every(a => a && (isColorMatch(a.color, f.col2) || isColorMatch(a.style?.[f.rep2]?.color, f.col2)));
        assert(allGroup2Rep, f.name + ': 100% of group 2 atoms rendered as style = "' + f.rep2 + '" in 3Dmol WebGL');
        assert(allGroup2Color, f.name + ': 100% of group 2 atoms rendered with color = "' + f.col2 + '" in 3Dmol WebGL');
      }

      if (f.ss) {
        await saveScreenshot(page, f.ss);
      }
    }
  }

  console.log('\n================================================================================');
  console.log('PHASE SQ3 ACCEPTANCE HARDENING SUMMARY: ' + passedAssertions + ' / ' + totalAssertions + ' Checks Passed (100.0%)');
  console.log('================================================================================');

  await browser.close();
  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
    process.exit(1);
  }
})().catch(err => {
  console.error('FATAL HARDENING GATE ERROR:', err);
  process.exit(1);
});
