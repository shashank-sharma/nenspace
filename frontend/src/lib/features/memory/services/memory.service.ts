import { pb } from '$lib/config/pocketbase';

export class MemoryService {
	static async send(
		endpoint: string,
		options: {
			method?: string;
			params?: Record<string, any>;
			body?: any;
		} = {}
	) {
		const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
		const method = options.method || 'GET';
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (pb.authStore.isValid) {
			headers['Authorization'] = pb.authStore.token;
		}

		const fetchOptions: RequestInit = {
			method,
			headers
		};

		if (method !== 'GET' && options.body) {
			fetchOptions.body = JSON.stringify(options.body);
		}

		let finalUrl = url;
		if (options.params) {
			const searchParams = new URLSearchParams();
			for (const key in options.params) {
				if (options.params[key] !== undefined && options.params[key] !== null) {
					searchParams.append(key, options.params[key].toString());
				}
			}
			const queryString = searchParams.toString();
			if (queryString) {
				finalUrl += `?${queryString}`;
			}
		}

		const fullUrl = `${pb.baseUrl}/api${finalUrl}`;
		const response = await fetch(fullUrl, fetchOptions);

		if (!response.ok) {
			throw new Error(`API request failed: ${response.status} ${response.statusText}`);
		}

		const contentType = response.headers.get('content-type');
		if (contentType && contentType.includes('application/json')) {
			return await response.json();
		}

		return await response.text();
	}

	// Methods for each endpoint
	static getMemoryTimeline(limit = 50) {
		return this.send('/memory/timeline', { params: { limit } });
	}

	static searchMemories(query: string, limit = 20) {
		return this.send('/memory/search', { method: 'POST', body: { query, limit } });
	}

	static getInsights(limit = 10) {
		return this.send('/memory/insights', { params: { limit } });
	}

	static getEntities(limit = 20) {
		return this.send('/memory/entities', { params: { limit } });
	}

	static getMemoryTags() {
		return this.send('/memory/tags');
	}

	static getMemoryStatus() {
		return this.send('/memory/status');
	}

	static getMemoryDetails(id: string) {
		return this.send('/memory/details', { params: { id } });
	}

	static getEntityDetails(id: string) {
		return this.send('/memory/entity', { params: { id } });
	}

	static getInsightDetails(id: string) {
		return this.send('/memory/insight', { params: { id } });
	}

	static rateInsight(id: string, rating: number) {
		return this.send('/memory/insight/rate', { method: 'POST', params: { id }, body: { rating } });
	}

	static triggerConsolidation() {
		return this.send('/memory/consolidate', {
			method: 'POST',
			body: { process_type: 'consolidation' }
		});
	}

	static filterByTag(tag: string, limit = 20) {
		return this.send('/memory/tag', { params: { tag, limit } });
	}
}
