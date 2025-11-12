export interface BitbucketConfig {
	baseURL: string
	token: string
}

export interface FetchOptions {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
	headers?: Record<string, string>
	body?: any
	signal?: AbortSignal
}

export interface BitbucketResponse<T = any> {
	ok: boolean
	status: number
	statusText: string
	text?: string
	data?: T
}

export async function fetchFromBitbucketAPI<T = any>(
	path: string,
	options: FetchOptions = {},
	config: BitbucketConfig,
): Promise<BitbucketResponse<T>> {
	const { method = 'GET', headers = {}, body, signal } = options
	
	const url = `${config.baseURL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
	
	const requestHeaders: Record<string, string> = {
		'Authorization': `Bearer ${config.token}`,
		...headers,
	}
	
	const requestInit: RequestInit = {
		method,
		headers: requestHeaders,
		signal,
	}
	
	if (body) {
		requestInit.body = JSON.stringify(body)
		if (!requestHeaders['Content-Type']) {
			requestHeaders['Content-Type'] = 'application/json'
		}
	}
	
	try {
		const response = await fetch(url, requestInit)
		const contentType = response.headers.get('content-type')
		const isJson = contentType?.includes('application/json')
		
		let text: string | undefined
		let data: T | undefined
		
		if (response.ok) {
			const rawText = await response.text()
			text = rawText
			
			if (isJson && rawText) {
				try {
					data = JSON.parse(rawText) as T
				} catch {
					// If JSON parsing fails, leave data undefined
				}
			}
		} else {
			text = await response.text()
		}
		
		return {
			ok: response.ok,
			status: response.status,
			statusText: response.statusText,
			text,
			data,
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw error
		}
		
		return {
			ok: false,
			status: 0,
			statusText: error instanceof Error ? error.message : 'Network error',
			text: error instanceof Error ? error.message : String(error),
		}
	}
}
