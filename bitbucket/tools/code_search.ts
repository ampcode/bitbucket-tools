import { type BitbucketConfig, fetchFromBitbucketAPI } from '../api-client'

export type CodeSearchArgs = {
	query: string
	project?: string
	repository?: string
	fileGlob?: string
	limit?: number
}

export const toolDefinition = {
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
} as const

export type CodeHit = {
	repository: {
		slug: string
		id: number
		name: string
		description?: string
		project: {
			key: string
			id: number
			name: string
		}
	}
	file: string
	hitContexts: Array<
		Array<{
			line: number
			text: string
		}>
	>
	pathMatches: unknown[]
	hitCount: number
}

export type CodeSearchResult = {
	files: CodeHit[]
	totalCount: number
}

type CodeSearchResponse = {
	scope: {
		type: string
	}
	code: {
		category: string
		count: number
		nextStart: number
		start: number
		values: CodeHit[]
		isLastPage: boolean
	}
	query: {
		substituted: boolean
	}
}

export async function searchCode(
	args: CodeSearchArgs,
	config: BitbucketConfig,
	onProgress?: (message: string) => void,
): Promise<CodeSearchResult> {
	const { query, project, repository, fileGlob, limit = 25 } = args

	onProgress?.(`Searching for "${query}" in code...`)

	// Build entities object
	const entities: Record<string, unknown> = {
		code: {},
	}

	// Build request body
	const requestBody = {
		query,
		entities,
		limits: {
			primary: limit,
		},
	}

	// Make POST request to REST search endpoint
	const response = await fetchFromBitbucketAPI<CodeSearchResponse>(
		'rest/search/latest/search?avatarSize=64',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: requestBody,
		},
		config,
	)

	if (!response.ok) {
		throw new Error(
			`Bitbucket code search failed: ${response.status} ${response.statusText}${response.text ? ` - ${response.text.substring(0, 100)}` : ''}`,
		)
	}

	if (!response.data) {
		throw new Error('No data returned from Bitbucket code search')
	}

	if (!response.data.code) {
		return {
			files: [],
			totalCount: 0,
		}
	}

	const { values: files } = response.data.code

	// Apply client-side filters
	let filteredFiles = files

	if (project) {
		filteredFiles = filteredFiles.filter((file) => file.repository.project.key === project)
	}

	if (repository) {
		filteredFiles = filteredFiles.filter((file) => file.repository.slug === repository)
	}

	if (fileGlob) {
		// Convert glob pattern to regex
		const globRegex = new RegExp(
			'^' +
				fileGlob
					.replace(/\./g, '\\.')
					.replace(/\*\*/g, '.*')
					.replace(/\*/g, '[^/]*') +
				'$',
		)
		filteredFiles = filteredFiles.filter((file) => globRegex.test(file.file))
	}

	return {
		files: filteredFiles,
		totalCount: filteredFiles.length,
	}
}
