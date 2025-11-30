const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE_URL = 'http://localhost:9050';

async function trace() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Capture all console messages with details
    page.on('console', async msg => {
        try {
            const args = msg.args();
            const vals = await Promise.all(args.map(arg => arg.jsonValue().catch(() => arg.toString())));
            console.log('CONSOLE:', vals.join(' '));
        } catch (e) {
            console.log('CONSOLE:', msg.text());
        }
    });
    
    // Capture page errors with full stack
    page.on('pageerror', error => {
        console.log('PAGE_ERROR:', error.message);
        console.log('STACK:', error.stack);
    });

    try {
        // Login
        console.log('Step 1: Login');
        await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle0', timeout: 30000 });
        await page.type('input[type="text"]', 'admin');
        await page.type('input[type="password"]', 'admin123');
        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 2000));
        
        // Navigate to device manager
        console.log('Step 2: Navigate to Device Manager');
        await page.goto(BASE_URL + '/', { waitUntil: 'networkidle0', timeout: 30000 });
        await new Promise(r => setTimeout(r, 1000));
        
        // Create test CSV with CORRECT enum values (matching the template)
        console.log('Step 3: Create valid CSV');
        const csvContent = 'deviceName,ipAddress,protocol,port,country,deviceType,platform,software,tags\ntest-router-1,10.99.99.1,Telnet,23,United States,PE,ISR4000,IOS,test';
        const csvPath = '/tmp/valid-test.csv';
        fs.writeFileSync(csvPath, csvContent);
        console.log('CSV content:', csvContent);
        
        // Check file input exists
        console.log('Step 4: Check file input');
        const fileInput = await page.$('input[type="file"][accept=".csv"]');
        if (fileInput) {
            console.log('File input FOUND');
            
            // Upload file
            console.log('Step 5: Upload CSV');
            await fileInput.uploadFile(csvPath);
            console.log('File uploaded, waiting...');
            await new Promise(r => setTimeout(r, 3000));
            
            // Take screenshot
            await page.screenshot({ path: 'screenshots/trace-result.png', fullPage: true });
            console.log('Screenshot saved');
            
            // Try to click on error details if visible
            const detailsElement = await page.$('details summary');
            if (detailsElement) {
                console.log('Found error details, clicking...');
                await detailsElement.click();
                await new Promise(r => setTimeout(r, 500));
                await page.screenshot({ path: 'screenshots/trace-error-details.png', fullPage: true });
                
                // Read error text
                const errorText = await page.$eval('details pre', el => el.textContent).catch(() => 'No error text');
                console.log('ERROR_DETAILS:', errorText);
            } else {
                console.log('No error details found - checking for modal');
                const modal = await page.$('[role="dialog"]');
                if (modal) {
                    console.log('Modal found!');
                }
            }
        } else {
            console.log('File input NOT FOUND');
        }
        
    } catch (error) {
        console.error('Script error:', error.message);
    } finally {
        await browser.close();
    }
}

trace();
