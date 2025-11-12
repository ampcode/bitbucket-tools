# Bitbucket Search Toolkit

A set of tools for agentic search over Bitbucket Server/Data Center instances.

## Features

- **Read Files**: Read file contents from Bitbucket repositories with line numbers
- **Search Code**: Search for code patterns across repositories
- **List Projects**: Browse available Bitbucket projects
- **Glob Files**: Find files matching glob patterns
- **Search Repositories**: Search for repositories by name/description


### MCP Client Template

```json
{
  "bitbucket": {
    "command": "bun",
    "args": ["run", "/Users/jesseedelstein/Documents/bitbucket-fs/mcp.ts"],
    "env": {
      "BITBUCKET_INSTANCE_URL": "https://your-bitbucket-server.com",
      "BITBUCKET_ACCESS_TOKEN": "your-access-token"
    }
  }
}
```

## Available Tools

Once connected, your MCP client will have access to these tools:

### `read_file`
Read file contents from a repository with line numbers.
- `project` (required): Project key (e.g., "MYPROJ")
- `repository` (required): Repository slug (e.g., "my-repo")
- `path` (required): File path (e.g., "src/index.ts")
- `read_range` (optional): `[startLine, endLine]` to read specific lines

### `search_code`
Search for code patterns across repositories.
- `query` (required): Search keywords
- `project` (optional): Filter to specific project
- `repository` (optional): Filter to specific repository
- `fileGlob` (optional): Filter by file pattern (e.g., "**/*.ts")
- `limit` (optional): Max results (default: 25)

### `list_projects`
List available Bitbucket projects.
- `pattern` (optional): Regex filter for names/keys/descriptions
- `limit` (optional): Max results (default: 30)
- `offset` (optional): Skip results for pagination (default: 0)

### `glob_files`
Find files matching a glob pattern in a repository.
- `project` (required): Project key
- `repository` (required): Repository slug
- `filePattern` (required): Glob pattern (e.g., `**/*.ts`, `src/**/*.test.js`)
- `limit` (optional): Max results (default: 100)
- `offset` (optional): Skip results (default: 0)

### `search_repositories`
Search for repositories by name/description.
- `query` (required): Search keywords
- `limit` (optional): Max results (default: 30)

