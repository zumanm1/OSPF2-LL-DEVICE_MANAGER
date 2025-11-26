/**
 * Puppeteer Test: Validate Navbar Links
 * This script validates that all navbar links are visible and functional
 */

import puppeteer from 'puppeteer';

const FRONTEND_URL = 'http://localhost:9050';
const TIMEOUT = 10000;

const EXPECTED_NAV_LINKS = [
  { text: 'Device Manager', href: '/' },
  { text: 'Automation', href: '/automation' },
  { text: 'Data Save', href: '/data-save' },
  { text: 'Interface Costs', href: '/interface-costs' },
  { text: 'Transformation', href: '/transformation' }
];

async function testNavbar() {
  console.log('🚀 Starting Navbar Validation Test\n');
  console.log(`📍 Testing URL: ${FRONTEND_URL}`);
  console.log('=' .repeat(60) + '\n');

  let browser;
  let allPassed = true;
  const results = [];

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set viewport to desktop size (important for hidden md:block)
    await page.setViewport({ width: 1920, height: 1080 });

    console.log('📱 Viewport set to 1920x1080 (Desktop)');
    console.log('');

    // Navigate to homepage
    console.log('🔄 Loading homepage...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });
    console.log('✅ Homepage loaded\n');

    // Take screenshot of initial state
    await page.screenshot({ path: '/tmp/navbar-test-initial.png', fullPage: false });
    console.log('📸 Screenshot saved: /tmp/navbar-test-initial.png\n');

    // Find all navigation links in the navbar
    console.log('🔍 Scanning navbar for links...\n');

    const navLinks = await page.evaluate(() => {
      const links = [];
      const navElement = document.querySelector('nav');
      if (!navElement) {
        return { error: 'No nav element found', links: [] };
      }

      const allLinks = navElement.querySelectorAll('a');
      allLinks.forEach(link => {
        const rect = link.getBoundingClientRect();
        links.push({
          text: link.textContent.trim(),
          href: link.getAttribute('href'),
          visible: rect.width > 0 && rect.height > 0,
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y
        });
      });

      return { error: null, links };
    });

    if (navLinks.error) {
      console.log(`❌ ERROR: ${navLinks.error}`);
      allPassed = false;
    } else {
      console.log(`📊 Found ${navLinks.links.length} links in navbar:\n`);

      // Check each expected link
      for (const expected of EXPECTED_NAV_LINKS) {
        const found = navLinks.links.find(l =>
          l.href === expected.href ||
          l.text.includes(expected.text)
        );

        if (found) {
          const status = found.visible ? '✅ VISIBLE' : '❌ HIDDEN';
          console.log(`  ${status}: "${found.text}" -> ${found.href}`);
          console.log(`          Position: (${found.x}, ${found.y}), Size: ${found.width}x${found.height}`);

          results.push({
            expected: expected.text,
            found: true,
            visible: found.visible,
            href: found.href
          });

          if (!found.visible) {
            allPassed = false;
          }
        } else {
          console.log(`  ❌ NOT FOUND: "${expected.text}" (expected href: ${expected.href})`);
          results.push({
            expected: expected.text,
            found: false,
            visible: false,
            href: expected.href
          });
          allPassed = false;
        }
        console.log('');
      }
    }

    // Now test clicking on Interface Costs link
    console.log('=' .repeat(60));
    console.log('\n🖱️  Testing Navigation to Interface Costs...\n');

    try {
      // Click on Interface Costs link
      const interfaceCostsLink = await page.$('a[href="/interface-costs"]');

      if (interfaceCostsLink) {
        console.log('✅ Interface Costs link element found');

        await interfaceCostsLink.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});

        // Wait for potential React routing
        await new Promise(resolve => setTimeout(resolve, 1000));

        const currentUrl = page.url();
        console.log(`📍 Current URL after click: ${currentUrl}`);

        if (currentUrl.includes('/interface-costs')) {
          console.log('✅ Successfully navigated to Interface Costs page');

          // Check if the page content loaded
          const pageTitle = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            return h1 ? h1.textContent : null;
          });

          if (pageTitle) {
            console.log(`📄 Page title: "${pageTitle}"`);
          }

          // Take screenshot
          await page.screenshot({ path: '/tmp/navbar-test-interface-costs.png', fullPage: false });
          console.log('📸 Screenshot saved: /tmp/navbar-test-interface-costs.png');
        } else {
          console.log('❌ Navigation failed - URL did not change to /interface-costs');
          allPassed = false;
        }
      } else {
        console.log('❌ Interface Costs link element NOT FOUND in DOM');
        allPassed = false;
      }
    } catch (navError) {
      console.log(`❌ Navigation test failed: ${navError.message}`);
      allPassed = false;
    }

    // Test mobile viewport (to check if links are hidden)
    console.log('\n' + '=' .repeat(60));
    console.log('\n📱 Testing Mobile Viewport (375px width)...\n');

    await page.setViewport({ width: 375, height: 667 });
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT });

    const mobileLinks = await page.evaluate(() => {
      const links = [];
      const navElement = document.querySelector('nav');
      if (!navElement) return links;

      const allLinks = navElement.querySelectorAll('a[href^="/"]');
      allLinks.forEach(link => {
        const rect = link.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(link);
        const parentStyle = link.parentElement ? window.getComputedStyle(link.parentElement) : null;

        links.push({
          text: link.textContent.trim(),
          href: link.getAttribute('href'),
          visible: rect.width > 0 && rect.height > 0,
          display: computedStyle.display,
          parentDisplay: parentStyle ? parentStyle.display : 'N/A'
        });
      });

      return links;
    });

    console.log('📊 Mobile viewport nav links:');
    for (const link of mobileLinks) {
      const status = link.visible ? '✅' : '⚠️ ';
      console.log(`  ${status} "${link.text}" - visible: ${link.visible}, display: ${link.display}`);
    }

    // Take mobile screenshot
    await page.screenshot({ path: '/tmp/navbar-test-mobile.png', fullPage: false });
    console.log('\n📸 Mobile screenshot saved: /tmp/navbar-test-mobile.png');

  } catch (error) {
    console.log(`\n❌ Test Error: ${error.message}`);
    allPassed = false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('\n📋 TEST SUMMARY\n');

  const passed = results.filter(r => r.found && r.visible).length;
  const total = EXPECTED_NAV_LINKS.length;

  console.log(`   Total expected links: ${total}`);
  console.log(`   Links found & visible: ${passed}`);
  console.log(`   Links missing/hidden: ${total - passed}`);
  console.log('');

  if (allPassed) {
    console.log('✅ ALL TESTS PASSED - Navbar is working correctly!');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED - See details above');
    console.log('\n🔧 POTENTIAL ISSUES:');
    console.log('   1. Links may be hidden on mobile (hidden md:block CSS class)');
    console.log('   2. Navigation links may not be visible due to overflow');
    console.log('   3. Missing hamburger menu for mobile navigation');
    process.exit(1);
  }
}

testNavbar();
