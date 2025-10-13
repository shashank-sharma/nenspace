import { pb } from '$lib/config/pocketbase';

async function refreshToken() {
	try {
		await pb.collection('users').authRefresh();
	} catch (err) {
		pb.authStore.clear();
		// We can't use `goto` here as this is not a component
		if (typeof window !== 'undefined') {
			window.location.href = '/auth/login';
		}
	}
}

export const ApiService = {
	refreshToken
};