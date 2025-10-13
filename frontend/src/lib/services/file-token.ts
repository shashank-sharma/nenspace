import { pb } from '$lib/config/pocketbase';

interface FileToken {
	token: string;
	expiresAt: number;
}

let fileToken: FileToken | null = null;
let tokenPromise: Promise<string> | null = null;

async function getFileToken(): Promise<string> {
	const now = Date.now();
	if (fileToken && fileToken.expiresAt > now) {
		return fileToken.token;
	}

	if (tokenPromise) {
		return tokenPromise;
	}

	tokenPromise = new Promise<string>(async (resolve, reject) => {
		try {
			const token = await pb.files.getToken();
			fileToken = {
				token,
				expiresAt: now + 110 * 1000 // 110 seconds
			};
			resolve(token);
		} catch (error) {
			console.error('Error fetching file token:', error);
			reject(error);
		} finally {
			tokenPromise = null;
		}
	});

	return tokenPromise;
}

async function getAuthenticatedFileUrl(fileUrl: string): Promise<string> {
	if (!fileUrl) return '';
	try {
		const token = await getFileToken();
		const separator = fileUrl.includes('?') ? '&' : '?';
		return `${fileUrl}${separator}token=${token}`;
	} catch {
		return fileUrl;
	}
}

export const FileService = {
	getAuthenticatedFileUrl
}; 