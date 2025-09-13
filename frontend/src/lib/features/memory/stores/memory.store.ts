import { writable } from 'svelte/store';
import type { 
    Memory, 
    Entity, 
    Insight,
    TagCount,
    StatusData,
    SelectedMemory,
    SelectedEntity,
    SelectedInsight
} from '../types';
import { MemoryAPI } from '../services/memoryApi';

interface MemoryState {
    memories: Memory[];
    insights: Insight[];
    entities: Entity[];
    memoryTags: TagCount[];
    statusData: StatusData | null;
    isLoading: boolean;
    searchQuery: string;
    activeTab: 'timeline' | 'search' | 'entities' | 'insights' | 'tags';
    selectedMemory: SelectedMemory | null;
    selectedEntity: SelectedEntity | null;
    selectedInsight: SelectedInsight | null;
}

const initialState: MemoryState = {
    memories: [],
    insights: [],
    entities: [],
    memoryTags: [],
    statusData: null,
    isLoading: false,
    searchQuery: '',
    activeTab: 'timeline',
    selectedMemory: null,
    selectedEntity: null,
    selectedInsight: null
};

function createMemoryStore() {
    const { subscribe, update, set } = writable<MemoryState>(initialState);

    return {
        subscribe,
        
        setActiveTab: (tab: MemoryState['activeTab']) => {
            update(state => ({ ...state, activeTab: tab }));
        },
        
        setSearchQuery: (query: string) => {
            update(state => ({ ...state, searchQuery: query }));
        },
        
        resetSelection: () => {
            update(state => ({ 
                ...state, 
                selectedMemory: null,
                selectedEntity: null,
                selectedInsight: null
            }));
        },
        
        // Memory timeline fetch
        async fetchMemoryTimeline() {
            update(state => ({ ...state, isLoading: true }));
            
            try {
                const response = await MemoryAPI.send("/memory/timeline", {
                    method: "GET",
                    params: {
                        limit: 50,
                    },
                });

                if (response && response.memories) {
                    update(state => ({ 
                        ...state, 
                        memories: response.memories,
                        isLoading: false
                    }));
                }
            } catch (error) {
                console.error("Error fetching memory timeline:", error);
                update(state => ({ ...state, isLoading: false }));
            }
        },

        // Memory search
        async searchMemories(query: string) {
            if (!query.trim()) {
                this.fetchMemoryTimeline();
                return;
            }

            update(state => ({ 
                ...state, 
                isLoading: true,
                searchQuery: query
            }));

            try {
                const response = await MemoryAPI.send("/memory/search", {
                    method: "POST",
                    body: {
                        query: query,
                        limit: 20,
                    },
                });

                if (response && response.memories) {
                    update(state => ({ 
                        ...state, 
                        memories: response.memories,
                        isLoading: false
                    }));
                }
            } catch (error) {
                console.error("Error searching memories:", error);
                update(state => ({ ...state, isLoading: false }));
            }
        },

        // Fetch insights
        async fetchInsights() {
            update(state => ({ ...state, isLoading: true }));
            
            try {
                const response = await MemoryAPI.send("/insights", {
                    method: "GET",
                    params: {
                        limit: 20,
                    },
                });

                if (response && response.insights) {
                    update(state => ({ 
                        ...state, 
                        insights: response.insights,
                        isLoading: false
                    }));
                }
            } catch (error) {
                console.error("Error fetching insights:", error);
                update(state => ({ ...state, isLoading: false }));
            }
        },

        // Fetch entities
        async fetchEntities() {
            update(state => ({ ...state, isLoading: true }));
            
            try {
                const response = await MemoryAPI.send("/entities", {
                    method: "GET",
                    params: {
                        limit: 50,
                    },
                });

                if (response && response.entities) {
                    update(state => ({ 
                        ...state, 
                        entities: response.entities,
                        isLoading: false
                    }));
                }
            } catch (error) {
                console.error("Error fetching entities:", error);
                update(state => ({ ...state, isLoading: false }));
            }
        },

        // Fetch memory tags
        async fetchMemoryTags() {
            try {
                const response = await MemoryAPI.send("/memory/tags");

                if (response && response.tags) {
                    update(state => ({ ...state, memoryTags: response.tags }));
                }
            } catch (error) {
                console.error("Error fetching memory tags:", error);
            }
        },

        // Fetch memory system status
        async fetchMemoryStatus() {
            try {
                const response = await MemoryAPI.send("/memory/status");

                if (response) {
                    update(state => ({ ...state, statusData: response }));
                }
            } catch (error) {
                console.error("Error fetching memory status:", error);
            }
        },

        // Fetch memory detail by ID
        async selectMemory(memoryId: string) {
            update(state => ({ 
                ...state, 
                isLoading: true,
                selectedEntity: null,
                selectedInsight: null
            }));
            
            try {
                const response = await MemoryAPI.send(`/memory/${memoryId}`);

                if (response && response.memory) {
                    update(state => ({ 
                        ...state, 
                        selectedMemory: {
                            memory: response.memory,
                            related_entities: response.related_entities || []
                        },
                        isLoading: false
                    }));
                }
            } catch (error) {
                console.error("Error fetching memory details:", error);
                update(state => ({ ...state, isLoading: false }));
            }
        },

        // Fetch entity detail by ID
        async selectEntity(entityId: string) {
            update(state => ({ 
                ...state, 
                isLoading: true,
                selectedMemory: null,
                selectedInsight: null
            }));
            
            try {
                const response = await MemoryAPI.send(`/entity/${entityId}`);

                if (response && response.entity) {
                    update(state => ({ 
                        ...state, 
                        selectedEntity: {
                            entity: response.entity,
                            related_memories: response.related_memories || []
                        },
                        isLoading: false
                    }));
                }
            } catch (error) {
                console.error("Error fetching entity details:", error);
                update(state => ({ ...state, isLoading: false }));
            }
        },

        // Fetch insight detail by ID
        async selectInsight(insightId: string) {
            update(state => ({ 
                ...state, 
                isLoading: true,
                selectedMemory: null,
                selectedEntity: null
            }));
            
            try {
                const response = await MemoryAPI.send(`/insight/${insightId}`);

                if (response && response.insight) {
                    update(state => ({ 
                        ...state, 
                        selectedInsight: {
                            insight: response.insight,
                            source_memories: response.source_memories || [],
                            related_entities: response.related_entities || []
                        },
                        isLoading: false
                    }));
                }
            } catch (error) {
                console.error("Error fetching insight details:", error);
                update(state => ({ ...state, isLoading: false }));
            }
        },
        
        // Initialize the memory dashboard
        async initialize() {
            update(state => ({ ...state, isLoading: true }));
            
            await Promise.all([
                this.fetchMemoryTimeline(),
                this.fetchInsights(),
                this.fetchEntities(),
                this.fetchMemoryTags(),
                this.fetchMemoryStatus(),
            ]);
            
            update(state => ({ ...state, isLoading: false }));
        }
    };
}

export const memoryStore = createMemoryStore(); 