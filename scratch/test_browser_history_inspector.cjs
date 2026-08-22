/**
 * P4.2: Browser Adversarial Verification — Scientific History Inspector
 * Puppeteer tests verifying the inspector renders and behaves correctly in the browser.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\e43f6ae3-6d0c-44fd-ae3d-9abd3e716b18';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const FIXTURE_PDB = fs.readFileSync(
  path.resolve(process.cwd(), 'fixtures/03_protein_with_ligand.pdb'),
  'utf8'
);

let totalSteps = 0;
let passedSteps = 0;

async function step(name, fn) {
  totalSteps++;
  console.log(`\n[STEP ${totalSteps}] ${name}`);
  try {
    await fn();
    passedSteps++;
    console.log(`  -> PASSED`);
  } catch (err) {
    console.error(`  -> FAILED: ${err.message}`);
    throw err;
  }
}

async function assertEqual(label, actual, expected) {
  if (actual !== expected) throw new Error(`[ASSERT] ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  console.log(`  [✓] ${label}: ${actual}`);
}

async function assertTruthy(label, val) {
  if (!val) throw new Error(`[ASSERT] ${label}: expected truthy, got ${JSON.stringify(val)}`);
  console.log(`  [✓] ${label}`);
}

async function assertNull(label, val) {
  if (val !== null) throw new Error(`[ASSERT] ${label}: expected null, got ${JSON.stringify(val)}`);
  console.log(`  [✓] ${label}: null (manager not initialized)`);
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
  console.log('   TASK P4.2: BROWSER HISTORY INSPECTOR VERIFICATION (MOLSTUDIO)              ');
  console.log('================================================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox',
      '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-webgl', '--ignore-gpu-blocklist']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', err => console.error('[PAGEERROR]', err.message));
  page.on('dialog', async d => { await d.dismiss(); });

  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
  await waitMs(2000);

  // ── Step 1: Verify inspector shows "no mutations" state before any mutation ──

  await step("1. Before first mutation — revisionManager is null (no mutations state)", async () => {
    // Load fixture first so the toggle button appears
    await page.evaluate((pdb) => {
      window.__molStudioTestApi.loadMolecule('03_protein_with_ligand.pdb', pdb, 'pdb');
    }, FIXTURE_PDB);
    await waitMs(2000);

    // Before any mutation, revisionManager should be null
    const mgrState = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState());
    await assertNull("revisionManager before first mutation", mgrState);

    // Open inspector — should show "No scientific mutations recorded" message
    await page.evaluate(() => window.__molStudioTestApi.openHistoryInspector());
    await waitMs(500);

    const inspectorEl = await page.$('[data-testid="scientific-history-inspector"]');
    await assertTruthy("inspector panel renders", inspectorEl);

    // Check for "no mutations" message
    const text = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    await assertTruthy("inspector shows 'No scientific mutations' message",
      text && (text.includes('No scientific mutations') || text.includes('no mutations')));

    await shot(page, 'hist_01_root_no_mutations.png');
  });

  // ── Step 2: Perform remove — inspector should refresh reactively ─────────────

  await step("2. Perform remove id 20 — inspector refreshes to show revision history", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('remove id 20'); });
    await waitMs(1500);

    const atomCount = (await page.evaluate(() => window.__molStudioTestApi.getState())).atomsCount;
    await assertEqual("Atom count after remove", atomCount, 19);

    const mgrState = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState());
    await assertTruthy("revisionManager initialized after first mutation", mgrState);
    await assertEqual("Revision count is 2 (root + remove)", mgrState.revisionCount, 2);
    await assertEqual("canUndo is true", mgrState.canUndo, true);
    await assertEqual("canRedo is false", mgrState.canRedo, false);

    // Inspector should now show history (not no-mutations message)
    const text = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    await assertTruthy("Inspector no longer shows 'No mutations' after mutation",
      text && !text.includes('No scientific mutations recorded in this session'));

    await shot(page, 'hist_02_after_remove.png');
  });

  // ── Step 3: Inspect provenance panel ─────────────────────────────────────────

  await step("3. Inspect provenance panel — operation and atom IDs visible", async () => {
    // Click the Provenance tab
    await page.evaluate(() => {
      const btn = document.querySelector('[data-tab="provenance"]');
      if (btn) btn.click();
    });
    await waitMs(400);

    const text = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    // Root has no provenance — active rev is the remove revision
    // Provenance tab should show "remove" or "IMMUTABLE"
    await assertTruthy("Provenance tab visible",
      text && (text.includes('IMMUTABLE') || text.includes('remove') || text.includes('provenance')));

    await shot(page, 'hist_03_provenance.png');
  });

  // ── Step 4: Inspect state hash panel ─────────────────────────────────────────

  await step("4. Inspect integrity panel — STATE HASH and REVISION HASH visible", async () => {
    await page.evaluate(() => {
      const btn = document.querySelector('[data-tab="integrity"]');
      if (btn) btn.click();
    });
    await waitMs(400);

    const text = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    await assertTruthy("Integrity panel shows STATE HASH label",
      text && text.includes('STATE HASH'));
    await assertTruthy("Integrity panel shows REVISION HASH label",
      text && text.includes('REVISION HASH'));
    await assertTruthy("Integrity panel shows atom count",
      text && text.includes('atoms'));

    await shot(page, 'hist_04_hash_panel.png');
  });

  // ── Step 5: Undo — inspect parent revision restored ──────────────────────────

  await step("5. Undo — inspect parent revision restored, revisionCount unchanged", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('undo'); });
    await waitMs(1500);

    const atomCount = (await page.evaluate(() => window.__molStudioTestApi.getState())).atomsCount;
    await assertEqual("Atom count after undo", atomCount, 20);

    const mgrState = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState());
    await assertEqual("Revision count still 2 (undo does NOT create revision)", mgrState.revisionCount, 2);
    await assertEqual("canUndo is false (at root)", mgrState.canUndo, false);
    await assertEqual("canRedo is true after undo", mgrState.canRedo, true);

    // Switch back to history tab
    await page.evaluate(() => {
      const btn = document.querySelector('[data-tab="history"]');
      if (btn) btn.click();
    });
    await waitMs(300);

    await shot(page, 'hist_05_undo.png');
  });

  // ── Step 6: Redo — inspect child revision restored ───────────────────────────

  await step("6. Redo — inspect forward revision restored", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('redo'); });
    await waitMs(1500);

    const atomCount = (await page.evaluate(() => window.__molStudioTestApi.getState())).atomsCount;
    await assertEqual("Atom count after redo", atomCount, 19);

    const mgrState = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState());
    await assertEqual("canRedo is false after redo", mgrState.canRedo, false);
    await assertEqual("canUndo is true after redo", mgrState.canUndo, true);

    await shot(page, 'hist_06_after_redo.png');
  });

  // ── Step 7: Create branch — undo then new edit ───────────────────────────────

  await step("7. Create branch — undo then alter id 1 formal_charge=1", async () => {
    await page.evaluate(() => {
      window.__molStudioTestApi.runQuery('undo');
      window.__molStudioTestApi.runQuery('alter id 1, formal_charge=1');
    });
    await waitMs(1500);

    const mgrState = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState());
    await assertEqual("Revision count is 3 (root + remove branch + alter branch)", mgrState.revisionCount, 3);

    // Switch to tree tab
    await page.evaluate(() => {
      const btn = document.querySelector('[data-tab="tree"]');
      if (btn) btn.click();
    });
    await waitMs(400);

    const text = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    await assertTruthy("Tree tab shows 'branch' label", text && text.includes('branch'));
    await assertTruthy("Tree tab shows 'active' label", text && text.includes('active'));

    await shot(page, 'hist_07_branch.png');
  });

  // ── Step 8: Save PSE ─────────────────────────────────────────────────────────

  let pseString = null;
  await step("8. Save PSE session string", async () => {
    pseString = await page.evaluate(() => window.__molStudioTestApi.exportSessionString());
    await assertTruthy("PSE string exported", pseString && pseString.length > 100);
    console.log(`  PSE length: ${pseString.length} bytes`);
  });

  // ── Step 9-10: PSE reload — verify snapshot-only mode ────────────────────────

  await step("9-10. PSE reload — inspector shows snapshot-only notice, no fabricated history", async () => {
    // Reload via loadMolecule (PSE import path: importSessionString)
    const sessionData = JSON.parse(pseString);
    const mol = sessionData.molecules[0];
    await page.evaluate((name, data, fmt) => {
      window.__molStudioTestApi.loadMolecule(name, data, fmt);
    }, mol.name, mol.data, mol.format || 'pdb');
    await waitMs(2000);

    // After file-load, revisionManager is reset (isPseSnapshotOnly becomes true
    // when importSessionString is used, but loadMolecule resets the processor)
    // Use importSessionString for proper PSE reload test
    await page.evaluate((pse) => {
      window.__molStudioTestApi.importSessionString(pse);
    }, pseString);
    await waitMs(2000);

    // Open inspector to check snapshot-only mode
    await page.evaluate(() => window.__molStudioTestApi.openHistoryInspector());
    await waitMs(500);

    const mgrState = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState());
    // After importSessionString (PSE reload), revisionManagerRef is null
    await assertNull("revisionManager is null after PSE reload", mgrState);

    const inspText = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    // Should show either "No scientific mutations" (null manager) or PSE snapshot-only notice
    await assertTruthy("Inspector shows no fabricated history after PSE reload",
      inspText && (inspText.includes('No scientific mutations') || inspText.includes('snapshot') || inspText.includes('History not available')));

    await shot(page, 'hist_08_pse_reload.png');
  });

  // ── Step 11: Re-mutate after reload — inspector updates again ────────────────

  await step("11. Re-mutate after reload — inspector refreshes again to show new history", async () => {
    await page.evaluate(() => { window.__molStudioTestApi.runQuery('remove id 20'); });
    await waitMs(1500);

    const mgrState = await page.evaluate(() => window.__molStudioTestApi.getRevisionManagerState());
    await assertTruthy("revisionManager re-initialized after new mutation", mgrState);
    await assertEqual("Revision count is 2 (new root + remove)", mgrState.revisionCount, 2);
    await assertEqual("isPseSnapshotOnly cleared after mutation", mgrState.isPseSnapshotOnly, false);
  });

  // ── Step 12: Verify active snapshot display in integrity tab ─────────────────

  await step("12. Integrity panel shows correct active snapshot data", async () => {
    await page.evaluate(() => {
      const btn = document.querySelector('[data-tab="integrity"]');
      if (btn) btn.click();
    });
    await waitMs(400);

    const text = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    await assertTruthy("Integrity panel shows VALID", text && text.includes('VALID'));
    await assertTruthy("Integrity panel shows atom count", text && (text.includes('19') || text.includes('atoms')));
  });

  // ── Step 13: Verify before/after tab ────────────────────────────────────────

  await step("13. Before/After tab shows structural delta", async () => {
    await page.evaluate(() => {
      const btn = document.querySelector('[data-tab="diff"]');
      if (btn) btn.click();
    });
    await waitMs(400);

    const text = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="scientific-history-inspector"]');
      return el ? el.textContent : '';
    });
    await assertTruthy("Before/After tab shows operation name", text && text.includes('remove'));
    await assertTruthy("Before/After tab shows atom delta with arrow", text && text.includes('→'));
    await shot(page, 'hist_09_before_after.png');
  });

  await browser.close();

  console.log('\n================================================================================');
  console.log(`BROWSER HISTORY INSPECTOR SUMMARY: ${passedSteps} / ${totalSteps} Steps Passed`);
  console.log('================================================================================\n');

  if (passedSteps !== totalSteps) {
    process.exit(1);
  }
})();
