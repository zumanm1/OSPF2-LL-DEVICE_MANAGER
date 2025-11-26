import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const BACKEND_URL = 'http://localhost:9051';

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    console.log('\n\x1b[34m╔════════════════════════════════════════════════════╗\x1b[0m');
    console.log('\x1b[34m║   TOPOLOGY VISUALIZATION VALIDATION                ║\x1b[0m');
    console.log('\x1b[34m║   Verifying OSPF Links Appear in UI                ║\x1b[0m');
    console.log('\x1b[34m╚════════════════════════════════════════════════════╝\x1b[0m\n');

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1920, height: 1080 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Step 1: Check API returns topology with links
        console.log('\x1b[36m📡 Checking API endpoint...\x1b[0m');
        const apiResponse = await fetch(`${BACKEND_URL}/api/transform/topology/latest`);
        const topology = await apiResponse.json();
        console.log(`\x1b[32m✅ API Response: ${topology.nodes.length} nodes, ${topology.links.length} links\x1b[0m\n`);

        if (topology.links.length === 0) {
            console.log('\x1b[31m❌ FAIL: API returns 0 links!\x1b[0m');
            throw new Error('Topology has no links');
        }

        // Step 2: Navigate to Transformation page
        console.log('\x1b[36m🌐 Navigating to Transformation page...\x1b[0m');
        await page.goto(`${FRONTEND_URL}`, { waitUntil: 'networkidle0', timeout: 10000 });

        // Click Transformation tab
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const transformBtn = buttons.find(b => b.textContent?.includes('Transformation'));
            if (transformBtn) transformBtn.click();
        });

        await wait(2000);
        await page.screenshot({ path: 'topology_01_page_loaded.png', fullPage: true });
        console.log('\x1b[36m📸 Screenshot: topology_01_page_loaded.png\x1b[0m');

        // Step 3: Check if topology canvas/SVG exists
        console.log('\x1b[36m🔍 Checking for topology visualization...\x1b[0m');
        const hasTopology = await page.evaluate(() => {
            const svg = document.querySelector('svg');
            const canvas = document.querySelector('canvas');
            return !!(svg || canvas);
        });

        if (!hasTopology) {
            console.log('\x1b[33m⚠️  No SVG/Canvas found - topology may not be rendered yet\x1b[0m');
        } else {
            console.log('\x1b[32m✅ Topology visualization element found\x1b[0m');
        }

        // Step 4: Look for node circles
        const nodeCount = await page.evaluate(() => {
            const circles = document.querySelectorAll('circle');
            return circles.length;
        });
        console.log(`\x1b[36m🔵 Found ${nodeCount} circle elements (nodes)\x1b[0m`);

        // Step 5: Look for links/lines
        const linkCount = await page.evaluate(() => {
            const lines = document.querySelectorAll('line, path[stroke]');
            return lines.length;
        });
        console.log(`\x1b[36m🔗 Found ${linkCount} line/path elements (links)\x1b[0m`);

        // Step 6: Check for node labels
        const labelCount = await page.evaluate(() => {
            const labels = Array.from(document.querySelectorAll('text'));
            const nodeLabels = labels.filter(t => {
                const text = t.textContent?.trim() || '';
                return text.match(/r\d+|zwe|usa|gbr|deu/i);
            });
            return nodeLabels.length;
        });
        console.log(`\x1b[36m🏷️  Found ${labelCount} node labels\x1b[0m\n`);

        // Step 7: Take final screenshot
        await page.screenshot({ path: 'topology_02_final.png', fullPage: true });
        console.log('\x1b[36m📸 Screenshot: topology_02_final.png\x1b[0m\n');

        // Validation Summary
        console.log('\x1b[34m═══════════════════════════════════════════════════\x1b[0m');
        console.log('\x1b[34mVALIDATION RESULTS\x1b[0m');
        console.log('\x1b[34m═══════════════════════════════════════════════════\x1b[0m');
        console.log(`\x1b[32m✅ API Nodes: ${topology.nodes.length}\x1b[0m`);
        console.log(`\x1b[32m✅ API Links: ${topology.links.length}\x1b[0m`);
        console.log(`${nodeCount >= 10 ? '\x1b[32m✅' : '\x1b[31m❌'} UI Nodes: ${nodeCount}\x1b[0m`);
        console.log(`${linkCount >= 10 ? '\x1b[32m✅' : '\x1b[31m❌'} UI Links: ${linkCount}\x1b[0m`);
        console.log(`${labelCount >= 10 ? '\x1b[32m✅' : '\x1b[31m❌'} UI Labels: ${labelCount}\x1b[0m`);

        if (topology.links.length > 0 && linkCount > 0) {
            console.log('\n\x1b[32m╔═══════════════════════════════════════════════╗\x1b[0m');
            console.log('\x1b[32m║   ✅ TOPOLOGY LINKS VALIDATED SUCCESSFULLY   ║\x1b[0m');
            console.log('\x1b[32m╚═══════════════════════════════════════════════╝\x1b[0m\n');
        } else {
            console.log('\n\x1b[31m╔═══════════════════════════════════════════════╗\x1b[0m');
            console.log('\x1b[31m║   ❌ TOPOLOGY LINKS NOT VISIBLE IN UI        ║\x1b[0m');
            console.log('\x1b[31m╚═══════════════════════════════════════════════╝\x1b[0m\n');
        }

        await wait(5000); // Keep browser open for 5 seconds to view

    } catch (error) {
        console.error('\x1b[31m❌ Error during validation:\x1b[0m', error.message);
        throw error;
    } finally {
        await browser.close();
    }
})();
