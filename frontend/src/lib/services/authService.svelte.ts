import PocketBase from 'pocketbase';
import { pb } from '$lib/config/pocketbase';

class AuthService {
	#pb: PocketBase;
	#currentUser = $state<any>(null);

	constructor(pb: PocketBase) {
		this.#pb = pb;
		this.#pb.authStore.onChange((_, model) => {
			this.#currentUser = model;
		}, true);
	}

	get user(): any {
		return this.#currentUser;
	}

	get isAuthenticated(): boolean {
		return this.#currentUser !== null && this.#pb.authStore.isValid;
	}

	async login(email: string, password: string): Promise<void> {
		try {
			const authData = await this.#pb.collection('users').authWithPassword(email, password);
			this.#currentUser = authData.record;
		} catch (error) {
			console.error('Login failed:', error);
			throw new Error('Login failed. Please check your credentials.');
		}
	}

	logout(): void {
		this.#pb.authStore.clear();
		this.#currentUser = null;
	}
}

export const authService = new AuthService(pb);