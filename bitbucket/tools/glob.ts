import picomatch from 'picomatch/posix'

import { type BitbucketConfig, fetchFromBitbucketAPI } from '../api-client'

export type BitbucketGlobArgs = {
	project: string
	repository: string
	filePattern: string
	limit?: number
	offset?: number
}

export const toolDefinition = {
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
} as const

interface BitbucketFileItem {
	path: {
		components: string[]
		toString: string
	}
	type: 'FILE' | 'DIRECTORY'
}

interface BitbucketBrowseResponse {
	children: {
		values: BitbucketFileItem[]
		size: number
		isLastPage: boolean
		start: number
		limit: number
		nextPageStart?: number
	}
}

export async function globFiles(
	args: BitbucketGlobArgs,
	config: BitbucketConfig,
	onProgress?: (message: string) => void,
): Promise<string[]> {
	const { project, repository, filePattern, limit = 100, offset = 0 } = args

	onProgress?.(`Finding files matching "${filePattern}" in ${project}/${repository}...`)

	const allFiles: string[] = []

	// Recursively fetch files from directories
	const fetchDirectory = async (path: string = ''): Promise<void> => {
		let start = 0
		const pageLimit = 1000
		let isLastPage = false

		while (!isLastPage) {
			// Bitbucket Server API path for browsing repository files
			const apiPath = `rest/api/1.0/projects/${project}/repos/${repository}/browse${path ? `/${path}` : ''}?limit=${pageLimit}&start=${start}`

			const response = await fetchFromBitbucketAPI<BitbucketBrowseResponse>(apiPath, {}, config)

			if (!response.ok || !response.data) {
				// Some directories may not be accessible or may not exist
				return
			}

			const items = response.data.children.values

			// Process each item
			for (const item of items) {
				// Build path from components
				const itemPath = item.path.components.join('/')

				if (item.type === 'FILE') {
					allFiles.push(itemPath)
				} else if (item.type === 'DIRECTORY') {
					// Recursively fetch subdirectory
					await fetchDirectory(itemPath)
				}
			}

			isLastPage = response.data.children.isLastPage
			if (!isLastPage && response.data.children.nextPageStart) {
				start = response.data.children.nextPageStart
			}
		}
	}

	await fetchDirectory()

	// Apply glob pattern matching
	const isMatch = picomatch(filePattern)
	const matchedFiles = allFiles.filter((p) => isMatch(p))

	// Apply pagination
	const paginatedFiles = limit
		? matchedFiles.slice(offset, offset + limit)
		: matchedFiles.slice(offset)

	// Convert to file paths
	const files = paginatedFiles.map((path) => `/${project}/${repository}/${path}`)

	return files
}
