#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import type { BitbucketConfig } from './api-client'
import { searchCode, type CodeSearchArgs } from './tools/code_search'
import { globFiles, type BitbucketGlobArgs } from './tools/glob'
import { listProjects, type ListProjectsArgs } from './tools/list_projects'
import { readFile, type BitbucketReadArgs } from './tools/read'
import { searchRepositories, type SearchRepositoriesArgs } from './tools/search_repositories'

const BITBUCKET_INSTANCE_URL = process.env.BITBUCKET_INSTANCE_URL
const BITBUCKET_ACCESS_TOKEN = process.env.BITBUCKET_ACCESS_TOKEN

if (!BITBUCKET_INSTANCE_URL || !BITBUCKET_ACCESS_TOKEN) {
	console.error('Error: BITBUCKET_INSTANCE_URL and BITBUCKET_ACCESS_TOKEN must be set')
	process.exit(1)
}

const config: BitbucketConfig = {
	baseURL: BITBUCKET_INSTANCE_URL,
	token: BITBUCKET_ACCESS_TOKEN,
}

const server = new Server(
	{
		name: 'bitbucket-server',
		version: '1.0.0',
	},
	{
		capabilities: {
			tools: {},
		},
	},
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [
			{
				name: 'read_file',
				description: `Read file contents from a Bitbucket repository.

PARAMETERS:
- project: The Bitbucket project key (required)
- repository: The repository slug (required)
- path: The file path within the repository (required)
- read_range: Optional [startLine, endLine] to read only a portion of the file

Returns file contents with line numbers.`,
				inputSchema: {
					type: 'object',
					properties: {
						project: {
							type: 'string',
							description: 'The Bitbucket project key',
						},
						repository: {
							type: 'string',
							description: 'The repository slug',
						},
						path: {
							type: 'string',
							description: 'The file path within the repository',
						},
						read_range: {
							type: 'array',
							description: 'Optional [startLine, endLine] to read only a portion',
							items: { type: 'number' },
							minItems: 2,
							maxItems: 2,
						},
					},
					required: ['project', 'repository', 'path'],
				},
			},
			{
				name: 'search_code',
				description: `Search for code across Bitbucket repositories.

PARAMETERS:
- query: Search query - keywords to find in code (required)
- project: Filter to specific project key (optional)
- repository: Filter to specific repository slug (optional)
- fileGlob: Filter to files matching glob pattern (optional)
- limit: Maximum results (default: 25)

Returns matching files with code snippets and line numbers.`,
				inputSchema: {
					type: 'object',
					properties: {
						query: {
							type: 'string',
							description: 'Search query - keywords to find in code',
						},
						project: {
							type: 'string',
							description: 'Filter to specific project key',
						},
						repository: {
							type: 'string',
							description: 'Filter to specific repository slug',
						},
						fileGlob: {
							type: 'string',
							description: 'Filter to files matching glob pattern (e.g., "**/*.ts")',
						},
						limit: {
							type: 'number',
							description: 'Maximum number of results (default: 25)',
						},
					},
					required: ['query'],
				},
			},
			{
				name: 'list_projects',
				description: `List projects from Bitbucket.

PARAMETERS:
- pattern: Optional regex pattern to match project names/keys/descriptions (optional)
- limit: Maximum number of results (default: 30)
- offset: Number of results to skip (default: 0)

Returns list of projects with metadata.`,
				inputSchema: {
					type: 'object',
					properties: {
						pattern: {
							type: 'string',
							description: 'Optional regex pattern to filter projects',
						},
						limit: {
							type: 'number',
							description: 'Maximum number of results (default: 30)',
						},
						offset: {
							type: 'number',
							description: 'Number of results to skip (default: 0)',
						},
					},
					required: [],
				},
			},
			{
				name: 'glob_files',
				description: `Find files matching a glob pattern in a Bitbucket repository.

PARAMETERS:
- project: The Bitbucket project key (required)
- repository: The repository slug (required)
- filePattern: Glob pattern to match files (required, e.g., "**/*.ts")
- limit: Maximum results (default: 100)
- offset: Number of results to skip (default: 0)

Returns list of file paths matching the pattern.`,
				inputSchema: {
					type: 'object',
					properties: {
						project: {
							type: 'string',
							description: 'The Bitbucket project key',
						},
						repository: {
							type: 'string',
							description: 'The repository slug',
						},
						filePattern: {
							type: 'string',
							description: 'Glob pattern to match files (e.g., "**/*.ts")',
						},
						limit: {
							type: 'number',
							description: 'Maximum number of results (default: 100)',
						},
						offset: {
							type: 'number',
							description: 'Number of results to skip (default: 0)',
						},
					},
					required: ['project', 'repository', 'filePattern'],
				},
			},
			{
				name: 'search_repositories',
				description: `Search for repositories across Bitbucket.

PARAMETERS:
- query: Search query - keywords to match repository name/slug/description (required)
- limit: Maximum results (default: 30)

Returns list of repositories with metadata.`,
				inputSchema: {
					type: 'object',
					properties: {
						query: {
							type: 'string',
							description: 'Search query - keywords to find repositories',
						},
						limit: {
							type: 'number',
							description: 'Maximum number of results (default: 30)',
						},
					},
					required: ['query'],
				},
			},
		],
	}
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	try {
		switch (request.params.name) {
			case 'read_file': {
				const args = request.params.arguments as BitbucketReadArgs
				const result = await readFile(args, config)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, null, 2),
						},
					],
				}
			}

			case 'search_code': {
				const args = request.params.arguments as CodeSearchArgs
				const result = await searchCode(args, config)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, null, 2),
						},
					],
				}
			}

			case 'list_projects': {
				const args = request.params.arguments as ListProjectsArgs
				const result = await listProjects(args, config)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, null, 2),
						},
					],
				}
			}

			case 'glob_files': {
				const args = request.params.arguments as BitbucketGlobArgs
				const result = await globFiles(args, config)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, null, 2),
						},
					],
				}
			}

			case 'search_repositories': {
				const args = request.params.arguments as SearchRepositoriesArgs
				const result = await searchRepositories(args, config)
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(result, null, 2),
						},
					],
				}
			}

			default:
				throw new Error(`Unknown tool: ${request.params.name}`)
		}
	} catch (error) {
		return {
			content: [
				{
					type: 'text',
					text: `Error: ${error instanceof Error ? error.message : String(error)}`,
				},
			],
			isError: true,
		}
	}
})

async function main() {
	const transport = new StdioServerTransport()
	await server.connect(transport)
	console.error('Bitbucket MCP Server running on stdio')
}

main().catch((error) => {
	console.error('Fatal error:', error)
	process.exit(1)
})
