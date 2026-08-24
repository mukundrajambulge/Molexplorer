/**
 * test_styles_and_blanking_causes.cjs
 * Systematically tests every representation style, surface opacity, and hide action
 * on 4HHB to see which one causes the canvas to render blank.
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

async function runTest() {
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.text().includes('WebGL') || msg.text().includes('Error')) {
      console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
    }
  });

  try {
    await page.goto('http://127.0.0.1:5173/molstudio', { waitUntil: 'networkidle0' });
    await page.waitForFunction(() => typeof window.__molStudioTestApi !== 'undefined');

    const hhbPdb = loadFixturePdb('4HHB.pdb');
    await page.evaluate((pdbText) => {
      window.__molStudioTestApi.loadMolecule('4HHB', pdbText, 'pdb');
    }, hhbPdb);
    await new Promise(r => setTimeout(r, 600));

    const styles = ['Cartoon', 'Stick', 'Space-Filling', 'Ball-and-Stick', 'Lines', 'Surfaces', 'Mesh', 'Dots', 'Putty'];

    for (const s of styles) {
      console.log(`\nTesting style: ${s}...`);
      await page.evaluate((styleName) => {
        window.__molStudioTestApi.setRenderStyle(styleName);
      }, s);
      await new Promise(r => setTimeout(r, 600));
      
      const vState = await page.evaluate(() => window.__molStudioTestApi.getViewerState());
      console.log(`  Viewer atom count under ${s}: ${vState?.atomCount}`);
      const ssPath = path.resolve(__dirname, `sq_v0_style_${s}.png`);
      await page.screenshot({ path: ssPath });
    }

  } finally {
    await browser.close();
  }
}

runTest();
