import { type BitbucketConfig, fetchFromBitbucketAPI } from '../api-client'

export type BitbucketReadArgs = {
	project: string
	repository: string
	path: string
	read_range?: [number, number]
}

export const toolDefinition = {
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
} as const

export type BitbucketReadResult = {
	absolutePath: string
	content: string
}

export async function readFile(
	args: BitbucketReadArgs,
	config: BitbucketConfig,
	onProgress?: (message: string) => void,
): Promise<BitbucketReadResult> {
	const { project, repository, path, read_range } = args

	onProgress?.(`Reading file "${path}" from ${project}/${repository}...`)

	// Convert path to relative path within the repository
	let relativePath = path

	// Remove file:// prefix if present
	if (relativePath.startsWith('file://')) {
		relativePath = relativePath.slice(7)
	}

	// Remove project/repo prefix if present
	const prefix = `/${project}/${repository}/`
	if (relativePath.startsWith(prefix)) {
		relativePath = relativePath.slice(prefix.length)
	}

	// Remove leading slash
	if (relativePath.startsWith('/')) {
		relativePath = relativePath.slice(1)
	}

	// Use Bitbucket Server API to read file contents
	const bitbucketPath = `rest/api/1.0/projects/${project}/repos/${repository}/raw/${relativePath}?at=HEAD`

	const response = await fetchFromBitbucketAPI<string>(bitbucketPath, {}, config)

	if (!response.ok) {
		throw new Error(
			`Failed to read file: ${response.status} ${response.statusText || 'Unknown error'}`,
		)
	}

	// Bitbucket returns raw file content as text
	const content = response.text || ''

	// Split content into lines and add line numbers
	const lines = content.split('\n')

	// Apply read_range if specified
	let startLine = 1
	let endLine = lines.length

	if (read_range) {
		startLine = Math.max(1, read_range[0])
		endLine = Math.min(lines.length, read_range[1])
	}

	// Create line-numbered content
	const numberedLines = lines
		.slice(startLine - 1, endLine)
		.map((line, idx) => `${startLine + idx}: ${line}`)
		.join('\n')

	// Create file path
	const fileUri = `/${project}/${repository}/${relativePath}`

	return {
		absolutePath: fileUri,
		content: numberedLines,
	}
}
