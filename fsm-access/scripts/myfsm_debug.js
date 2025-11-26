const {Builder, By, until} = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const fs = require('fs');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'inspect';
  
  console.log('='.repeat(60));
  console.log('MyFSM Unified Debugging Tool');
  console.log('='.repeat(60));
  console.log(`Mode: ${mode}\n`);
  
  if (!['inspect', 'screenshot', 'manual'].includes(mode)) {
    console.log('Available modes:');
    console.log('  inspect     - Inspect page elements and save HTML');
    console.log('  screenshot  - Take screenshots of each step');
    console.log('  manual      - Open browser and wait for manual inspection');
    console.log('\nUsage: node myfsm_debug.js [mode]');
    console.log('Example: node myfsm_debug.js inspect');
    return;
  }
  
  let driver = await new Builder()
    .forBrowser('MicrosoftEdge')
    .setEdgeOptions(new edge.Options())
    .build();
  
  try {
    await driver.manage().window().maximize();
    
    console.log('Step 1: Navigating to MyFSM...');
    await driver.get('https://myfsm.srv.westpac.com.au/Request/MyRequests');
    await sleep(3000);
    
    const title = await driver.getTitle();
    console.log(`Page Title: ${title}`);
    
    if (mode === 'inspect' || mode === 'screenshot') {
      console.log('\nStep 2: Waiting 30 seconds for manual login (if needed)...');
      await sleep(30000);
    }
    
    if (mode === 'screenshot') {
      console.log('\nCapturing initial page...');
      const screenshot1 = await driver.takeScreenshot();
      fs.writeFileSync('myfsm_step1_initial.png', screenshot1, 'base64');
      console.log('✓ Saved: myfsm_step1_initial.png');
    }
    
    if (mode === 'inspect' || mode === 'screenshot') {
      const pageSource1 = await driver.getPageSource();
      fs.writeFileSync('myfsm_step1_initial.html', pageSource1);
      console.log('✓ Saved: myfsm_step1_initial.html');
      
      console.log('\n=== Looking for "Add" buttons ===');
      const possibleAddButtons = [
        "//button[contains(text(), 'Add')]",
        "//a[contains(text(), 'Add')]",
        "//input[contains(@value, 'Add')]",
        "//*[contains(@class, 'add')]"
      ];
      
      let addButton = null;
      for (const xpath of possibleAddButtons) {
        try {
          const elements = await driver.findElements(By.xpath(xpath));
          if (elements.length > 0) {
            console.log(`Found ${elements.length} element(s) with: ${xpath}`);
            for (let i = 0; i < elements.length; i++) {
              const text = await elements[i].getText();
              const isDisplayed = await elements[i].isDisplayed();
              console.log(`  [${i}] Text: "${text}", Visible: ${isDisplayed}`);
            }
            if (!addButton && elements.length > 0 && await elements[0].isDisplayed()) {
              addButton = elements[0];
            }
          }
        } catch (e) {
          // Skip
        }
      }
      
      if (addButton) {
        console.log('\nClicking "Add a New Request" button...');
        await addButton.click();
        await sleep(3000);
        
        if (mode === 'screenshot') {
          const screenshot2 = await driver.takeScreenshot();
          fs.writeFileSync('myfsm_step2_after_add.png', screenshot2, 'base64');
          console.log('✓ Saved: myfsm_step2_after_add.png');
        }
        
        const pageSource2 = await driver.getPageSource();
        fs.writeFileSync('myfsm_step2_after_add.html', pageSource2);
        console.log('✓ Saved: myfsm_step2_after_add.html');
        
        console.log('\n=== Analyzing form elements ===');
        const selects = await driver.findElements(By.tagName('select'));
        console.log(`Found ${selects.length} select dropdowns:`);
        
        for (let i = 0; i < selects.length; i++) {
          try {
            const id = await selects[i].getAttribute('id');
            const name = await selects[i].getAttribute('name');
            const options = await selects[i].findElements(By.tagName('option'));
            const isDisplayed = await selects[i].isDisplayed();
            
            console.log(`\n  Select[${i}]:`);
            console.log(`    ID: ${id}`);
            console.log(`    Name: ${name}`);
            console.log(`    Visible: ${isDisplayed}`);
            console.log(`    Options: ${options.length}`);
            
            if (options.length < 50) {
              for (let j = 0; j < options.length; j++) {
                const optText = await options[j].getText();
                console.log(`      [${j}] ${optText}`);
              }
            } else {
              for (let j = 0; j < 10; j++) {
                const optText = await options[j].getText();
                console.log(`      [${j}] ${optText}`);
              }
              console.log(`      ... and ${options.length - 10} more`);
            }
          } catch (e) {
            console.log(`  Select[${i}]: Error - ${e.message}`);
          }
        }
        
        const textareas = await driver.findElements(By.tagName('textarea'));
        const textInputs = await driver.findElements(By.xpath("//input[@type='text']"));
        console.log(`\nFound ${textareas.length} textarea elements`);
        console.log(`Found ${textInputs.length} text input elements`);
        
        console.log('\n=== Searching for role-related content ===');
        const bodyText = await driver.findElement(By.tagName('body')).getText();
        const keywords = ['EW_SEL', 'DW_SEL', 'WD_', 'role', 'Role'];
        
        keywords.forEach(keyword => {
          if (bodyText.includes(keyword)) {
            console.log(`✓ Found keyword: "${keyword}"`);
          }
        });
      } else {
        console.log('\n⚠ No Add button found');
      }
    }
    
    if (mode === 'manual') {
      console.log('\n=== MANUAL INSPECTION MODE ===');
      console.log('The browser will stay open until you press Ctrl+C');
      console.log('You can manually navigate and inspect elements\n');
      
      await new Promise(() => {}); // Wait forever
    } else {
      console.log('\n✅ Debug complete. Browser will close in 10 seconds...');
      await sleep(10000);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (mode !== 'manual') {
      await driver.quit();
    }
  }
}

main().catch(console.error);
