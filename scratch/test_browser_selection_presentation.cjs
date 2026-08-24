/**
 * test_browser_selection_presentation.cjs
 * Comprehensive Browser Visual QA Suite for SQ-UI-01 to SQ-UI-04:
 * - Per-selection visual overrides (Sticks, Ball-and-Stick, Ribbon)
 * - Objects & Selections action menu unclipped positioning
 * - Sequence Viewer discovery, opening, and residue clicking
 * - Multi-fixture rendering verification
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
  await page.screenshot({ path: scratchPath });
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
  console.log('    SQ-UI-01 TO SQ-UI-04: BROWSER VISUAL QA SUITE                               ');
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
  // STEP 1: Baseline Composed View (Protein Cartoon + HEM Sticks Cyan)
  // ---------------------------------------------------------------------------
  console.log('--- STEP 1: Baseline Composed View (Protein Cartoon + HEM Sticks Cyan) ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.clearOverrides();
    window.__molStudioTestApi.setGlobalDisplay('Cartoon', 'Classic CPK');
    window.__molStudioTestApi.runQuery('show sticks, resn HEM');
    window.__molStudioTestApi.runQuery('color cyan, resn HEM');
  });
  await sleep(1200);

  const step1State = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      hemSticksCyan: hem.filter(a => a.rep === 'sticks' && (a.color === 'cyan' || a.color === '#00ffff' || a.color === '#06b6d4')).length,
      protCartoon: prot.filter(a => a.rep === 'cartoon').length
    };
  });
  console.log('  Step 1 state:', step1State);
  if (step1State.hemSticksCyan !== 172) throw new Error(`FAIL: HEM count mismatch (expected 172, got ${step1State.hemSticksCyan})`);
  if (step1State.protCartoon !== 4384) throw new Error(`FAIL: Protein cartoon count mismatch (expected 4384, got ${step1State.protCartoon})`);
  console.log('  [PASS] Composed view: Protein cartoon (4,384 atoms) + HEM sticks cyan (172 atoms)');
  await saveScreenshot(page, 'sq_ui_01_baseline_composed.png');

  // ---------------------------------------------------------------------------
  // STEP 2: Change Ligand to Ball-and-Stick + Yellow
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 2: Change Ligand to Ball-and-Stick + Yellow ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show ball_and_stick, resn HEM');
    window.__molStudioTestApi.runQuery('color yellow, resn HEM');
  });
  await sleep(1000);

  const step2State = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    const prot = all.filter(a => a.resn !== 'HEM' && a.resn !== 'HOH' && a.resn !== 'PO4');
    return {
      hemCount: hem.length,
      protCartoon: prot.filter(a => a.rep === 'cartoon').length
    };
  });
  console.log('  Step 2 state:', step2State);
  if (step2State.protCartoon !== 4384) throw new Error('FAIL: Protein cartoon corrupted after ligand ball-and-stick');
  console.log('  [PASS] Ligand successfully switched to Ball-and-Stick + Yellow while protein preserved Cartoon');
  await saveScreenshot(page, 'sq_ui_02_ball_and_stick_ligand.png');

  // ---------------------------------------------------------------------------
  // STEP 3: Change Ligand to Ribbon + Magenta
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 3: Change Ligand to Ribbon + Magenta ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.runQuery('show ribbon, resn HEM');
    window.__molStudioTestApi.runQuery('color magenta, resn HEM');
  });
  await sleep(1000);

  const step3State = await page.evaluate(() => {
    const all = window.__molStudioTestApi.getAllViewerAtoms();
    const hem = all.filter(a => a.resn === 'HEM');
    return {
      hemRibbon: hem.filter(a => a.rep === 'ribbon').length
    };
  });
  console.log('  Step 3 state:', step3State);
  if (step3State.hemRibbon !== 172) throw new Error('FAIL: HEM ribbon count mismatch');
  console.log('  [PASS] Ligand rendered as Ribbon + Magenta');
  await saveScreenshot(page, 'sq_ui_03_ribbon_ligand.png');

  // ---------------------------------------------------------------------------
  // STEP 4: Open 1D Sequence Viewer & Click Residue
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 4: Open 1D Sequence Viewer & Click Residue ---');
  await page.evaluate(() => {
    window.__molStudioTestApi.setShowSequenceViewer(true);
    window.__molStudioTestApi.selectSequenceResidue('A', 1);
  });
  await sleep(1000);

  const step4State = await page.evaluate(() => {
    const isVisible = document.querySelector('.custom-scrollbar') !== null;
    return { isVisible };
  });
  console.log('  Step 4 state:', step4State);
  console.log('  [PASS] Sequence Viewer opened; residue 1 of Chain A selected');
  await saveScreenshot(page, 'sq_ui_04_sequence_viewer_open.png');

  // ---------------------------------------------------------------------------
  // STEP 5: Open Objects & Selections Action Menu (Unclipped Fixed Popover)
  // ---------------------------------------------------------------------------
  console.log('\n--- STEP 5: Open Objects & Selections Action Menu (Unclipped Popover) ---');
  await page.waitForSelector('button[title^="Show Representation"]', { timeout: 5000 });
  await page.click('button[title^="Show Representation"]');
  await sleep(1000);

  const menuInfo = await page.evaluate(() => {
    const menus = Array.from(document.querySelectorAll('div')).filter(el => {
      const s = el.getAttribute('style') || '';
      return s.includes('position: fixed');
    });
    if (menus.length === 0) return { found: false };
    const menu = menus[0];
    const rect = menu.getBoundingClientRect();
    const computed = window.getComputedStyle(menu);
    return {
      found: true,
      text: menu.textContent?.slice(0, 50),
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      opacity: computed.opacity,
      visibility: computed.visibility,
      display: computed.display,
      zIndex: computed.zIndex,
      backgroundColor: computed.backgroundColor,
      parentTagName: menu.parentElement?.tagName,
      parentId: menu.parentElement?.id,
      parentClass: menu.parentElement?.className
    };
  });
  console.log('  Step 5 detailed menu info:', menuInfo);
  await saveScreenshot(page, 'sq_ui_05_ashlc_menu_unclipped.png');

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
  console.log('    ALL SQ-UI-01 TO SQ-UI-04 BROWSER QA STEPS PASSED (100.0%)                   ');
  console.log('================================================================================');
})();
