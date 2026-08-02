const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.goto(`file://${__dirname}/test-3dmol-api.html`);
  await page.waitForTimeout(1000);
  await browser.close();
})();
