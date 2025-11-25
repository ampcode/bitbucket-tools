---
name: maestro-devtools
description: A specialized skill for verifying feature parity between Native Mobile Apps and Mobile Web/WebViews. It instructs the agent to accept a test case, execute it step-by-step on both platforms using the Maestro Bridge, and report any discrepancies in behavior or performance.
allowed-tools: Bash, Read
---

# Maestro DevTools: Parity & Comparison

This skill is designed to **compare Native vs. Web implementations**. When you receive an instruction to test a feature (e.g., "Check the login flow"), you must execute the sequence of actions on **both** the Native App and the Web version to verify they behave identically.

## Workflow: Parity Check

When given a task (e.g., "Verify the search bar works"), follow this strict loop:

1.  **Plan the Atomic Steps**: Break the user's request down into simple UI actions (e.g., "Tap Search", "Type 'shoes'", "Tap Enter").
2.  **Execute on Native**: Run the step using the bridge script with `--target native`.
3.  **Execute on Web**: Run the *same* step using the bridge script with `--target web`.
4.  **Compare & Verify**:
    *   Did both succeed?
    *   If one failed, stop and report the discrepancy.
    *   (Optional) Use `inspect` to verify the UI hierarchy matches if specific IDs are needed.

## The Tool: `maestro_bridge.py`

You have a python script that handles the execution. You do NOT need to write YAML files.

### Command Reference

#### Tap
```bash
# Native
./maestro_bridge.py tap "Text" --target native

# Web
./maestro_bridge.py tap "Text" --target web
```

#### Type
```bash
# Native
./maestro_bridge.py type "hello" --target native

# Web
./maestro_bridge.py type "hello" --target web
```

#### Inspect
```bash
./maestro_bridge.py inspect
```

### Configuration Defaults
- **App ID**: `com.example.app` (Override with `--app-id`)
- **Web URL**: `http://localhost:8081` (Override with `--url`)

## Example Scenario

**User Instruction:** "Test that the 'Profile' button navigates to the settings page."

**Agent Execution Plan:**

1.  **Step 1 (Native):**
    ```bash
    ./maestro_bridge.py tap "Profile" --target native
    ```
    *(Check output: "Success")*

2.  **Step 1 (Web):**
    ```bash
    ./maestro_bridge.py tap "Profile" --target web
    ```
    *(Check output: "Success")*

3.  **Step 2 (Native - Verification):**
    ```bash
    ./maestro_bridge.py tap "Settings" --target native
    ```
    *(Check output: "Success" -> implies we are on the right page)*

4.  **Step 2 (Web - Verification):**
    ```bash
    ./maestro_bridge.py tap "Settings" --target web
    ```
    *(Check output: "Element not found" -> **DISCREPANCY FOUND**)*

5.  **Report:** "Parity Check Failed: Tapping 'Profile' on Web did not lead to a page with a 'Settings' button, but it did on Native."
