#!/usr/bin/env bun
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import type { BitbucketConfig } from './api-client'
import {
	searchCode,
	type CodeSearchArgs,
	toolDefinition as codeSearchTool,
} from './tools/code_search'
import {
	globFiles,
	type BitbucketGlobArgs,
	toolDefinition as globFilesTool,
} from './tools/glob'
import {
	listProjects,
	type ListProjectsArgs,
	toolDefinition as listProjectsTool,
} from './tools/list_projects'
import {
	readFile,
	type BitbucketReadArgs,
	toolDefinition as readFileTool,
} from './tools/read'
import {
	searchRepositories,
	type SearchRepositoriesArgs,
	toolDefinition as searchRepositoriesTool,
} from './tools/search_repositories'

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
			readFileTool,
			codeSearchTool,
			listProjectsTool,
			globFilesTool,
			searchRepositoriesTool,
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
