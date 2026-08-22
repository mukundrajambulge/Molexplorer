/**
 * P4.3: Live Browser Verification — Visual / Scientific State Synchronization & Convergence QA
 * Validates unidirectional synchronization between 3Dmol viewer, MolProcessor, and Canonical Revision Engine.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\e43f6ae3-6d0c-44fd-ae3d-9abd3e716b18';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const FIXTURE_PATH = path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb');
const FIXTURE_PDB = fs.readFileSync(FIXTURE_PATH, 'utf8');

let totalSteps = 0;
let passedSteps = 0;
const latencyLogs = [];

async function step(name, fn) {
  totalSteps++;
  console.log(`\n[STEP ${totalSteps}] ${name}`);
  const t0 = Date.now();
  try {
    await fn();
    const dt = Date.now() - t0;
    passedSteps++;
    latencyLogs.push({ step: totalSteps, name, latencyMs: dt });
    console.log(`  -> PASSED (${dt}ms)`);
  } catch (err) {
    console.error(`  -> FAILED: ${err.message}`);
    throw err;
  }
}

async function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`[ASSERT] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`  [✓] ${label}: ${actual}`);
}

async function assertTruthy(label, val) {
  if (!val) throw new Error(`[ASSERT] ${label}: expected truthy, got ${JSON.stringify(val)}`);
  console.log(`  [✓] ${label}`);
}

async function shot(page, name) {
  const p = path.join(SCREENSHOT_DIR, name);
  await page.screenshot({ path: p });
  console.log(`  -> Screenshot: ${p}`);
}

async function waitMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  console.log('================================================================================');
  console.log(' TASK P4.3: LIVE BROWSER VISUAL/SCIENTIFIC SYNCHRONIZATION CONVERGENCE QA       ');
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', err => console.error('[PAGEERROR STACK]', err.stack || err.message));
  page.on('dialog', async d => { await d.dismiss(); });

  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
  await waitMs(2000);

  // ── Step 1 & 2: Load fixture & capture baseline ────────────────────────────
  await step("1-2. Load fixture & verify baseline convergence (3Dmol == Processor == Canonical)", async () => {
    await page.evaluate((pdb) => {
      window.__molStudioTestApi.loadMolecule('03_protein_with_ligand.pdb', pdb, 'pdb');
    }, FIXTURE_PDB);
    await waitMs(2000);

    const appState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const canonicalState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    const viewerState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());

    await assertEqual("App state atom count", appState.atomsCount, 20);
    await assertEqual("Canonical atom count", canonicalState.atomCount, 20);
    await assertEqual("Canonical bond count", canonicalState.bondCount, 19);

    if (viewerState) {
      await assertEqual("3Dmol viewer atom count", viewerState.atomCount, 20);
      // Verify coordinate transport tolerance <= 0.001 Å
      for (let i = 0; i < canonicalState.atoms.length; i++) {
        const cAtom = canonicalState.atoms[i];
        const vAtom = viewerState.atoms[i];
        if (vAtom) {
          const dx = Math.abs(cAtom.x - vAtom.x);
          const dy = Math.abs(cAtom.y - vAtom.y);
          const dz = Math.abs(cAtom.z - vAtom.z);
          assertTruthy(`Atom ${cAtom.canonical_id} coordinate tolerance <= 0.001 Å`, dx <= 0.001001 && dy <= 0.001001 && dz <= 0.001001);
        }
      }
    }

    await shot(page, 'conv_01_baseline.png');
  });

  // ── Step 3 & 4: Remove id 20 ───────────────────────────────────────────────
  let r1Hash = null;
  let r1RevId = null;
  await step("3-4. Execute remove id 20 & verify 3-way synchronization (atoms 20 -> 19)", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('remove id 20'); });
    await waitMs(1500);

    const appState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const canonicalState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    const viewerState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());

    await assertEqual("App state atoms after remove", appState.atomsCount, 19);
    await assertEqual("Canonical state atoms after remove", canonicalState.atomCount, 19);
    if (viewerState) {
      await assertEqual("Viewer atoms after remove", viewerState.atomCount, 19);
      assertTruthy("Atom 20 absent in viewer", !viewerState.atoms.some(a => a.serial === 20));
    }

    r1Hash = canonicalState.canonicalStateHash;
    r1RevId = canonicalState.activeRevisionId;
    assertTruthy("Revision R1 created", r1RevId !== null);
    assertTruthy("State hash exists at R1", r1Hash !== null);

    await shot(page, 'conv_02_remove.png');
  });

  // ── Step 5 & 6: Undo ───────────────────────────────────────────────────────
  await step("5-6. Undo & verify full rollback convergence to R0 (19 -> 20 atoms)", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('undo'); });
    await waitMs(1500);

    const appState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const canonicalState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    const viewerState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());

    await assertEqual("App state atoms after undo", appState.atomsCount, 20);
    await assertEqual("Canonical atoms after undo", canonicalState.atomCount, 20);
    if (viewerState) {
      await assertEqual("Viewer atoms after undo", viewerState.atomCount, 20);
      assertTruthy("Atom 20 restored in viewer", viewerState.atoms.some(a => a.serial === 20));
    }

    await shot(page, 'conv_03_undo.png');
  });

  // ── Step 7 & 8: Redo ───────────────────────────────────────────────────────
  await step("7-8. Redo & verify forward convergence to R1 (20 -> 19 atoms)", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('redo'); });
    await waitMs(1500);

    const appState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const canonicalState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    const viewerState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());

    await assertEqual("App state atoms after redo", appState.atomsCount, 19);
    await assertEqual("Canonical atoms after redo", canonicalState.atomCount, 19);
    if (viewerState) {
      await assertEqual("Viewer atoms after redo", viewerState.atomCount, 19);
    }
    await assertEqual("Active revision restored to R1", canonicalState.activeRevisionId, r1RevId);
    await assertEqual("State hash restored to R1 hash", canonicalState.canonicalStateHash, r1Hash);

    await shot(page, 'conv_04_redo.png');
  });

  // ── Step 9 & 10: Bond / Unbond ─────────────────────────────────────────────
  await step("9-10. Bond and Unbond operations & verify topology synchronization", async () => {
    // Bond id 1, id 3
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('bond id 1, id 3'); });
    await waitMs(1500);
    let canonicalState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    const preUnbondBonds = canonicalState.bondCount;

    // Unbond id 1, id 3
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('unbond id 1, id 3'); });
    await waitMs(1500);
    canonicalState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    await assertEqual("Bond count after unbond", canonicalState.bondCount, preUnbondBonds - 1);
  });

  // ── Step 11 & 12: Hydrogen modeling (h_add) ────────────────────────────────
  await step("11-12. Hydrogen modeling (h_add id 17) & verify coordinate synchronization", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('h_add id 17'); });
    await waitMs(1500);

    const appState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const canonicalState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    const viewerState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());

    await assertEqual("App state atoms after h_add", appState.atomsCount, 22);
    await assertEqual("Canonical atoms after h_add", canonicalState.atomCount, 22);
    if (viewerState) {
      await assertEqual("Viewer atoms after h_add", viewerState.atomCount, 22);
    }

    await shot(page, 'conv_05_h_add.png');
  });

  // ── Step 13 & 14: Alter property (alter id 1, formal_charge=1) ─────────────
  await step("13-14. Alter property (alter id 1, formal_charge=1) & verify state hash update", async () => {
    const preAlter = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('alter id 1, formal_charge=1'); });
    await waitMs(1500);

    const postAlter = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    assertTruthy("State hash changed after formal charge mutation", preAlter.canonicalStateHash !== postAlter.canonicalStateHash);
    const atom1 = postAlter.atoms.find(a => a.canonical_id === 1);
    await assertEqual("Atom 1 formal charge updated", atom1.formal_charge, 1);

    await shot(page, 'conv_06_alter.png');
  });

  // ── Step 15 & 16: Invalid operation fail-closed (ZERO change) ──────────────
  await step("15-16. Invalid operation fail-closed (bond id 1, id 1) — assert ZERO change across all layers", async () => {
    const preState = await page.evaluate(() => ({
      app: window.__molStudioTestApi.getState(),
      canon: window.__molStudioTestApi.getCanonicalState(),
      viewer: window.__molStudioTestApi.getViewerState()
    }));

    // Attempt invalid self-bond
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('bond id 1, id 1'); });
    await waitMs(1000);

    const postState = await page.evaluate(() => ({
      app: window.__molStudioTestApi.getState(),
      canon: window.__molStudioTestApi.getCanonicalState(),
      viewer: window.__molStudioTestApi.getViewerState()
    }));

    await assertEqual("Active revision unchanged", postState.canon.activeRevisionId, preState.canon.activeRevisionId);
    await assertEqual("Canonical hash unchanged", postState.canon.canonicalStateHash, preState.canon.canonicalStateHash);
    await assertEqual("Canonical atom count unchanged", postState.canon.atomCount, preState.canon.atomCount);
    await assertEqual("Canonical bond count unchanged", postState.canon.bondCount, preState.canon.bondCount);
    await assertEqual("App atom count unchanged", postState.app.atomsCount, preState.app.atomsCount);
    if (preState.viewer && postState.viewer) {
      await assertEqual("Viewer atom count unchanged", postState.viewer.atomCount, preState.viewer.atomCount);
    }
  });

  // ── Step 17, 18, 19: Branch & Historical Navigation ────────────────────────
  let branchR3Id = null;
  await step("17-19. Branch creation & historical navigateToRevision — verify visual convergence", async () => {
    // Undo all the way back to root R0
    let canUndo = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState()?.canUndo);
    while (canUndo) {
      await page.evaluate(() => { window.__molStudioTestApi.runQuery('undo'); });
      await waitMs(500);
      canUndo = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState()?.canUndo);
    }
    await waitMs(1000);

    // Create branch from R0: alter id 17, name=C99
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('alter id 17, name=C99'); });
    await waitMs(1500);

    const r3State = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    branchR3Id = r3State.activeRevisionId;
    const atom17 = r3State.atoms.find(a => a.canonical_id === 17);
    await assertEqual("Branch R3 atom 17 name", atom17.name, 'C99');

    await shot(page, 'conv_07_branch.png');

    // Historical navigation to R1 (remove id 20)
    await page.evaluate((id) => { window.__molStudioTestApi.navigateToRevision(id); }, r1RevId);
    await waitMs(1500);

    const histState = await page.evaluate(() => ({
      app: window.__molStudioTestApi.getState(),
      canon: window.__molStudioTestApi.getCanonicalState(),
      viewer: window.__molStudioTestApi.getViewerState()
    }));

    await assertEqual("Navigated active revision is R1", histState.canon.activeRevisionId, r1RevId);
    await assertEqual("Navigated atom count is 19 (R1)", histState.app.atomsCount, 19);
    if (histState.viewer) {
      await assertEqual("Viewer shows 19 atoms at R1", histState.viewer.atomCount, 19);
    }

    await shot(page, 'conv_08_nav_historical.png');

    // Navigate back to R3
    await page.evaluate((id) => { window.__molStudioTestApi.navigateToRevision(id); }, branchR3Id);
    await waitMs(1500);

    const backR3 = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    await assertEqual("Navigated back to R3", backR3.activeRevisionId, branchR3Id);
    await assertEqual("Atom count back to 20 at R3", backR3.atomCount, 20);
  });

  // ── Step 20 & 21: PSE Session Save & Reload ────────────────────────────────
  await step("20-21. PSE Session Save/Reload — verify restored active snapshot convergence", async () => {
    const prePseState = await page.evaluate(() => window.__molStudioTestApi.getCanonicalState());
    const pseString = await page.evaluate(() => window.__molStudioTestApi.exportSessionString());
    assertTruthy("PSE string exported", pseString && pseString.length > 100);

    // Reload via importSessionString
    await page.evaluate((pse) => { window.__molStudioTestApi.importSessionString(pse); }, pseString);
    await waitMs(2000);

    const postReload = await page.evaluate(() => ({
      app: window.__molStudioTestApi.getState(),
      canon: window.__molStudioTestApi.getCanonicalState(),
      viewer: window.__molStudioTestApi.getViewerState()
    }));

    await assertEqual("Restored atom count matches pre-save", postReload.app.atomsCount, prePseState.atomCount);
    await assertEqual("Restored canonical atom count matches pre-save", postReload.canon.atomCount, prePseState.atomCount);
    if (postReload.viewer) {
      await assertEqual("Restored viewer atom count matches pre-save", postReload.viewer.atomCount, prePseState.atomCount);
    }

    await shot(page, 'conv_09_pse_reload.png');
  });

  await browser.close();

  // ── Performance Baseline Report ────────────────────────────────────────────
  console.log('\n================================================================================');
  console.log(' PERFORMANCE (OBSERVATIONAL BASELINE) — SYNCHRONIZATION LATENCY                ');
  console.log('================================================================================');
  for (const log of latencyLogs) {
    console.log(`  Step ${log.step.toString().padStart(2, ' ')}: ${log.latencyMs.toString().padStart(5, ' ')} ms — ${log.name}`);
  }

  console.log('\n================================================================================');
  console.log(`BROWSER CONVERGENCE QA SUMMARY: ${passedSteps} / ${totalSteps} Steps Passed`);
  console.log('================================================================================\n');

  if (passedSteps !== totalSteps) {
    process.exit(1);
  }
})();
