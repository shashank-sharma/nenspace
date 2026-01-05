

import { credentialUsageService, type UsageEvent } from '$lib/features/credentials/services/credential-usage.service';
import { pb } from '$lib/config/pocketbase';

const originalFetch = window.fetch;

window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const startTime = performance.now();
	const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
	const method = init?.method || 'GET';

	const isPocketBaseCall = url.includes(pb.baseUrl) || url.startsWith('/api/');
	const authHeader = init?.headers ?
		(typeof init.headers === 'string' ? init.headers :
		 (init.headers instanceof Headers ? init.headers.get('Authorization') :
		  (init.headers as Record<string, string>)['Authorization'] || (init.headers as Record<string, string>)['authorization'])) :
		null;

	let credentialType: 'token' | 'dev_token' | 'api_key' | 'security_key' | null = null;
	let credentialId: string | null = null;
	let service: string = 'unknown';

	if (authHeader) {
		if (authHeader.includes('AuthSyncToken')) {
			credentialType = 'dev_token';

			const tokenValue = authHeader.replace('AuthSyncToken ', '').trim();
			const parts = tokenValue.split('.');
			if (parts.length >= 2) {

				credentialId = parts[0];
			}
			service = 'pocketbase';
		} else if (authHeader.includes('Bearer')) {

			credentialType = 'token';
			service = detectServiceFromURL(url);
		}
	}

	if (service === 'unknown') {
		service = detectServiceFromURL(url);
	}

	try {
		const response = await originalFetch(input, init);
		const responseTime = performance.now() - startTime;

		if (credentialType && credentialId && isPocketBaseCall) {
			const responseClone = response.clone();
			let responseSize = 0;
			let requestSize = 0;

			try {
				const responseText = await responseClone.text();
				responseSize = new Blob([responseText]).size;
			} catch {

			}

			if (init?.body) {
				if (typeof init.body === 'string') {
					requestSize = new Blob([init.body]).size;
				} else if (init.body instanceof Blob) {
					requestSize = init.body.size;
				} else if (init.body instanceof FormData) {

					requestSize = JSON.stringify([...init.body.entries()]).length;
				}
			}

			credentialUsageService.trackUsage({
				credential_type: credentialType,
				credential_id: credentialId,
				service,
				endpoint: new URL(url, window.location.origin).pathname,
				method,
				status_code: response.status,
				response_time_ms: Math.round(responseTime),
				request_size_bytes: requestSize,
				response_size_bytes: responseSize,
				error_type: response.status >= 400 ? 'http_error' : undefined,
				error_message: response.status >= 400 ? response.statusText : undefined
			});
		}

		return response;
	} catch (error) {
		const responseTime = performance.now() - startTime;

		if (credentialType && credentialId && isPocketBaseCall) {
			credentialUsageService.trackUsage({
				credential_type: credentialType,
				credential_id: credentialId,
				service,
				endpoint: new URL(url, window.location.origin).pathname,
				method,
				status_code: 0,
				response_time_ms: Math.round(responseTime),
				error_type: 'request_error',
				error_message: error instanceof Error ? error.message : String(error)
			});
		}

		throw error;
	}
};

function detectServiceFromURL(url: string): string {
	const urlObj = new URL(url, window.location.origin);
	const hostname = urlObj.hostname.toLowerCase();

	if (hostname.includes('openai.com')) return 'openai';
	if (hostname.includes('anthropic.com') || hostname.includes('claude')) return 'claude';
	if (hostname.includes('github.com')) return 'github';
	if (hostname.includes('googleapis.com') || hostname.includes('gmail') || hostname.includes('calendar')) return 'google';
	if (hostname.includes('fold.money')) return 'fold';
	if (hostname.includes('pocketbase') || url.includes('/api/')) return 'pocketbase';

	return 'unknown';
}

export function trackPocketBaseCall(
	credentialType: 'token' | 'dev_token' | 'api_key',
	credentialId: string,
	url: string,
	method: string,
	startTime: number,
	statusCode: number,
	responseTime: number,
	error?: Error
): void {
	const service = detectServiceFromURL(url);

	credentialUsageService.trackUsage({
		credential_type: credentialType,
		credential_id: credentialId,
		service,
		endpoint: new URL(url, pb.baseUrl).pathname,
		method,
		status_code: statusCode,
		response_time_ms: Math.round(responseTime),
		error_type: error ? 'request_error' : statusCode >= 400 ? 'http_error' : undefined,
		error_message: error?.message || (statusCode >= 400 ? `HTTP ${statusCode}` : undefined)
	});
}

