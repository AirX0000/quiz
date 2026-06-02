const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  await page.goto('file://' + __dirname + '/index.html', {waitUntil: 'networkidle0'});
  console.log('Page loaded');
  await page.click('button.btn-primary'); // openLoginModal
  console.log('Clicked login');
  const modal = await page.$('#login-modal:not(.hidden)');
  console.log('Modal is visible:', !!modal);
  await browser.close();
})();
