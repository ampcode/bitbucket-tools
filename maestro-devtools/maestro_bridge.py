#!/usr/bin/env python3
import argparse
import subprocess
import sys
import os
import tempfile
import json

# Default Configuration
DEFAULT_APP_ID = "com.example.app" # CHANGE THIS to your actual App ID
DEFAULT_WEB_URL = "http://localhost:8081"

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "templates", "action.yaml")

def read_template():
    if not os.path.exists(TEMPLATE_PATH):
        print(f"Error: Template not found at {TEMPLATE_PATH}")
        sys.exit(1)
    with open(TEMPLATE_PATH, "r") as f:
        return f.read()

def generate_yaml(template_content, command, value, target, app_id, url):
    setup_steps = ""
    
    # Web Target specific setup
    if target == "web":
        setup_steps = f'- openLink: "{url}"'
    
    # Replace placeholders
    # Using simple string replace to avoid external dependencies like jinja2
    yaml_content = template_content.replace("{{APP_ID}}", app_id)
    yaml_content = yaml_content.replace("{{SETUP_STEPS}}", setup_steps)
    
    # Handle special case for type/input text which might need distinct command
    cmd_key = command
    if command == "type":
        cmd_key = "inputText"
    elif command == "tap":
        cmd_key = "tapOn"
        
    # Construct the command line
    # If value is None (e.g. pure commands), handling might vary, but here we assume value matches
    yaml_content = yaml_content.replace("{{COMMAND}}", cmd_key)
    
    # Handle value formatting (quotes or not)
    # YAML usually prefers quotes for strings
    yaml_content = yaml_content.replace("{{VALUE}}", f'"{value}"')
    
    return yaml_content

def run_maestro(yaml_content):
    # Create a temporary file
    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as tmp:
        tmp.write(yaml_content)
        tmp_path = tmp.name
    
    try:
        print(f"Executing Maestro Flow ({tmp_path})...")
        # Run Maestro
        # We use --format json to get machine-readable output if possible, 
        # though maestro test output is often just logs. 
        result = subprocess.run(
            ["maestro", "test", tmp_path, "--format", "json"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print("✅ Success")
            print(result.stdout)
        else:
            print("❌ Failure")
            print(result.stderr)
            
    except FileNotFoundError:
        print("Error: 'maestro' executable not found. Is it installed and in your PATH?")
    finally:
        # Cleanup
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

def main():
    parser = argparse.ArgumentParser(description="Maestro Bridge: DevTools for Agents")
    
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # TAP
    tap_parser = subparsers.add_parser("tap", help="Tap on an element (text or ID)")
    tap_parser.add_argument("value", help="Text or ID to tap")
    
    # TYPE
    type_parser = subparsers.add_parser("type", help="Input text")
    type_parser.add_argument("value", help="Text to type")
    
    # INSPECT (Future implementation)
    inspect_parser = subparsers.add_parser("inspect", help="Dump UI Hierarchy")
    
    # Global Arguments
    parser.add_argument("--target", choices=["native", "web"], default="native", help="Target environment")
    parser.add_argument("--app-id", default=DEFAULT_APP_ID, help="Android package or iOS bundle ID")
    parser.add_argument("--url", default=DEFAULT_WEB_URL, help="URL for web target")

    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command == "inspect":
        # Inspect is a direct maestro command, not a flow
        print("Running hierarchy dump...")
        subprocess.run(["maestro", "hierarchy"])
        return

    # Load Template
    template = read_template()
    
    # Generate YAML
    yaml_flow = generate_yaml(
        template, 
        args.command, 
        args.value, 
        args.target, 
        args.app_id, 
        args.url
    )
    
    # Run
    run_maestro(yaml_flow)

if __name__ == "__main__":
    main()
