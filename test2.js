import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  
  page.on('pageerror', error => {
    console.log(`[BROWSER ERROR]: ${error.message}`);
  });

  await page.goto('http://localhost:3000');
  
  // Wait a bit for Babylon to load
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Clicking the canvas to trigger wormhole...");
  await page.mouse.click(400, 300);
  
  // Wait for the 3 seconds transition timeout + some buffer
  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
})();
