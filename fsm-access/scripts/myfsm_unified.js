const {Builder, By, until, Key} = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const fs = require('fs');

// All system configurations
const SYSTEMS = {
  'EDW-TDP7': {
    name: 'EDW-TDP7 (PROD)',
    roles: [
      'Customer_General Personal data',
      'CustomerGroup_External Financial Planner Wealth Data',
      'CustomerGroup_Internal Financial Dealer Group Wealth Data',
      'CustomerGroup_Internal Financial Advisor Wealth Data',
      'CustomerGroup_Wealth Customers',
      'CustomerGroup_White Label',
      'Customer_Credit Card Numbers',
      'Financial_GL_Books - 1 & 2 (previously GL WBC and GL Book 2)',
      'EW_SEL_EWP1AFLASH',
      'EW_SEL_EWP1AFLASHLOG',
      'EW_SEL_EWP1VFACE_BASE',
      'EW_SEL_EWP1VSRDE_BASE',
      'EW_SEL_EWP1VTBLA_ERR',
      'EW_SEL_EWP1VCCR_BASE',
      'EW_SEL_EWP1AEFS'
    ]
  },
  'SGDWTDP7': {
    name: 'SGDWTDP7(PROD)',
    roles: [
      'DW_SEL_PROD_Base',
      'DW_SEL_DWPVALMI',
      'DW_Sel_DWPVTCS_Base'
    ]
  },
  'WGDW': {
    name: 'WGDW',
    roles: [
      'WD_BRDM_GENERAL',
      'WD_CRDM_GENERAL',
      'WD_CRDM_RISK',
      'WD_NW_ALL_ACCT',
      'WD_NW_ACCOUNT_ALL',
      'WD_NW_ACCOUNT',
      'WD_NW_COLLECT',
      'WD_NW_CREDIT',
      'WD_NW_CREDIT_FULL',
      'WD_NW_CREDIT_CARD',
      'WD_NW_ESR',
      'WD_NW_MORTGAGE_MSS',
      'WD_NW_MORTGAGE_OS',
      'WD_NW_NZ_DATA',
      'WD_NW_REF',
      'WD_CREDIT_MIS_DEMI',
      'WD_NW_CUSTOMER',
      'WD_NW_CDMS'
    ]
  }
};

