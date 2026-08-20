const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function runE2ETest() {
  console.log('====================================================');
  console.log(' PHASE 4: PUPPETEER E2E PSE ROUND-TRIP TEST ');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Navigate to MolStudio
    await page.evaluate(() => {
      window.location.href = '/molstudio';
    });
    await new Promise(r => setTimeout(r, 2000));

    // Load fixture molecule 03_protein_with_ligand.pdb
    const fixturePDB = fs.readFileSync(path.join(__dirname, '../fixtures/03_protein_with_ligand.pdb'), 'utf8');
    
    await page.evaluate((pdbData) => {
      window.__molStudioTestApi.loadMolecule('03_protein_with_ligand', pdbData, 'pdb');
    }, fixturePDB);

    await new Promise(r => setTimeout(r, 1500));

    await page.evaluate(() => {
      window.__molStudioTestApi.setRenderStyle('Ball-and-Stick');
      window.__molStudioTestApi.setColorScheme('Modern/Jmol');
      window.__molStudioTestApi.setSurfaceOpacity(0.65);
      window.__molStudioTestApi.setBackgroundColor('#1A1A24');
      window.__molStudioTestApi.runQuery('resn LIG');
    });

    await new Promise(r => setTimeout(r, 1000));

    // Verify initial pre-save state
    const preSaveState = await page.evaluate(() => window.__molStudioTestApi.getState());
    console.log('  [CHECK] Pre-save state in browser:', preSaveState);
    if (preSaveState.atomsCount !== 20) throw new Error(`Pre-save atom count expected 20, got ${preSaveState.atomsCount}`);
    if (preSaveState.selectedCount !== 4) throw new Error(`Pre-save selected count expected 4, got ${preSaveState.selectedCount}`);
    if (preSaveState.renderStyle !== 'Ball-and-Stick') throw new Error(`Pre-save style expected Ball-and-Stick, got ${preSaveState.renderStyle}`);
    if (preSaveState.colorScheme !== 'Modern/Jmol') throw new Error(`Pre-save color scheme expected Modern/Jmol, got ${preSaveState.colorScheme}`);

    // Export PSE session string directly
    const exportedPSEString = await page.evaluate(() => window.__molStudioTestApi.exportSessionString());
    if (!exportedPSEString.includes('"format": "MolStudio-PSE"')) {
      throw new Error('Exported session missing "MolStudio-PSE" format header');
    }
    console.log('  [PASS] Exported PSE contains "MolStudio-PSE" format header');

    // Simulate browser refresh
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    // Verify clean state after refresh
    const cleanState = await page.evaluate(() => window.__molStudioTestApi.getState());
    console.log('  [CHECK] State after refresh (clean):', cleanState);
    if (cleanState.atomsCount !== 0) throw new Error(`Clean state expected 0 atoms, got ${cleanState.atomsCount}`);

    // Restore saved PSE session
    await page.evaluate((pseData) => {
      window.__molStudioTestApi.importSessionString(pseData);
    }, exportedPSEString);

    await new Promise(r => setTimeout(r, 2000));

    // Verify restored state
    const restoredState = await page.evaluate(() => window.__molStudioTestApi.getState());
    console.log('  [CHECK] Restored state after loading PSE:', restoredState);
    if (restoredState.atomsCount !== 20) throw new Error(`Restored atom count expected 20, got ${restoredState.atomsCount}`);
    if (restoredState.selectedCount !== 4) throw new Error(`Restored selected count expected 4, got ${restoredState.selectedCount}`);
    if (restoredState.renderStyle !== 'Ball-and-Stick') throw new Error(`Restored style expected Ball-and-Stick, got ${restoredState.renderStyle}`);
    if (restoredState.colorScheme !== 'Modern/Jmol') throw new Error(`Restored color scheme expected Modern/Jmol, got ${restoredState.colorScheme}`);
    if (restoredState.surfaceOpacity !== 0.65) throw new Error(`Restored opacity expected 0.65, got ${restoredState.surfaceOpacity}`);
    if (restoredState.backgroundColor !== '#1A1A24') throw new Error(`Restored background expected #1A1A24, got ${restoredState.backgroundColor}`);

    console.log('\n====================================================');
    console.log(' [PASS] FULL E2E SAVE -> REFRESH -> RESTORE WORKFLOW SUCCESSFUL ');
    console.log('====================================================\n');
  } finally {
    await browser.close();
  }
}

runE2ETest().catch(e => {
  console.error('E2E test failed:', e);
  process.exit(1);
});
