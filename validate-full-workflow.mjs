








import puppeteer from 'puppeteer';

(async () => {
  console.log('🚀 Starting Full Workflow Validation...');
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Capture console logs
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  // Helper to take screenshots
  const takeScreenshot = async (name) => {
    const path = `validation-screenshots/${name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(`📸 Screenshot saved: ${path}`);
  };

  try {
    // 1. Navigate to Home
    console.log('1️⃣  Navigating to Application...');
    await page.goto('http://localhost:9050', { waitUntil: 'networkidle0' });
    await takeScreenshot('01-home-page');

    // 2. Go to Automation Page
    console.log('2️⃣  Navigating to Automation...');
    
    // Find automation navigation button
    console.log("   Searching for Automation nav button...");
    const navButtons = await page.$$('nav button');
    let automationBtn = null;
    for (const btn of navButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.trim() === 'Automation') {
            automationBtn = btn;
            break;
        }
    }
    
    if (automationBtn) {
        await automationBtn.click();
    } else {
        throw new Error("Automation navigation button not found");
    }
    
    await new Promise(r => setTimeout(r, 1000)); // Wait for transition
    await takeScreenshot('02-automation-page');

    // 3. Select Device
    console.log('3️⃣  Selecting Device...');
    // Target the device list specifically to avoid clicking Navbar logo (which is also cursor-pointer)
    const deviceCard = await page.waitForSelector('.max-w-7xl .cursor-pointer', { timeout: 5000 });
    await deviceCard.click();
    await takeScreenshot('03-device-selected');

    // 4. Click Connect
    console.log('4️⃣  Clicking Connect...');
    const buttons = await page.$$('button');
    let connectBtn;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Connect') && !text.includes('Disconnect')) {
        connectBtn = btn;
        break;
      }
    }
    
    if (connectBtn) {
        await page.evaluate(btn => btn.click(), connectBtn);
        console.log('   Clicked Connect. Waiting for connection...');
        await new Promise(r => setTimeout(r, 10000)); // Wait 10s for connection
        await takeScreenshot('04-connected');
    } else {
        throw new Error("Connect button not found");
    }

    // 5. Verify Start Automation Button
    console.log('5️⃣  Verifying Start Automation Button...');
    const startBtnHandle = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Start Automation'));
    });

    const startBtn = startBtnHandle.asElement();
    if (!startBtn) {
        const allButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.textContent));
        console.log("Current buttons on page:", allButtons);
        
        // Check for error message
        const errorMsg = await page.$eval('.text-red-800', el => el.textContent).catch(() => null);
        if (errorMsg) console.log("Error visible:", errorMsg);
        
        throw new Error("Start Automation button not found in DOM");
    }

    const isDisabled = await page.evaluate(btn => btn.disabled, startBtn);
    if (isDisabled) {
        throw new Error("❌ Start Automation button is still disabled after connection!");
    }
    console.log('   ✅ Start Automation button is ENABLED!');

    // 6. Start Automation Job
    console.log('6️⃣  Starting Automation Job...');
    await page.evaluate(btn => btn.click(), startBtn);
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('05-job-running');
    
    // Wait for job completion (mock is fast but let's give it time)
    console.log('   Waiting for job completion...');
    await new Promise(r => setTimeout(r, 5000));
    await takeScreenshot('06-job-completed');

    // 7. Check Data Save Page
    console.log('7️⃣  Checking Data Save Page...');
    const fileNavButtons = await page.$$('nav button');
    for (const btn of fileNavButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Data Save')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 1000));
    await takeScreenshot('07-data-save-page');

    // 8. Check Transformation Page
    console.log('8️⃣  Checking Transformation Page...');
    const transNavButtons = await page.$$('nav button');
    for (const btn of transNavButtons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Transformation')) {
            await btn.click();
            break;
        }
    }
    await new Promise(r => setTimeout(r, 1000));
    
    // Click Generate
    const generateBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Generate Topology'));
    });
    if (generateBtn) {
        await page.evaluate(btn => btn.click(), generateBtn);
        await new Promise(r => setTimeout(r, 2000));
        await takeScreenshot('08-topology-generated');
        console.log('   ✅ Topology Generation Triggered');
    }

    console.log('✅ Full Workflow Validation Successful!');

  } catch (error) {
    console.error('❌ Validation Failed:', error);
    await takeScreenshot('error-validation-failed');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