const BASE_URL = 'https://myfsm.srv.westpac.com.au/Request/MyRequests';
const COMMENT = 'New starter position on Corporate Services, CR&A, Regulatory Reporting Uplift team. This access is required for regulatory EFS APRA reporting.';
const Q1_ANSWER = 'I am Senior Data Analyst and new member of the Corporate Services, CR&A, Regulatory Reporting Uplift team. I require this access for the management of regulatory EFS APRA reporting';
const Q2_ANSWER = 'N/A - Data will not be stored.';
const Q3_ANSWER = 'N/A - no entity/party will access this data as it is not extracted by me.';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function submitRequest(driver, systemName, roleName) {
  const result = { 
    system: systemName,
    role: roleName, 
    status: 'pending', 
    requestId: null, 
    notes: [],
    requiresManualAction: false
  };
  
  try {
    console.log(`\n========== Processing: ${systemName} - ${roleName} ==========`);
    
    await driver.get(BASE_URL);
    await sleep(2000);
    
    const addButton = await driver.wait(
      until.elementLocated(By.xpath("//button[contains(text(), 'Add a New Request') or contains(text(), 'Add New Request')] | //a[contains(text(), 'Add a New Request')]")),
      10000
    );
    await addButton.click();
    console.log('✓ Clicked "Add a New Request"');
    await sleep(2000);
    
    const systemDropdown = await driver.wait(
      until.elementLocated(By.id('ddl_system')),
      10000
    );
    const options = await systemDropdown.findElements(By.tagName('option'));
    
    let systemFound = false;
    for (const option of options) {
      const text = await option.getText();
      if (text.includes(systemName) || text === systemName) {
        await option.click();
        console.log(`✓ Selected system: ${text}`);
        systemFound = true;
        break;
      }
    }
    
    if (!systemFound) {
      throw new Error(`System "${systemName}" not found in dropdown`);
    }
    
    await sleep(2000);
    
    // Try to find and select the role
    const roleElements = await driver.findElements(By.xpath(`//*[contains(text(), '${roleName}')]`));
    if (roleElements.length > 0) {
      await roleElements[0].click();
      console.log(`✓ Selected role: ${roleName}`);
    } else {
      result.status = 'role_not_found';
      result.notes.push('Role element not found on page - may require manual selection');
      result.requiresManualAction = true;
      console.log(`⚠ Role "${roleName}" not found - may require manual intervention`);
      return result;
    }
    
    await sleep(1000);
    
    // Look for comment/justification field
    const commentFields = await driver.findElements(By.xpath("//textarea | //input[@type='text' and contains(@id, 'comment')]"));
    if (commentFields.length > 0) {
      await commentFields[0].clear();
      await commentFields[0].sendKeys(COMMENT);
      console.log('✓ Entered comment');
    }
    
    // Check for special forms
    const pageText = await driver.findElement(By.tagName('body')).getText();
    
    if (pageText.toLowerCase().includes('prescribed employee')) {
      result.requiresManualAction = true;
      result.notes.push('REQUIRES MANUAL ACTION: Prescribed Employee form - physical signature needed');
      console.log('⚠ Prescribed Employee form detected - requires manual signature');
    }
    
    if (pageText.toLowerCase().includes('customer name') && pageText.toLowerCase().includes('address')) {
      console.log('✓ Customer Name & Address form detected - filling in standard answers');
      
      // Try to fill in the three questions
      const textareas = await driver.findElements(By.tagName('textarea'));
      if (textareas.length >= 3) {
        await textareas[0].sendKeys(Q1_ANSWER);
        await textareas[1].sendKeys(Q2_ANSWER);
        await textareas[2].sendKeys(Q3_ANSWER);
        console.log('✓ Filled Customer Name & Address form');
      }
    }
    
    // Try to submit
    const submitButtons = await driver.findElements(By.xpath("//button[contains(text(), 'Accept') or contains(text(), 'Submit')] | //input[@type='submit']"));
    if (submitButtons.length > 0 && !result.requiresManualAction) {
      await submitButtons[0].click();
      console.log('✓ Clicked Submit');
      await sleep(3000);
      
      // Try to capture request ID
      const confirmText = await driver.findElement(By.tagName('body')).getText();
      const reqIdMatch = confirmText.match(/(?:Request|REQ)[\s_#:]*(\d+)/i);
      if (reqIdMatch) {
        result.requestId = reqIdMatch[1];
        result.status = 'submitted';
        console.log(`✓ Request submitted - ID: ${result.requestId}`);
      } else {
        result.status = 'submitted_no_id';
        result.notes.push('Submitted but could not capture request ID');
      }
    } else if (result.requiresManualAction) {
      result.status = 'pending_manual';
      console.log('⚠ Manual action required - not submitting automatically');
    }
    
  } catch (error) {
    result.status = 'error';
    result.notes.push(error.message);
    console.error(`✗ Error: ${error.message}`);
  }
  
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const systemKey = args[0] ? args[0].toUpperCase() : null;
  const roleName = args.slice(1).join(' ');
  
  console.log('='.repeat(60));
  console.log('MyFSM Single Access Request Automation');
  console.log('='.repeat(60));
  
  if (!systemKey || !roleName) {
    console.log('\nUsage: node myfsm_unified.js <SYSTEM> <ROLE_NAME>');
    console.log('\nAvailable systems:');
    Object.entries(SYSTEMS).forEach(([key, config]) => {
      console.log(`\n  ${key}:`);
      config.roles.forEach((role, i) => {
        console.log(`    ${i + 1}. ${role}`);
      });
    });
    console.log('\nExamples:');
    console.log('  node myfsm_unified.js EDW-TDP7 "Customer_General Personal data"');
    console.log('  node myfsm_unified.js WGDW WD_BRDM_GENERAL');
    console.log('  node myfsm_unified.js SGDWTDP7 DW_SEL_PROD_Base');
    return;
  }
  
  if (!SYSTEMS[systemKey]) {
    console.log(`\nError: System "${systemKey}" not found.`);
    console.log(`Available systems: ${Object.keys(SYSTEMS).join(', ')}`);
    return;
  }
  
  const systemConfig = SYSTEMS[systemKey];
  const matchingRole = systemConfig.roles.find(r => r === roleName || r.toLowerCase() === roleName.toLowerCase());
  
  if (!matchingRole) {
    console.log(`\nError: Role "${roleName}" not found in system ${systemKey}.`);
    console.log(`\nAvailable roles:`);
    systemConfig.roles.forEach((role, i) => {
      console.log(`  ${i + 1}. ${role}`);
    });
    return;
  }
  
  console.log(`\nSystem: ${systemConfig.name}`);
  console.log(`Role: ${matchingRole}\n`);
  
  let driver;
  
  try {
    driver = await new Builder()
      .forBrowser('MicrosoftEdge')
      .setEdgeOptions(new edge.Options())
      .build();
    
    await driver.manage().window().maximize();
    
    const result = await submitRequest(driver, systemConfig.name, matchingRole);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `myfsm_result_${timestamp}.json`;
    fs.writeFileSync(filename, JSON.stringify(result, null, 2));
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('RESULT');
    console.log('='.repeat(60));
    console.log(`Status: ${result.status}`);
    console.log(`Request ID: ${result.requestId || 'N/A'}`);
    console.log(`Requires Manual Action: ${result.requiresManualAction}`);
    if (result.notes.length > 0) {
      console.log(`\nNotes:`);
      result.notes.forEach(note => console.log(`  - ${note}`));
    }
    console.log(`\nResult saved to: ${filename}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    if (driver) {
      console.log('\nClosing browser in 5 seconds...');
      await sleep(5000);
      await driver.quit();
    }
  }
}

main().catch(console.error);
