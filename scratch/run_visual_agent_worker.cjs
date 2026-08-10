const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\mukun\\.gemini\\antigravity\\brain\\0b8b47ee-267f-4b4d-9585-c37163612717';
const SCREENSHOT_DIR = path.join(ARTIFACT_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Parse command line arguments
const args = process.argv.slice(2);
let agentTier = 1;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--agent' && args[i+1]) {
    agentTier = parseInt(args[i+1], 10);
  }
}

console.log(`\n===============================================================`);
console.log(`   RUNNING AGENT ${agentTier} TEST WORKER (MolStudio Chrome Live)`);
console.log(`===============================================================\n`);

const datasetPath = path.join(__dirname, 'molecules_dataset.json');
const fullDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const tierMols = fullDataset.filter(m => m.tier === agentTier);

console.log(`Agent ${agentTier} loaded ${tierMols.length} assigned molecules.`);

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
  "byres (around 5 of resn LIG)",
  "chain A and resn ALA",
  "ss h and not resn HOH",
  "around 5 of (elem N or elem O)",
  "within 4 of elem N",
  "elem C or elem N",
  "not hydrogens",
  "byres (resi 1-10)",
  "count_atoms of all",
  "get_chains all",
  "get_residues all",
  "label elem N, name",
  "unlabel all"
];

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
      '--window-size=1440,900'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const pageErrors = [];
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('404')) {
      pageErrors.push(text);
    }
  });
  page.on('pageerror', err => pageErrors.push(err.message));

  console.log(`[Agent ${agentTier}] Connecting to http://localhost:5173/molstudio...`);
  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  // Wait for test API to mount
  await page.waitForFunction(() => window.__molStudioTestApi !== undefined, { timeout: 10000 });

  const moleculeResults = [];
  const startTime = Date.now();

  for (let idx = 0; idx < tierMols.length; idx++) {
    const mol = tierMols[idx];
    const molStartTime = Date.now();
    const molErrors = [];
    const screenshots = [];

    console.log(`\n[Agent ${agentTier}][${idx+1}/20] Testing: "${mol.name}" (Est Atoms: ${mol.expectedAtomCount})`);

    // 1. Load Molecule and set style
    const initialStyle = agentTier <= 4 ? 'Ball-and-Stick' : 'Cartoon';
    const loadAndRenderResult = await page.evaluate((name, data, format, style) => {
      window.__molStudioTestApi.loadMolecule(name, data, format);
      window.__molStudioTestApi.setRenderStyle(style);
      window.__molStudioTestApi.setColorScheme('Classic CPK');
      return window.__molStudioTestApi.getState();
    }, mol.name, mol.data, mol.format, initialStyle);

    await new Promise(r => setTimeout(r, 60));

    console.log(`   -> Atoms Loaded: ${loadAndRenderResult.atomsCount}, Render Style: ${loadAndRenderResult.renderStyle}`);

    // Capture initial 3D load screenshot
    const cleanName = mol.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase().slice(0, 25);
    const initialShot = `agent${agentTier}_mol${idx+1}_${cleanName}_initial.png`;
    const initialShotPath = path.join(SCREENSHOT_DIR, initialShot);
    await page.screenshot({ path: initialShotPath });
    screenshots.push({ type: 'initial', filename: initialShot, path: initialShotPath });

    // 2. Test Render Styles & Colors
    const styledRender = agentTier <= 4 ? 'Space-Filling' : 'Line';
    await page.evaluate((styled) => {
      window.__molStudioTestApi.setRenderStyle(styled);
      window.__molStudioTestApi.setColorScheme('Rainbow');
    }, styledRender);
    await new Promise(r => setTimeout(r, 60));

    const styleShot = `agent${agentTier}_mol${idx+1}_${cleanName}_styled.png`;
    const styleShotPath = path.join(SCREENSHOT_DIR, styleShot);
    await page.screenshot({ path: styleShotPath });
    screenshots.push({ type: 'styled', filename: styleShot, path: styleShotPath });

    // 3. Test Selection Queries (Executed within browser context for ultra-high performance)
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

    // Apply active highlight selection query (tested per category)
    const highlightQuery = agentTier <= 4 ? 'within 4 of elem N' : 'chain A and resi 1-10';
    await page.evaluate((hq) => window.__molStudioTestApi.runQuery(hq), highlightQuery);
    await new Promise(r => setTimeout(r, 60));

    const seleShot = `agent${agentTier}_mol${idx+1}_${cleanName}_selection.png`;
    const seleShotPath = path.join(SCREENSHOT_DIR, seleShot);
    await page.screenshot({ path: seleShotPath });
    screenshots.push({ type: 'selection', filename: seleShot, path: seleShotPath });

    // 4. Test Biophysical & Topology Tools
    await page.evaluate((tier) => {
      window.__molStudioTestApi.setShowDipoleArrow(true);
      if (tier <= 4) {
        window.__molStudioTestApi.addHydrogens();
        window.__molStudioTestApi.cycleValence();
      }
      window.__molStudioTestApi.toggleOrthographic();
      window.__molStudioTestApi.toggleOrthographic();
      window.__molStudioTestApi.clearSelection();
      window.__molStudioTestApi.setRenderStyle('Cartoon');
      window.__molStudioTestApi.setColorScheme('Classic CPK');
    }, agentTier);

    const finalState = await page.evaluate(() => window.__molStudioTestApi.getState());
    const molDuration = Date.now() - molStartTime;

    const resultEntry = {
      molId: mol.id,
      molName: mol.name,
      tier: agentTier,
      expectedAtoms: mol.expectedAtomCount,
      actualAtoms: finalState.atomsCount,
      renderDurationMs: molDuration,
      queriesTested: batchQueryResults.length,
      queriesPassed: batchQueryResults.filter(q => q.status === 'SUCCESS').length,
      queryDetails: batchQueryResults,
      screenshots,
      status: molErrors.length === 0 ? 'PASS' : 'WARN',
      errors: molErrors
    };

    moleculeResults.push(resultEntry);
    console.log(`   -> Completed in ${molDuration}ms | Queries: ${resultEntry.queriesPassed}/${resultEntry.queriesTested} Passed | Status: ${resultEntry.status}`);
  }

  await browser.close();

  const totalTime = Date.now() - startTime;
  const tierSummary = {
    agentTier,
    totalMolecules: tierMols.length,
    passedCount: moleculeResults.filter(r => r.status === 'PASS').length,
    warnCount: moleculeResults.filter(r => r.status === 'WARN').length,
    failedCount: moleculeResults.filter(r => r.status === 'FAIL').length,
    totalAtoms: moleculeResults.reduce((acc, r) => acc + r.actualAtoms, 0),
    totalQueriesExecuted: moleculeResults.reduce((acc, r) => acc + r.queriesTested, 0),
    totalScreenshotsCaptured: moleculeResults.reduce((acc, r) => acc + r.screenshots.length, 0),
    totalExecutionTimeMs: totalTime,
    avgMoleculeTimeMs: totalTime / tierMols.length,
    pageErrors
  };

  const outputFilePath = path.join(__dirname, `agent_${agentTier}_results.json`);
  fs.writeFileSync(outputFilePath, JSON.stringify({ summary: tierSummary, results: moleculeResults }, null, 2));

  console.log(`\n===============================================================`);
  console.log(`   AGENT ${agentTier} SUMMARY: ${tierSummary.passedCount}/${tierSummary.totalMolecules} Passed`);
  console.log(`   Total Atoms: ${tierSummary.totalAtoms.toLocaleString()}`);
  console.log(`   Total Queries: ${tierSummary.totalQueriesExecuted.toLocaleString()}`);
  console.log(`   Screenshots Captured: ${tierSummary.totalScreenshotsCaptured}`);
  console.log(`   Results saved to: ${outputFilePath}`);
  console.log(`===============================================================\n`);
})();
