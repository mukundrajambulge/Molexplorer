const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.addScriptTag({ url: 'https://3Dmol.org/build/3Dmol-min.js' });
    const result = await page.evaluate(() => {
        const viewer = $3Dmol.createViewer(document.createElement('div'));
        const pdb = `REMARK 350 BIOMOLECULE: 1
REMARK 350 APPLY THE FOLLOWING TO CHAINS: A
REMARK 350   BIOMT1   1  1.000000  0.000000  0.000000        0.00000
REMARK 350   BIOMT2   1  0.000000  1.000000  0.000000        0.00000
REMARK 350   BIOMT3   1  0.000000  0.000000  1.000000        0.00000
REMARK 350   BIOMT1   2 -1.000000  0.000000  0.000000       10.00000
REMARK 350   BIOMT2   2  0.000000 -1.000000  0.000000       20.00000
REMARK 350   BIOMT3   2  0.000000  0.000000  1.000000       30.00000
CRYST1   50.000   50.000   50.000  90.00  90.00  90.00 P 21 21 21    8
ATOM      1  N   ALA A   1      10.000  10.000  10.000  1.00 10.00           N  
`;
        viewer.addModel(pdb, "pdb");
        const m = viewer.getModel(0);
        return {
           hasSymmetries: !!m.symmetries,
           symmetries: m.symmetries,
           hasBiomt: !!m.biomt,
           biomt: m.biomt
        };
    });
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
})();
