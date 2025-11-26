const {Builder, By, until} = require('selenium-webdriver');
const edge = require('selenium-webdriver/edge');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG_PATH = path.join(__dirname, 'myfsm_config.json');
const LOG_DIR = path.join(__dirname, '../../tmp');
const LOG_FILE = path.join(LOG_DIR, 'request_history.jsonl');
const BASE_URL = 'https://myfsm.srv.westpac.com.au/Request/AddRequest';

// Load Config
let CONFIG;
try {
    CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
    console.error(`Error loading config from ${CONFIG_PATH}:`, e.message);
    process.exit(1);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
}

async function appendLog(result) {
    await ensureLogDir();
    const logEntry = JSON.stringify({ timestamp: new Date().toISOString(), ...result }) + '\n';
    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(`Result logged to ${LOG_FILE}`);
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
        
        // Direct navigation with pagination set to ALL (grid_ac-size=0) to bypass UI issues
        const targetUrl = `${BASE_URL}?systemName=${encodeURIComponent(systemName)}&grid_ac-size=0`;
        console.log(`Navigating to: ${targetUrl}`);
        await driver.get(targetUrl);
        
        // Wait for page load (look for table or body)
        await driver.wait(until.elementLocated(By.tagName('body')), 10000);
        await sleep(2000);
        
        // Find Role Link
        // Using JS click to ensure reliability
        const roleElements = await driver.findElements(By.xpath(`//a[contains(text(), '${roleName}')]`));
        
        if (roleElements.length > 0) {
            const tagName = await roleElements[0].getTagName();
            console.log(`✓ Found role element (<${tagName}>). Clicking via JS...`);
            await driver.executeScript("arguments[0].click();", roleElements[0]);
            console.log(`✓ Selected role: ${roleName}`);
            
            // Handle potential "PreCheck" confirmation dialog
            try {
                await sleep(2000);
                const dialogButtons = await driver.findElements(By.xpath("//button[contains(text(), 'YES, Continue')]"));
                if (dialogButtons.length > 0 && await dialogButtons[0].isDisplayed()) {
                    console.log('✓ Handling confirmation dialog...');
                    await dialogButtons[0].click();
                    await sleep(2000);
                }
            } catch (e) {
                // Ignore if no dialog
            }

            // Wait for the Form to Load
            try {
                await driver.wait(until.elementLocated(By.tagName('textarea')), 10000);
                console.log('✓ Form loaded');
            } catch (e) {
                console.log('⚠ Timeout waiting for form/textarea - check if role requires special handling');
            }
            
            // Fill Comment
            const commentFields = await driver.findElements(By.xpath("//textarea | //input[@type='text' and contains(@id, 'comment')]"));
            if (commentFields.length > 0) {
                await commentFields[0].clear();
                await commentFields[0].sendKeys(CONFIG.defaults.comment);
                console.log('✓ Entered comment');
            }
            
            // Check for Special Forms (Prescribed Employee / Customer Name & Address)
            const pageText = await driver.findElement(By.tagName('body')).getText();
            const pageTextLower = pageText.toLowerCase();
            
            if (pageTextLower.includes('prescribed employee')) {
                result.requiresManualAction = true;
                result.notes.push('REQUIRES MANUAL ACTION: Prescribed Employee form - physical signature needed');
                console.log('⚠ Prescribed Employee form detected - requires manual signature');
            }
            
            if (pageTextLower.includes('customer name') && pageTextLower.includes('address')) {
                console.log('✓ Customer Name & Address form detected - filling in standard answers');
                const textareas = await driver.findElements(By.tagName('textarea'));
                if (textareas.length >= 3) {
                    await textareas[0].sendKeys(CONFIG.defaults.questions.q1);
                    await textareas[1].sendKeys(CONFIG.defaults.questions.q2);
                    await textareas[2].sendKeys(CONFIG.defaults.questions.q3);
                    console.log('✓ Filled Customer Name & Address form');
                }
            }
            
            // Submit
            if (!result.requiresManualAction) {
                const submitButtons = await driver.findElements(By.xpath("//button[contains(text(), 'Accept') or contains(text(), 'Submit')] | //input[@type='submit']"));
                if (submitButtons.length > 0) {
                    await submitButtons[0].click();
                    console.log('✓ Clicked Submit');
                    await sleep(3000);
                    
                    // Capture Request ID
                    const confirmText = await driver.findElement(By.tagName('body')).getText();
                    const reqIdMatch = confirmText.match(/(?:Request|REQ)[\s_#:]*(\d+)/i);
                    if (reqIdMatch) {
                        result.requestId = reqIdMatch[1];
                        result.status = 'submitted';
                        console.log(`✓ Request submitted - ID: ${result.requestId}`);
                    } else {
                        result.status = 'submitted_no_id';
                        result.notes.push('Submitted but could not capture request ID');
                        console.log('⚠ Submitted but could not capture Request ID');
                    }
                } else {
                    result.status = 'error_no_submit_btn';
                    console.log('⚠ Submit button not found');
                }
            } else {
                result.status = 'pending_manual';
                console.log('⚠ Manual action required - skipping submit');
            }
            
        } else {
            result.status = 'role_not_found';
            result.notes.push('Role element not found on page');
            console.log(`⚠ Role "${roleName}" not found on page`);
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
    const roleNameInput = args.slice(1).join(' ');
    
    console.log('='.repeat(60));
    console.log('MyFSM Access Automation');
    console.log('='.repeat(60));
    
    if (!systemKey) {
        console.log('\nUsage: node myfsm_access.js <SYSTEM_KEY> [ROLE_NAME]');
        console.log('\nAvailable Systems:');
        Object.entries(CONFIG.systems).forEach(([key, sys]) => {
            console.log(`  ${key}: ${sys.name}`);
        });
        console.log('\nTo see roles for a system: node myfsm_access.js <SYSTEM_KEY>');
        return;
    }
    
    if (!CONFIG.systems[systemKey]) {
        console.log(`\nError: System "${systemKey}" not found in config.`);
        console.log(`Available: ${Object.keys(CONFIG.systems).join(', ')}`);
        return;
    }
    
    const systemConfig = CONFIG.systems[systemKey];
    
    // If no role specified, list roles
    if (!roleNameInput) {
        console.log(`\nAvailable Roles for ${systemConfig.name}:`);
        systemConfig.roles.forEach((role, i) => {
            console.log(`  ${i + 1}. ${role}`);
        });
        console.log(`\nUsage: node myfsm_access.js ${systemKey} "<ROLE_NAME>"`);
        return;
    }
    
    // Match role (case insensitive)
    const roleName = systemConfig.roles.find(r => r.toLowerCase() === roleNameInput.toLowerCase());
    if (!roleName) {
        console.log(`\nError: Role "${roleNameInput}" not found in ${systemKey} config.`);
        console.log('Please check spelling or list available roles.');
        return;
    }
    
    // Execute
    let driver;
    try {
        driver = await new Builder()
            .forBrowser('MicrosoftEdge')
            .setEdgeOptions(new edge.Options())
            .build();
            
        await driver.manage().window().maximize();
        
        const result = await submitRequest(driver, systemConfig.name, roleName);
        await appendLog(result);
        
    } catch (error) {
        console.error('Fatal Error:', error);
    } finally {
        if (driver) {
            console.log('\nClosing browser in 5 seconds...');
            await sleep(5000);
            await driver.quit();
        }
    }
}

main().catch(console.error);
