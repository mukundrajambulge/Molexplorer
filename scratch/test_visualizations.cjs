const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const artifactsDir = 'C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45';

(async () => {
  console.log("Initializing headless browser via Puppeteer...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  console.log("Navigating to http://localhost:5173/molstudio...");
  await page.goto('http://localhost:5173/molstudio', { waitUntil: 'networkidle2' });

  // Helper function to find button by text
  const findButtonByText = async (textPattern) => {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.toLowerCase().includes(textPattern.toLowerCase())) {
        return btn;
      }
    }
    return null;
  };

  // 1. Switch to File & I/O Tab to render the Fetch inputs
  console.log("Switching to File & I/O tab...");
  const fileTabBtn = await findButtonByText('File & I/O');
  if (fileTabBtn) {
    await fileTabBtn.click();
  }
  await new Promise(resolve => setTimeout(resolve, 500));

  // 2. Fetch PDB ID 1CRN
  console.log("Fetching 1CRN structure...");
  const pdbInputSelector = 'input[placeholder*="1HVR"]';
  await page.waitForSelector(pdbInputSelector, { timeout: 5000 });
  await page.type(pdbInputSelector, '1CRN');

  const fetchBtn = await findButtonByText('Fetch');
  if (fetchBtn) {
    await fetchBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }

  console.log("Waiting for molecule to render (327 atoms)...");
  await page.waitForFunction(
    () => document.body.innerText.includes('327'),
    { timeout: 15000 }
  );
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Verify Objects and Selections Panel (ASHLC) populated
  console.log("Checking Objects & Selections panel...");
  const bodyText = await page.evaluate(() => document.body.innerText);
  if (bodyText.includes("Objects & Selections") && bodyText.includes("1CRN")) {
    console.log("SUCCESS: Objects panel rendered and contains 1CRN!");
  }

  // 4. Open PyMOL Selection Query Console
  console.log("Opening PyMOL Selection Query Console...");
  const consoleBtn = await findButtonByText('Query Console');
  if (consoleBtn) {
    await consoleBtn.click();
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Type a query: "ss h and not resn HOH"
  console.log("Running selection query 'ss h and not resn HOH'...");
  const queryTextareaSelector = 'textarea[placeholder*="Type PyMOL query"]';
  await page.waitForSelector(queryTextareaSelector);
  await page.type(queryTextareaSelector, 'ss h and not resn HOH');

  const runBtn = await findButtonByText('Run');
  if (runBtn) {
    await runBtn.click();
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  const logs = await page.evaluate(() => {
    const el = document.querySelector('.custom-scrollbar');
    return el ? el.innerText : '';
  });
  console.log("Query console output logs:", logs);

  const bodyTextAfterQuery = await page.evaluate(() => document.body.innerText);
  if (bodyTextAfterQuery.includes("sele_active") || bodyTextAfterQuery.includes("sele")) {
    console.log("SUCCESS: Active selection object 'sele' successfully populated in Objects list!");
  } else {
    console.error("FAIL: Selection object 'sele' missing from list!");
  }

  await browser.close();
})().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
