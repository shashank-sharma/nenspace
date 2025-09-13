import { pb } from '$lib/config/pocketbase';
import type { PageLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ url }) => {
    try {
        const query = url.searchParams.get('q') || '';
        
        const filterConditions = [`user = "${pb.authStore.model?.id}"`];
        if (query) {
            filterConditions.push(`(title ~ "${query}" || description ~ "${query}")`);
        }
        
        const resultList = await pb.collection('tasks').getList(1, 50, {
            filter: filterConditions.join(" && "),
            sort: '-created'
        });
        
        return {
            tasks: resultList.items,
            searchQuery: query
        };
    } catch (err) {
        console.error('Error loading tasks:', err);
        throw error(500, 'Failed to load tasks');
    }
}; 