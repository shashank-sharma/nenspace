import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
    try {
        // Return empty initial state that will be populated on the client
        return {
            initialMailState: {
                isAuthenticated: false,
                isLoading: true,
                isAuthenticating: false,
                syncStatus: null,
                lastChecked: null,
                syncAvailable: false
            },
            initialMailMessages: {
                messages: [],
                isLoading: true,
                totalItems: 0,
                page: 1,
                perPage: 20,
                selectedMail: null
            }
        };
    } catch (err: any) {
        console.error('Error in mail page server load:', err);
        throw error(500, 'Failed to initialize mail component');
    }
}; 