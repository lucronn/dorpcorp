import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });
  
  await page.goto('http://localhost:3000');
  
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Clicking the canvas...");
  await page.evaluate(() => {
     const canvas = document.querySelector('canvas');
     if (canvas) {
         console.log("Dispatching pointerdown to canvas");
         const event = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            pointerType: "mouse",
            clientX: 400,
            clientY: 300
         });
         canvas.dispatchEvent(event);
     }
  });
  
  await new Promise(r => setTimeout(r, 3000));
  await browser.close();
})();
