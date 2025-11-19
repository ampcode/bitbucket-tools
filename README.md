# Amp FDE Toolbox

This repository contains tools built to help our enterprise customers get the most out of Amp.

## Toolboxes

Amp toolboxes allow you to extend Amp with custom tools by pointing the `AMP_TOOLBOX` environment variable to a directory containing them. There are two types:

### 1. Subagent Toolboxes
Specialized subagent tools with custom system prompts, models, and filtered tool access.

**Example:** Create `.agents/tools/refactor.md`:
```markdown
---
type: subagent
model: sonnet
tools: [Read, edit_file, Grep, tb__typescript_*]
---
# Refactoring Assistant
You are a focused refactoring assistant. Make minimal, safe changes.
```
This creates a `tb__refactor` tool.

### 2. Executable Toolboxes
Simple executable files (Bash, Python, etc.) that respond to `describe` and `execute` actions via the `TOOLBOX_ACTION` environment variable.

**Protocol:**
- **Discovery:** Amp scans the toolbox directory for executables.
- **Describe:** Called with `TOOLBOX_ACTION=describe`. Must output a JSON Schema or simple text format defining the tool.
- **Execute:** Called with `TOOLBOX_ACTION=execute`. Receives arguments on stdin (JSON or text) and performs the action.
- **Naming:** Tools are registered with a `tb__` prefix (e.g., `tb__mytool`).

## Bitbucket Search Toolkit

A set of tools for agentic search over Bitbucket Server/Data Center instances.

- **Read Files**: Read file contents from Bitbucket repositories
- **Search Code**: Search for code patterns across repositories
- **List Projects**: Browse available Bitbucket projects
- **Glob Files**: Find files matching glob patterns
- **Search Repositories**: Search for repositories by name/description

See [bitbucket/README.md](bitbucket/README.md) for detailed configuration and usage instructions.

## Browser Toolkit

A web browser automation skill that allows Amp to interact with web pages by clicking buttons, filling out forms, and navigating links. It works by remote controlling Google Chrome or Chromium browsers using the Chrome DevTools Protocol (CDP).

See [browser/README.md](browser/README.md) for details.

## React Analysis Toolkit

A collection of tools for analyzing React/TypeScript codebases:

- **analyze_dependency_graph**: Analyze module dependencies
- **check_ts_syntax**: Validate TypeScript syntax
- **detect_browser_apis**: Find browser API usage
- **detect_imports**: Analyze import patterns
- **detect_jsx_patterns**: Identify JSX usage patterns
- **detect_style_usage**: Find styling approaches (CSS modules, styled-components, etc.)

See the [react/](react/) directory for individual tool usage.
