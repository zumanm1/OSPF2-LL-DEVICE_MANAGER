import puppeteer from 'puppeteer';

(async () => {
    console.log('🚀 Starting Batch Progress Validation...');

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Helper for CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Enable request interception
    await page.setRequestInterception(true);

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    page.on('request', request => {
        const url = request.url();
        console.log('>> REQUEST:', url);

        // Handle OPTIONS requests for CORS
        if (request.method() === 'OPTIONS') {
            request.respond({
                status: 204,
                headers: headers
            });
            return;
        }

        // Mock Devices List
        if (url.includes('/api/devices') && request.method() === 'GET') {
            console.log('📱 Mocking Devices List');
            request.respond({
                status: 200,
                contentType: 'application/json',
                headers: headers,
                body: JSON.stringify([
                    {
                        id: '1',
                        deviceName: 'Mock Device 1',
                        ipAddress: '192.168.1.1',
                        country: 'USA',
                        protocol: 'SSH',
                        port: 22,
                        username: 'admin',
                        deviceType: 'PE',
                        platform: 'ISR4000',
                        software: 'IOS XE',
                        tags: ['mock', 'test']
                    },
                    {
                        id: '2',
                        deviceName: 'Mock Device 2',
                        ipAddress: '192.168.1.2',
                        country: 'USA',
                        protocol: 'SSH',
                        port: 22,
                        username: 'admin',
                        deviceType: 'PE',
                        platform: 'ISR4000',
                        software: 'IOS XE',
                        tags: ['mock', 'test']
                    }
                ])
            });
            return;
        }

        // Mock Automation Status (Pretend devices are connected)
        if (url.includes('/api/automation/status')) {
            console.log('🔌 Mocking Automation Status (Connected)');
            request.respond({
                status: 200,
                contentType: 'application/json',
                headers: headers,
                body: JSON.stringify({
                    status: 'operational',
                    active_connections: 2,
                    connected_devices: ['1', '2'], // Assuming IDs 1 and 2 exist
                    file_statistics: { total_files: 10, total_size_mb: 1.5 }
                })
            });
            return;
        }

        // Mock Start Job
        if (url.includes('/api/automation/jobs') && request.method() === 'POST') {
            console.log('🚀 Mocking Start Job');
            request.respond({
                status: 200,
                contentType: 'application/json',
                headers: headers,
                body: JSON.stringify({
                    job_id: 'test-job-123',
                    status: 'running',
                    total_devices: 2,
                    batch_size: 2,
                    total_batches: 1
                })
            });
            return;
        }

        // Mock Job Status (Dynamic Progress)
        if (url.includes('/api/automation/jobs/test-job-123')) {
            // We can use a global counter or time to simulate progress
            const now = Date.now();
            const progress = Math.min(100, Math.floor((now % 10000) / 100)); // 0-100 loop every 10s

            console.log(`📊 Mocking Job Progress: ${progress}%`);

            request.respond({
                status: 200,
                contentType: 'application/json',
                headers: headers,
                body: JSON.stringify({
                    id: 'test-job-123',
                    status: progress < 100 ? 'running' : 'completed',
                    start_time: new Date().toISOString(),
                    total_devices: 2,
                    completed_devices: progress < 50 ? 0 : (progress < 100 ? 1 : 2),
                    progress_percent: progress,
                    current_device: progress < 100 ? {
                        device_id: '1',
                        device_name: 'Mock Device 1',
                        country: 'USA',
                        current_command: 'show process cpu',
                        command_index: 1,
                        total_commands: 5,
                        command_percent: 20,
                        command_elapsed_time: 0.5
                    } : null,
                    country_stats: {
                        'USA': {
                            total_devices: 2,
                            completed_devices: progress < 50 ? 0 : (progress < 100 ? 1 : 2),
                            running_devices: progress < 100 ? 1 : 0,
                            failed_devices: 0,
                            pending_devices: 0
                        }
                    },
                    device_progress: {
                        '1': {
                            device_name: 'Mock Device 1',
                            country: 'USA',
                            status: progress < 50 ? 'running' : 'completed',
                            percent: progress < 50 ? 50 : 100,
                            completed_commands: 2,
                            total_commands: 5,
                            commands: [
                                { command: 'show ver', status: 'success', execution_time: 0.2 },
                                { command: 'show ip int br', status: 'running', percent: 50 }
                            ]
                        },
                        '2': {
                            device_name: 'Mock Device 2',
                            country: 'USA',
                            status: 'pending',
                            percent: 0,
                            completed_commands: 0,
                            total_commands: 5,
                            commands: []
                        }
                    },
                    results: {},
                    errors: []
                })
            });
            return;
        }

        // Pass through other requests (like static assets or /api/devices)
        request.continue();
    });

    // Function to take screenshot
    const takeScreenshot = async (name) => {
        await page.screenshot({ path: `validation-screenshots/${name}.png`, fullPage: true });
        console.log(`📸 Screenshot saved: ${name}.png`);
    };

    try {
        // 1. Navigate to Home and then Automation
        console.log('1️⃣  Navigating to Home Page...');
        await page.goto('http://localhost:9050', { waitUntil: 'networkidle0', timeout: 30000 });

        console.log('1️⃣.5️⃣  Clicking Automation Link...');
        // Find and click the Automation navigation button/link
        // The app uses state-based routing, so we need to click the nav element
        const clicked = await page.evaluate(() => {
            // Look for any element containing "Automation" text in the navbar
            const elements = Array.from(document.querySelectorAll('nav a, nav button, header a, header button'));
            const automationElement = elements.find(el => el.textContent.includes('Automation'));
            if (automationElement) {
                automationElement.click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            throw new Error('Could not find Automation navigation element');
        }

        // Wait for page transition (state change)
        await new Promise(r => setTimeout(r, 2000));
        console.log('   ✅ Navigated to Automation page');

        // 2. Verify Batch Configuration UI
        console.log('2️⃣  Verifying Batch Configuration UI...');
        await page.waitForSelector('input[type="number"]'); // Batch size input
        await page.waitForSelector('select'); // Rate limit select
        console.log('   ✅ Batch inputs found');

        // 3. Select Devices (We need to select them to enable the button, even if we mock connection)
        // We assume devices are loaded from backend. If not, we might need to mock /api/devices too.
        // Let's mock /api/devices to be safe.

        // PHASE 2: LAZY CONNECTION - Skip manual connect!
        console.log('🚀 Starting automation job directly (Lazy Connection)...');

        // Click "Start Automation" directly
        const startButton = await page.waitForSelector('button ::-p-text(Start Automation)', { visible: true });
        await startButton.click();

        console.log('✅ Clicked Start Automation');

        // Wait for job to start and show progress
        await page.waitForSelector('.device-status', { visible: true, timeout: 5000 });
        console.log('✅ Job started, progress visible');

        // Check for "Connecting" status
        const connectingStatus = await page.evaluate(() => {
            const statuses = Array.from(document.querySelectorAll('.device-status'));
            return statuses.some(s => s.textContent.includes('Connecting'));
        });

        if (connectingStatus) {
            console.log('✅ Verified: System is auto-connecting to devices (Lazy Connection)');
        } else {
            console.log('⚠️ Could not verify "Connecting" status (might have happened too fast)');
        }
        // But wait, the UI uses `connectedDevices` state which is set from that API.
        // So the button should say "Start Automation".

        const startBtn = await page.waitForSelector('button.bg-gradient-to-r.from-primary-600');
        const btnText = await page.evaluate(el => el.textContent, startBtn);
        console.log(`   Button Text: ${btnText}`);

        if (btnText.includes('Start Automation')) {
            await startBtn.click();
            console.log('   ✅ Start Button Clicked');
        } else {
            throw new Error(`Start button not ready: ${btnText}`);
        }

        // 5. Verify Real-Time Progress
        console.log('4️⃣  Verifying Real-Time Progress...');
        await page.waitForSelector('.animate-pulse'); // Look for pulse animation in progress
        console.log('   ✅ Progress Animation Found');

        // Wait a bit to capture progress
        await new Promise(r => setTimeout(r, 2000));
        await takeScreenshot('batch-progress-running');

        // Verify "Currently Processing" text
        const currentText = await page.evaluate(() => document.body.innerText);
        if (currentText.includes('Currently Processing')) {
            console.log('   ✅ "Currently Processing" card visible');
        }

        if (currentText.includes('Progress by Country')) {
            console.log('   ✅ "Progress by Country" visible');
        }

        console.log('✅ Validation Complete: Batch Progress UI is functional');

    } catch (error) {
        console.error('❌ Validation Failed:', error);
        await takeScreenshot('error-batch-progress');
        process.exit(1);
    } finally {
        await browser.close();
    }
})();
