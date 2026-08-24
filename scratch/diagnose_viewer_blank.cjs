/**
 * diagnose_viewer_blank.cjs
 * Comprehensive Phase SQ-V0 Viewer / Scientific-State Convergence Recovery Diagnostic Suite.
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Users\\mukun\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome executable not found');
}

function loadFixturePdb(filename) {
  const p1 = path.resolve(__dirname, filename);
  if (fs.existsSync(p1)) return fs.readFileSync(p1, 'utf8');
  const p2 = path.resolve(__dirname, '..', 'fixtures', filename);
  if (fs.existsSync(p2)) return fs.readFileSync(p2, 'utf8');
  throw new Error(`Fixture not found: ${filename}`);
}

async function runDiagnostics() {
  console.log('================================================================================');
  console.log('       PHASE SQ-V0: 3D VIEWPORT BLANK CANVAS DIAGNOSTIC HARNESS                 ');
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu-sandbox']
  });

  const page = await browser.newPage();
  
  // Collect console logs and errors from browser
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' || text.includes('3Dmol') || text.includes('Error') || text.includes('warning')) {
      console.log(`  [Browser ${msg.type().toUpperCase()}] ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`  [Browser UNCAUGHT EXCEPTION] ${err.message}`);
  });

  try {
    console.log('[STEP 1] Navigating to MolStudio...');
    await page.goto('http://127.0.0.1:5173/molstudio', { waitUntil: 'networkidle0', timeout: 30000 });
    console.log('  -> MolStudio page loaded.');

    // Wait for __molStudioTestApi
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined', { timeout: 10000 });

    // ---------------------------------------------------------------------------------
    // STEP 6.A: Load 4HHB (No console commands)
    // ---------------------------------------------------------------------------------
    console.log('\n[STEP 6.A] Loading 4HHB fixture (4779 atoms)...');
    const hhbPdb = loadFixturePdb('4HHB.pdb');
    
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4HHB', pdbText, 'pdb');
    }, hhbPdb);

    // Give 500ms for React state and 3Dmol render effect
    await new Promise(r => setTimeout(r, 600));

    // Inspect Scientific State & Viewer State
    const diag4HHB = await page.evaluate(() => {
      const canon = window.__molStudioTestApi.getCanonicalState();
      const viewerState = window.__molStudioTestApi.getViewerState();
      const appState = window.__molStudioTestApi.getState();

      // Inspect WebGL canvas element directly
      const canvas = document.querySelector('canvas');
      const canvasInfo = canvas ? {
        width: canvas.width,
        height: canvas.height,
        clientWidth: canvas.clientWidth,
        clientHeight: canvas.clientHeight,
        style: canvas.getAttribute('style')
      } : null;

      // Inspect 3Dmol viewer internal models and styles
      let internal3Dmol = null;
      if (window.$3Dmol) {
        // Find viewer instance
      }

      return {
        canon,
        viewerState,
        appState,
        canvasInfo
      };
    });

    console.log('--- 4HHB Scientific State ---');
    console.log(`  Atom Count: ${diag4HHB.canon?.atomCount} (Expected: 4779)`);
    console.log(`  Bond Count: ${diag4HHB.canon?.bondCount}`);
    console.log(`  Residues: ${diag4HHB.canon?.residueCount}, Chains: ${diag4HHB.canon?.chainCount}`);
    console.log(`  State Hash: ${diag4HHB.canon?.canonicalStateHash}`);

    console.log('--- 4HHB Viewer & Canvas State ---');
    console.log(`  Viewer Atom Count: ${diag4HHB.viewerState?.atomCount}`);
    console.log(`  Canvas Dimensions: ${JSON.stringify(diag4HHB.canvasInfo)}`);
    console.log(`  App State Atoms Count: ${diag4HHB.appState?.atomsCount}`);
    console.log(`  Render Style: ${diag4HHB.appState?.renderStyle}`);
    console.log(`  Color Scheme: ${diag4HHB.appState?.colorScheme}`);

    const screenshot4HHB = path.resolve(__dirname, 'sq_v0_4hhb_initial.png');
    await page.screenshot({ path: screenshot4HHB });
    console.log(`  -> Screenshot saved: ${screenshot4HHB}`);

    // Check camera and representation
    const cameraCheck = await page.evaluate(() => {
      // Try calling zoomTo and render directly on viewer
      const vEl = document.querySelector('.absolute.inset-0.z-0');
      return {
        vElHtml: vEl ? vEl.innerHTML.slice(0, 300) : 'none'
      };
    });
    console.log(`  Container Element HTML: ${cameraCheck.vElHtml}`);

    // ---------------------------------------------------------------------------------
    // STEP 6.B: Load 1CRN
    // ---------------------------------------------------------------------------------
    console.log('\n[STEP 6.B] Loading 1CRN fixture (327 atoms)...');
    const crnPdb = loadFixturePdb('1CRN.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('1CRN', pdbText, 'pdb');
    }, crnPdb);
    await new Promise(r => setTimeout(r, 600));

    const diag1CRN = await page.evaluate(() => {
      return {
        canon: window.__molStudioTestApi.getCanonicalState(),
        viewerState: window.__molStudioTestApi.getViewerState(),
        appState: window.__molStudioTestApi.getState()
      };
    });
    console.log(`  1CRN Scientific: ${diag1CRN.canon?.atomCount} atoms, Viewer: ${diag1CRN.viewerState?.atomCount} atoms`);
    const screenshot1CRN = path.resolve(__dirname, 'sq_v0_1crn_initial.png');
    await page.screenshot({ path: screenshot1CRN });

    // ---------------------------------------------------------------------------------
    // STEP 6.C: Load 4DJW
    // ---------------------------------------------------------------------------------
    console.log('\n[STEP 6.C] Loading 4DJW fixture (7079 atoms)...');
    const djwPdb = loadFixturePdb('4DJW.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4DJW', pdbText, 'pdb');
    }, djwPdb);
    await new Promise(r => setTimeout(r, 1000));

    const diag4DJW = await page.evaluate(() => {
      return {
        canon: window.__molStudioTestApi.getCanonicalState(),
        viewerState: window.__molStudioTestApi.getViewerState(),
        appState: window.__molStudioTestApi.getState()
      };
    });
    console.log(`  4DJW Scientific: ${diag4DJW.canon?.atomCount} atoms, Viewer: ${diag4DJW.viewerState?.atomCount} atoms`);
    const screenshot4DJW = path.resolve(__dirname, 'sq_v0_4djw_initial.png');
    await page.screenshot({ path: screenshot4DJW });

    // ---------------------------------------------------------------------------------
    // STEP 6.D - 6.G: Console Command Sequence on 03PL / 4HHB
    // ---------------------------------------------------------------------------------
    console.log('\n[STEP 6.D] Loading 03PL and executing queries...');
    const plPdb = loadFixturePdb('03_protein_with_ligand.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('03PL', pdbText, 'pdb');
    }, plPdb);
    await new Promise(r => setTimeout(r, 600));

    console.log('  [Query] select all, all');
    const q1 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select all, all'));
    console.log(`  -> Result: count=${q1.count}, text="${q1.textOutput}"`);

    console.log('  [Query] select ligand, resn LIG');
    const q2 = await page.evaluate(() => window.__molStudioTestApi.runQuery('select ligand, resn LIG'));
    console.log(`  -> Result: count=${q2.count}, text="${q2.textOutput}"`);

    console.log('  [Query] show sticks, ligand');
    const q3 = await page.evaluate(() => window.__molStudioTestApi.runQuery('show sticks, ligand'));
    console.log(`  -> Result: count=${q3.count}, text="${q3.textOutput}"`);

    console.log('  [Query] color yellow, ligand');
    const q4 = await page.evaluate(() => window.__molStudioTestApi.runQuery('color yellow, ligand'));
    console.log(`  -> Result: count=${q4.count}, text="${q4.textOutput}"`);

    await new Promise(r => setTimeout(r, 600));
    const screenshotFinal = path.resolve(__dirname, 'sq_v0_03pl_queries.png');
    await page.screenshot({ path: screenshotFinal });
    console.log(`  -> Screenshot saved: ${screenshotFinal}`);

  } catch (err) {
    console.error('Fatal error during SQ-V0 diagnostics:', err);
  } finally {
    await browser.close();
  }
}

runDiagnostics();
