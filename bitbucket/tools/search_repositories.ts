import { type BitbucketConfig, fetchFromBitbucketAPI } from '../api-client'

export type SearchRepositoriesArgs = {
	query: string
	limit?: number
}

export const toolDefinition = {
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
} as const

export type Repository = {
	id: number
	name: string
	slug: string
	description?: string
	public: boolean
	archived: boolean
	project: {
		key: string
		id: number
		name: string
		description?: string
		public: boolean
		type: string
	}
	scmId: string
	state: string
	statusMessage: string
	forkable: boolean
}

export type SearchRepositoriesResult = {
	repositories: Repository[]
	totalCount: number
}

type SearchRepositoriesResponse = {
	scope: {
		type: string
	}
	repositories: {
		category: string
		count: number
		nextStart: number
		start: number
		values: Repository[]
		isLastPage: boolean
	}
	query: {
		substituted: boolean
	}
}

export async function searchRepositories(
	args: SearchRepositoriesArgs,
	config: BitbucketConfig,
	onProgress?: (message: string) => void,
): Promise<SearchRepositoriesResult> {
	const { query, limit = 30 } = args

	onProgress?.(`Searching for repositories matching "${query}"...`)

	// Build request body
	const requestBody = {
		query,
		entities: {
			repositories: {},
		},
		limits: {
			primary: limit,
		},
	}

	// Make POST request to REST search endpoint
	const response = await fetchFromBitbucketAPI<SearchRepositoriesResponse>(
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
			`Bitbucket repository search failed: ${response.status} ${response.statusText}${response.text ? ` - ${response.text.substring(0, 100)}` : ''}`,
		)
	}

	if (!response.data) {
		throw new Error('No data returned from Bitbucket repository search')
	}

	if (!response.data.repositories) {
		return {
			repositories: [],
			totalCount: 0,
		}
	}

	const { values: repositories, count: totalCount } = response.data.repositories

	return {
		repositories,
		totalCount,
	}
}
