# MyFSM Access Request Automation

Automated tool for requesting xDW access permissions via MyFSM using Selenium WebDriver.

## Overview

This tool automates the process of requesting database access roles through the MyFSM portal. Instead of manually navigating through the web interface for each role, you can use a command-line script to submit access requests.

## Prerequisites

- Node.js v20.12.2 (already installed)
- selenium-webdriver package (already installed)
- Microsoft Edge browser
- Active MyFSM login credentials

## Available Systems and Roles

The tool supports three main database systems:

### 1. EDW-TDP7 (PROD) - 15 roles
Enterprise Data Warehouse production roles including customer data, wealth data, and GL Books access.

### 2. SGDWTDP7 (PROD) - 3 roles  
Singapore Data Warehouse production base access roles.

### 3. WGDW - 20 roles
Westpac Group Data Warehouse roles for BRDM, CRDM, and network data access.

## How to Use

### View Available Systems and Roles

Run without arguments to see all available options:

```bash
node myfsm_unified.js
```

This displays all systems and their roles with numbered lists.

### Request a Single Role

```bash
node myfsm_unified.js <SYSTEM> <ROLE_NAME>
```

**Examples:**

```bash
# EDW-TDP7 role (use quotes for roles with spaces)
node myfsm_unified.js EDW-TDP7 "Customer_General Personal data"

# WGDW role (no quotes needed for single-word roles)
node myfsm_unified.js WGDW WD_BRDM_GENERAL

# SGDWTDP7 role
node myfsm_unified.js SGDWTDP7 DW_SEL_PROD_Base
```

**System names are case-insensitive:**
- `EDW-TDP7`, `edw-tdp7`, `Edw-Tdp7` all work

### What Happens When You Run It

1. **Browser Opens**: Microsoft Edge launches automatically
2. **Navigation**: Script navigates to MyFSM and clicks "Add a New Request"
3. **System Selection**: Selects the specified system from dropdown
4. **Role Selection**: Attempts to find and select the role
5. **Form Filling**: Fills in standard justification comments
6. **Special Forms**: Detects and handles special forms:
   - **Prescribed Employee Form**: Flags for manual signature
   - **Customer Name & Address Form**: Auto-fills with standard responses
7. **Submission**: Submits the request (unless manual action required)
8. **Result**: Displays outcome and saves to JSON file

### Understanding the Output

After running, you'll see:

```
============================================================
RESULT
============================================================
Status: submitted
Request ID: 439138
Requires Manual Action: false

Result saved to: myfsm_result_2025-11-26T15-30-45.json
```

**Status values:**
- `submitted` - Successfully submitted, has request ID
- `submitted_no_id` - Submitted but couldn't capture ID
- `pending_manual` - Needs manual completion (e.g., signature)
- `role_not_found` - Role couldn't be located on page
- `error` - An error occurred

### Result Files

Each run saves a JSON file with details:

```json
{
  "system": "EDW-TDP7 (PROD)",
  "role": "Customer_General Personal data",
  "status": "submitted",
  "requestId": "439138",
  "notes": [],
  "requiresManualAction": false
}
```

## Standard Responses Used

The tool automatically fills forms with these approved responses:

**General Justification:**
> New starter position on Corporate Services, CR&A, Regulatory Reporting Uplift team. This access is required for regulatory EFS APRA reporting.

**Customer Name & Address Form:**
- Q1 (Why needed): "I am Senior Data Analyst and new member of the Corporate Services, CR&A, Regulatory Reporting Uplift team. I require this access for the management of regulatory EFS APRA reporting"
- Q2 (Where stored): "N/A - Data will not be stored."
- Q3 (Who has access): "N/A - no entity/party will access this data as it is not extracted by me."

## Debugging

If the script isn't working, use the debug tool:

### Inspect Mode
Saves HTML and inspects page elements:
```bash
node myfsm_debug.js inspect
```

### Screenshot Mode
Takes screenshots at each step:
```bash
node myfsm_debug.js screenshot
```

## Troubleshooting

### "Role not found" Error
The role element couldn't be located on the page after system selection. This may happen if:
- The role name doesn't exactly match what's in MyFSM
- The role loads via AJAX and needs more wait time
- The role requires additional navigation steps

**Solution**: Run the debug tool in inspect mode to verify the role name and page structure, or check manually in MyFSM.

### "Requires Manual Action" Flag
Some roles require physical signatures or additional forms that can't be automated.

**Solution**: 
1. Check the notes in the output
2. Complete the request manually through MyFSM
3. Use the request ID from partial submission if available

### Browser Doesn't Open
Check that Edge is installed and selenium-webdriver is set up correctly.

**Solution**: 
```bash
npm install selenium-webdriver
```

### Timeout Errors
Page elements took too long to load.

**Solution**: Check network connection and MyFSM availability.

## Tips

1. **Run one at a time**: Don't try to request multiple roles simultaneously
2. **Check results**: Always verify the request ID in MyFSM portal after submission
3. **Monitor approvals**: Script only submits requests - you still need to follow up with approvers
4. **Keep records**: JSON result files are saved for audit trail

## Important Notes

- **Responsibility**: It's your responsibility to follow up approvers to progress requests
- **Prescribed Employee**: By applying for GL data (Books 1 & 2), you accept to be part of the Prescribed Employee register
- **Manual verification**: Always check MyFSM to confirm requests were created successfully
- **Single session**: Each script run handles one role - this ensures accuracy and easier troubleshooting

## Files

- `myfsm_unified.js` - Main automation script
- `myfsm_debug.js` - Debugging and inspection tool
- `myfsm_result_*.json` - Result files (timestamped)
- `SKILL.md` - This documentation
- `AGENTS.md` - Agent/developer setup instructions
