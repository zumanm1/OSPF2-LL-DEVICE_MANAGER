import puppeteer from 'puppeteer';

(async () => {
  console.log('🚀 Starting Reproduction Script...');
  
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  const takeScreenshot = async (name) => {
    await page.screenshot({ path: `validation-screenshots/${name}.png`, fullPage: true });
    console.log(`📸 Screenshot saved: ${name}.png`);
  };

  try {
    // 1. Navigate to Automation Page
    console.log('1️⃣  Navigating to Automation Page...');
    await page.goto('http://localhost:9050', { waitUntil: 'networkidle0' });
    
    // Find link to automation page and click it
    // Assuming the user navigates via navbar
    const automationLink = await page.waitForSelector('button[data-page="automation"]', { timeout: 5000 }).catch(() => null);
    
    if (!automationLink) {
       // Try finding by text if data attribute not present
       const buttons = await page.$$('button');
       for (const btn of buttons) {
         const text = await page.evaluate(el => el.textContent, btn);
         if (text.includes('Automation')) {
           await btn.click();
           break;
         }
       }
    } else {
       await automationLink.click();
    }
    
    // Wait for Automation page to load
    await page.waitForSelector('h1', { timeout: 5000 });
    const heading = await page.$eval('h1', el => el.textContent);
    if (!heading.includes('Network Automation')) {
        // Maybe we are on the wrong page, try direct navigation
        console.log('   Trying direct navigation to /automation (if router supports it)');
        // React router usually handles client side, but let's try interacting with UI first
        // If we are still on home, maybe find the "Automation" tab/button in navbar
        
        // Let's look at the navbar implementation in App.tsx or Navbar.tsx.
        // Based on App.tsx read earlier, it uses state 'currentPage'.
        // So we need to find the button that sets currentPage to 'automation'.
        
        // Let's try to find the text "Automation" in the navbar
        const navButtons = await page.$$('nav button');
        for (const btn of navButtons) {
            const text = await page.evaluate(el => el.textContent, btn);
            if (text && text.includes('Automation')) {
                console.log('   Clicking Automation nav button');
                await btn.click();
                await new Promise(r => setTimeout(r, 1000)); // Wait for transition
                break;
            }
        }
    }

    await takeScreenshot('automation-page-loaded');

    // 2. Select a Device
    console.log('2️⃣  Selecting Device...');
    const deviceCard = await page.waitForSelector('.cursor-pointer', { timeout: 5000 });
    await deviceCard.click();
    await takeScreenshot('device-selected');
    
    // 3. Check Start Automation Button Status
    console.log('3️⃣  Checking Start Automation Button Status...');
    // Find the button with text "Start Automation"
    const startBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Start Automation'));
    });

    if (!startBtn) {
        throw new Error("Start Automation button not found");
    }

    const isDisabled = await page.evaluate(btn => btn.disabled, startBtn);
    console.log(`   Start Automation Disabled? ${isDisabled}`);
    
    if (!isDisabled) {
        console.log('   ❌ Start Automation is enabled! Issue not reproduced (or already fixed?)');
    } else {
        console.log('   ✅ Start Automation is disabled (Expected behavior).');
        console.log('   User issue: They want to click this but it is greyed out.');
    }

    // 4. Click Connect
    console.log('4️⃣  Clicking Connect...');
    const connectBtn = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(b => b.textContent.includes('Connect') && !b.textContent.includes('Disconnect'));
    });
    
    if (connectBtn) {
        await page.evaluate(btn => btn.click(), connectBtn);
        console.log('   Clicked Connect. Waiting for response...');
        
        // Wait a bit for connection attempt
        await new Promise(r => setTimeout(r, 5000));
        await takeScreenshot('after-connect-click');
        
        // Check if error appeared
        const errorMsg = await page.$('.text-red-800');
        if (errorMsg) {
            const errorText = await page.evaluate(el => el.textContent, errorMsg);
            console.log(`   ❌ Connection Failed with error: ${errorText}`);
            console.log('   This confirms why Start Automation remains disabled.');
        } else {
            console.log('   ✅ Connection Success (or no error shown).');
            // Check Start Automation again
            const isDisabledAfter = await page.evaluate(btn => btn.disabled, startBtn);
            console.log(`   Start Automation Disabled After Connect? ${isDisabledAfter}`);
        }
    }

  } catch (error) {
    console.error('❌ Reproduction Script Failed:', error);
    await takeScreenshot('reproduction-failed');
  } finally {
    await browser.close();
  }
})();
