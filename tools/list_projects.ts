import { type BitbucketConfig, fetchFromBitbucketAPI } from '../api-client'

export type ListProjectsArgs = {
	pattern?: string
	limit?: number
	offset?: number
}

export type ProjectResult = {
	key: string
	name: string
	description: string | null
	isPublic: boolean
	type: string
}

export type ListProjectsResult = {
	projects: ProjectResult[]
	totalCount: number
}

interface BitbucketProject {
	key: string
	id: number
	name: string
	description?: string
	public: boolean
	type: string
	links: {
		self: Array<{ href: string }>
	}
}

interface BitbucketPaginatedResponse<T> {
	values: T[]
	size: number
	isLastPage: boolean
	start?: number
	limit?: number
	nextPageStart?: number
}

export async function listProjects(
	args: ListProjectsArgs,
	config: BitbucketConfig,
	onProgress?: (message: string) => void,
): Promise<ListProjectsResult> {
	const { pattern, limit = 30, offset = 0 } = args

	// Validate that offset is divisible by limit for clean pagination
	if (offset % limit !== 0) {
		throw new Error(
			`offset (${offset}) must be divisible by limit (${limit}) for pagination. Try offset values like 0, ${limit}, ${limit * 2}, etc.`,
		)
	}

	onProgress?.(`Fetching projects${pattern ? ` matching "${pattern}"` : ''}...`)

	// Build the API path - Bitbucket Server API
	const apiPath = `rest/api/1.0/projects?limit=${limit}&start=${offset}`

	const response = await fetchFromBitbucketAPI<BitbucketPaginatedResponse<BitbucketProject>>(
		apiPath,
		{},
		config,
	)

	if (!response.ok || !response.data) {
		throw new Error(
			`Failed to fetch projects: ${response.status} ${response.statusText || 'Unknown error'}`,
		)
	}

	let projects = response.data.values

	// Apply pattern filter client-side to search both name and description
	if (pattern) {
		try {
			const regex = new RegExp(pattern, 'i')
			projects = projects.filter(
				(project) =>
					regex.test(project.name) ||
					regex.test(project.key) ||
					(project.description && regex.test(project.description)),
			)
		} catch {
			// If regex is invalid, fall back to case-insensitive substring match
			const lowerPattern = pattern.toLowerCase()
			projects = projects.filter(
				(project) =>
					project.name.toLowerCase().includes(lowerPattern) ||
					project.key.toLowerCase().includes(lowerPattern) ||
					(project.description && project.description.toLowerCase().includes(lowerPattern)),
			)
		}
	}

	// Transform to our result format
	const results: ProjectResult[] = projects.map((project) => ({
		key: project.key,
		name: project.name,
		description: project.description || null,
		isPublic: project.public,
		type: project.type,
	}))

	return {
		projects: results,
		totalCount: response.data.size || results.length,
	}
}
