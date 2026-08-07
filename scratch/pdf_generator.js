import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('Creating page...');
    const page = await browser.newPage();
    
    const htmlPath = 'C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/MolStudio_Implementation_Plan.html';
    const pdfPath = 'C:/Users/mukun/.gemini/antigravity/brain/86ba0017-cb90-4a97-b810-88a7266b3c45/MolStudio_Implementation_Plan.pdf';
    
    console.log(`Loading HTML from: ${htmlPath}`);
    await page.goto('file:///' + htmlPath, { waitUntil: 'networkidle0' });
    
    console.log(`Generating PDF to: ${pdfPath}`);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: {
        top: '20mm',
        bottom: '20mm',
        left: '20mm',
        right: '20mm'
      },
      printBackground: true,
      preferCSSPageSize: true
    });
    
    await browser.close();
    console.log('PDF generated successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    process.exit(1);
  }
})();
