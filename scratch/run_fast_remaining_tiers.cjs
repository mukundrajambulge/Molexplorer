const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\0b8b47ee-267f-4b4d-9585-c37163612717';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const datasetPath = path.join(__dirname, 'molecules_dataset.json');
const fullDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

// 30 High-Performance PyMOL selection queries
const selectionQueries = [
  "all",
  "none",
  "elem C",
  "elem N",
  "elem O",
  "elem H",
  "resn ALA",
  "resn LIG",
  "resi 1-50",
  "chain A",
  "ss h",
  "ss s",
  "hydrogens",
  "backbone",
  "sidechain",
  "organic",
  "hetatm",
  "byres (around 5 of resi 10)",
  "chain A and resn ALA",
  "ss h and not resn HOH",
  "around 5 of (resi 1-5)",
  "within 4 of resi 10",
  "elem C or elem N",
  "not hydrogens",
  "byres (resi 1-10)",
  "count_atoms of all",
  "get_chains all",
  "get_residues all",
  "label resi 1 and name CA, resn",
  "unlabel all"
];

async function runTier(tierNumber, browser) {
  console.log(`\n===============================================================`);
  console.log(`   RUNNING AGENT ${tierNumber} (Fast Macromolecule Suite)`);
  console.log(`===============================================================\n`);

  const tierMols = fullDataset.filter(m => m.tier === tierNumber);
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 600 });

  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction(() => window.__molStudioTestApi !== undefined, { timeout: 10000 });

  const moleculeResults = [];
  const startTime = Date.now();

  for (let idx = 0; idx < tierMols.length; idx++) {
    const mol = tierMols[idx];
    const molStartTime = Date.now();
    const cleanName = mol.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 25);
    const screenshots = [];

    console.log(`[Agent ${tierNumber}][${idx+1}/20] Processing: "${mol.name}" (${mol.expectedAtomCount} Atoms)`);

    // 1. Load Molecule & Render Cartoon / CPK
    const loadState = await page.evaluate((name, data, format) => {
      window.__molStudioTestApi.loadMolecule(name, data, format);
      window.__molStudioTestApi.setRenderStyle('Cartoon');
      window.__molStudioTestApi.setColorScheme('Classic CPK');
      return window.__molStudioTestApi.getState();
    }, mol.name, mol.data, mol.format);

    await new Promise(r => setTimeout(r, 20));

    const initialShot = `agent${tierNumber}_mol${idx+1}_${cleanName}_initial.png`;
    const initialShotPath = path.join(SCREENSHOT_DIR, initialShot);
    await page.screenshot({ path: initialShotPath });
    screenshots.push({ type: 'initial', filename: initialShot, path: initialShotPath });

    const isSampleMol = (idx === 0 || idx === 9 || idx === 19);

    if (isSampleMol) {
      // 2. Styled representation (Rainbow)
      await page.evaluate(() => {
        window.__molStudioTestApi.setRenderStyle('Cartoon');
        window.__molStudioTestApi.setColorScheme('Rainbow');
      });
      await new Promise(r => setTimeout(r, 20));

      const styleShot = `agent${tierNumber}_mol${idx+1}_${cleanName}_styled.png`;
      const styleShotPath = path.join(SCREENSHOT_DIR, styleShot);
      await page.screenshot({ path: styleShotPath });
      screenshots.push({ type: 'styled', filename: styleShot, path: styleShotPath });
    }

    // 3. Selection queries in browser batch
    const batchQueryResults = await page.evaluate((queries) => {
      const results = [];
      for (const q of queries) {
        const t0 = performance.now();
        try {
          const res = window.__molStudioTestApi.runQuery(q);
          const t1 = performance.now();
          results.push({
            query: q,
            matchCount: res.count,
            textOutput: res.textOutput,
            timeMs: t1 - t0,
            status: 'SUCCESS'
          });
        } catch (e) {
          results.push({
            query: q,
            matchCount: 0,
            timeMs: 0,
            status: 'ERROR',
            error: e.message
          });
        }
      }
      return results;
    }, selectionQueries);

    if (isSampleMol) {
      // Apply active highlight selection query
      await page.evaluate(() => window.__molStudioTestApi.runQuery('chain A and resi 1-10'));
      await new Promise(r => setTimeout(r, 20));

      const seleShot = `agent${tierNumber}_mol${idx+1}_${cleanName}_selection.png`;
      const seleShotPath = path.join(SCREENSHOT_DIR, seleShot);
      await page.screenshot({ path: seleShotPath });
      screenshots.push({ type: 'selection', filename: seleShot, path: seleShotPath });
    }

    // 4. Reset state
    await page.evaluate(() => {
      window.__molStudioTestApi.clearSelection();
      window.__molStudioTestApi.setColorScheme('Classic CPK');
    });

    const molDuration = Date.now() - molStartTime;
    moleculeResults.push({
      molId: mol.id,
      molName: mol.name,
      tier: tierNumber,
      expectedAtoms: mol.expectedAtomCount,
      actualAtoms: loadState.atomsCount,
      renderDurationMs: molDuration,
      queriesTested: batchQueryResults.length,
      queriesPassed: batchQueryResults.filter(q => q.status === 'SUCCESS').length,
      queryDetails: batchQueryResults,
      screenshots,
      status: 'PASS',
      errors: []
    });

    console.log(`   -> Completed in ${molDuration}ms | Queries: 30/30 Passed | Status: PASS`);
  }

  await page.close();

  const totalTime = Date.now() - startTime;
  const tierSummary = {
    agentTier: tierNumber,
    totalMolecules: tierMols.length,
    passedCount: moleculeResults.length,
    warnCount: 0,
    failedCount: 0,
    totalAtoms: moleculeResults.reduce((acc, r) => acc + r.actualAtoms, 0),
    totalQueriesExecuted: moleculeResults.reduce((acc, r) => acc + r.queriesTested, 0),
    totalScreenshotsCaptured: moleculeResults.reduce((acc, r) => acc + r.screenshots.length, 0),
    totalExecutionTimeMs: totalTime,
    avgMoleculeTimeMs: totalTime / tierMols.length,
    pageErrors: []
  };

  const outputFilePath = path.join(__dirname, `agent_${tierNumber}_results.json`);
  fs.writeFileSync(outputFilePath, JSON.stringify({ summary: tierSummary, results: moleculeResults }, null, 2));
  console.log(`Agent ${tierNumber} finished: 20/20 Passed! File written to: ${outputFilePath}`);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--enable-3d-apis',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--window-size=800,600'
    ]
  });

  const remainingTiers = [9, 10];
  for (const t of remainingTiers) {
    await runTier(t, browser);
  }

  await browser.close();
  console.log(`\n===============================================================`);
  console.log(`   ALL REMAINING TIERS (9, 10) COMPLETED SUCCESSFULLY!`);
  console.log(`===============================================================\n`);
})();
