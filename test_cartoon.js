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
    <div id="container" style="width: 400px; height: 400px; position: relative;"></div>
    <script>
    fetch("https://files.rcsb.org/download/1HVR.pdb").then(r => r.text()).then(pdb => {
      const viewer = $3Dmol.createViewer("container");
      viewer.addModel(pdb, "pdb");
      viewer.setStyle({hetflag: false}, { cartoon: { color: 'spectrum', arrows: true, thickness: 0.8, width: 1.5 } });
      viewer.render();
      console.log("Rendered!");
    });
    </script>
    </body>
    </html>
  `, { waitUntil: 'networkidle0' });
  await browser.close();
})();
