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
  await page.waitForSelector('button');
  console.log("Found buttons, clicking the one to enter...");
  const buttons = await page.$$('button');
  for (let btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Enter the')) {
          await btn.click();
          break;
      }
  }
  
  await new Promise(r => setTimeout(r, 6000));
  await browser.close();
})();
