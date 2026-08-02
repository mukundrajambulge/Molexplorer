import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head><script src="https://3dmol.csb.pitt.edu/build/3Dmol.js"></script></head>
    <body>
    <script>
    console.log("Cartoon style options:");
    // Let's dump a constructed cartoon object or look at the parser
    // Actually, we can look at the Viewer prototype
    console.log(Object.keys(new $3Dmol.GLViewer(document.createElement('div'))));
    </script>
    </body>
    </html>
  `, { waitUntil: 'networkidle0' });
  await browser.close();
})();
