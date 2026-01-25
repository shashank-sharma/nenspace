// See https://kit.svelte.dev/docs/types#app
// https://github.com/pocketbase/pocketbase/discussions/3363
// for information about these interfaces
// 
declare global {
	namespace App {
		// interface Error {}

	interface Locals {
	}
		// interface PageData {}
		// interface Platform {}
	}
	
	// Vite define constants
	const __APP_VERSION__: string;
	const __GIT_COMMIT__: string;
	const __BUILD_TIME__: string;
}

export {};