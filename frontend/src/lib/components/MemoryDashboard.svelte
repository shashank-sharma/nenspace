<!-- MemoryDashboard.svelte -->
<script lang="ts">
    import { onMount } from "svelte";
    import { pb } from "$lib/config/pocketbase";

    // Custom API client for memory system endpoints
    class MemoryAPI {
        static async send(
            endpoint: string,
            options: {
                method?: string;
                params?: Record<string, any>;
                body?: any;
            } = {},
        ) {
            const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
            const method = options.method || "GET";
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            // Include the auth token if user is authenticated
            if (pb.authStore.isValid) {
                headers["Authorization"] = pb.authStore.token;
            }

            const fetchOptions: RequestInit = {
                method,
                headers,
            };

            // Add body for non-GET requests
            if (method !== "GET" && options.body) {
                fetchOptions.body = JSON.stringify(options.body);
            }

            // Add query params
            let finalUrl = url;
            if (options.params) {
                const searchParams = new URLSearchParams();
                for (const key in options.params) {
                    if (
                        options.params[key] !== undefined &&
                        options.params[key] !== null
                    ) {
                        searchParams.append(
                            key,
                            options.params[key].toString(),
                        );
                    }
                }
                const queryString = searchParams.toString();
                if (queryString) {
                    finalUrl += `?${queryString}`;
                }
            }

            try {
                // Construct the full URL by adding the baseUrl and api prefix
                const fullUrl = `${pb.baseUrl}/api${finalUrl}`;
                const response = await fetch(fullUrl, fetchOptions);

                if (!response.ok) {
                    throw new Error(
                        `API request failed: ${response.status} ${response.statusText}`,
                    );
                }

                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    return await response.json();
                }

                return await response.text();
            } catch (error) {
                console.error("API request error:", error);
                throw error;
            }
        }
    }

    // Define types for our data structures
    interface Memory {
        id: string;
        title: string;
        content: string;
        memory_type: string;
        created: string;
        importance: number;
        strength: number;
        access_count: number;
        last_accessed: string;
        tags: string;
    }

    interface Entity {
        id: string;
        name: string;
        description: string;
        entity_type: string;
        importance: number;
        interaction_count: number;
        first_seen: string;
        last_seen: string;
    }

    interface Insight {
        id: string;
        title: string;
        content: string;
        category: string;
        confidence: number;
        user_rating: number;
        is_highlighted: boolean;
    }

    interface TagCount {
        tag: string;
        count: number;
    }

    interface StatusData {
        memory_count: number;
        entity_count: number;
        insight_count: number;
    }

    // Component state
    let memories: Memory[] = [];
    let insights: Insight[] = [];
    let entities: Entity[] = [];
    let loading = true;
    let searchQuery = "";
    let activeTab = "timeline";
    let selectedMemory: Memory | null = null;
    let selectedEntity: { entity: Entity; related_memories?: Memory[] } | null =
        null;
    let selectedInsight: {
        insight: Insight;
        source_memories?: Memory[];
        related_entities?: Entity[];
    } | null = null;
    let memoryTags: TagCount[] = [];
    let statusData: StatusData | null = null;

    // Fetch initial data
    onMount(async () => {
        await Promise.all([
            fetchMemoryTimeline(),
            fetchInsights(),
            fetchEntities(),
            fetchMemoryTags(),
            fetchMemoryStatus(),
        ]);
        loading = false;
    });

    // Memory timeline fetch
    async function fetchMemoryTimeline() {
        try {
            const response = await MemoryAPI.send("/memory/timeline", {
                method: "GET",
                params: {
                    limit: 50,
                },
            });

            if (response && response.memories) {
                memories = response.memories;
            }
        } catch (error) {
            console.error("Error fetching memory timeline:", error);
        }
    }

    // Memory search
    async function searchMemories() {
        if (!searchQuery.trim()) {
            await fetchMemoryTimeline();
            return;
        }

        try {
            const response = await MemoryAPI.send("/memory/search", {
                method: "POST",
                body: {
                    query: searchQuery,
                    limit: 20,
                },
            });

            if (response && response.memories) {
                memories = response.memories;
            }
        } catch (error) {
            console.error("Error searching memories:", error);
        }
    }

    // Fetch insights
    async function fetchInsights() {
        try {
            const response = await MemoryAPI.send("/memory/insights", {
                method: "GET",
                params: {
                    limit: 10,
                },
            });

            if (response && response.insights) {
                insights = response.insights;
            }
        } catch (error) {
            console.error("Error fetching insights:", error);
        }
    }

    // Fetch entities
    async function fetchEntities() {
        try {
            const response = await MemoryAPI.send("/memory/entities", {
                method: "GET",
                params: {
                    limit: 20,
                },
            });

            if (response && response.entities) {
                entities = response.entities;
            }
        } catch (error) {
            console.error("Error fetching entities:", error);
        }
    }

    // Fetch memory tags
    async function fetchMemoryTags() {
        try {
            const response = await MemoryAPI.send("/memory/tags", {
                method: "GET",
            });

            if (response && response.tags) {
                memoryTags = response.tags;
            }
        } catch (error) {
            console.error("Error fetching memory tags:", error);
        }
    }

    // Fetch memory status
    async function fetchMemoryStatus() {
        try {
            const response = await MemoryAPI.send("/memory/status", {
                method: "GET",
            });

            if (response) {
                statusData = response;
            }
        } catch (error) {
            console.error("Error fetching memory status:", error);
        }
    }

    // Get memory details
    async function getMemoryDetails(memoryId: string) {
        try {
            const response = await MemoryAPI.send("/memory/details", {
                method: "GET",
                params: {
                    id: memoryId,
                },
            });

            if (response && response.memory) {
                selectedMemory = response.memory;
            }
        } catch (error) {
            console.error("Error fetching memory details:", error);
        }
    }

    // Get entity details
    async function getEntityDetails(entityId: string) {
        try {
            const response = await MemoryAPI.send("/memory/entity", {
                method: "GET",
                params: {
                    id: entityId,
                },
            });

            if (response && response.entity) {
                selectedEntity = response;
            }
        } catch (error) {
            console.error("Error fetching entity details:", error);
        }
    }

    // Get insight details
    async function getInsightDetails(insightId: string) {
        try {
            const response = await MemoryAPI.send("/memory/insight", {
                method: "GET",
                params: {
                    id: insightId,
                },
            });

            if (response && response.insight) {
                selectedInsight = response;
            }
        } catch (error) {
            console.error("Error fetching insight details:", error);
        }
    }

    // Rate an insight
    async function rateInsight(insightId: string, rating: number) {
        try {
            await MemoryAPI.send("/memory/insight/rate", {
                method: "POST",
                params: {
                    id: insightId,
                },
                body: {
                    rating,
                },
            });

            // Refresh insights
            await fetchInsights();

            // Update selected insight if applicable
            if (
                selectedInsight &&
                selectedInsight.insight &&
                selectedInsight.insight.id === insightId
            ) {
                await getInsightDetails(insightId);
            }
        } catch (error) {
            console.error("Error rating insight:", error);
        }
    }

    // Trigger memory consolidation
    async function triggerConsolidation() {
        try {
            await MemoryAPI.send("/memory/consolidate", {
                method: "POST",
                body: {
                    process_type: "consolidation",
                },
            });

            alert("Memory consolidation process started");
        } catch (error) {
            console.error("Error triggering consolidation:", error);
        }
    }

    // Format date
    function formatDate(dateString: string) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }

    // Parse JSON field
    function parseJsonField(field: string | null) {
        if (!field) return [];
        try {
            return JSON.parse(field);
        } catch (e) {
            return [];
        }
    }

    // Filter memories by tag
    async function filterByTag(tag: string) {
        try {
            const response = await MemoryAPI.send("/memory/tag", {
                method: "GET",
                params: {
                    tag,
                    limit: 20,
                },
            });

            if (response && response.memories) {
                memories = response.memories;
            }
        } catch (error) {
            console.error("Error filtering memories by tag:", error);
        }
    }

    // Memory type icon
    function getMemoryTypeIcon(type: string) {
        switch (type) {
            case "episodic":
                return "📅"; // calendar for events
            case "semantic":
                return "🧠"; // brain for knowledge
            case "procedural":
                return "🔧"; // wrench for how-to
            default:
                return "📝"; // note for default
        }
    }

    // Entity type icon
    function getEntityTypeIcon(type: string) {
        switch (type) {
            case "person":
                return "👤";
            case "place":
                return "📍";
            case "project":
                return "📁";
            case "concept":
                return "💡";
            case "device":
                return "📱";
            default:
                return "📦";
        }
    }
</script>

<div class="memory-dashboard">
    <h2>Memory System</h2>

    <!-- Dashboard Status -->
    {#if statusData}
        <div class="status-summary">
            <div class="status-item">
                <span class="status-value">{statusData.memory_count || 0}</span>
                <span class="status-label">Memories</span>
            </div>
            <div class="status-item">
                <span class="status-value">{statusData.entity_count || 0}</span>
                <span class="status-label">Entities</span>
            </div>
            <div class="status-item">
                <span class="status-value">{statusData.insight_count || 0}</span
                >
                <span class="status-label">Insights</span>
            </div>
            <button class="consolidate-button" on:click={triggerConsolidation}
                >Run Consolidation</button
            >
        </div>
    {/if}

    <!-- Search and Navigation -->
    <div class="navigation">
        <div class="search-container">
            <input
                type="text"
                bind:value={searchQuery}
                placeholder="Search memories..."
                on:keyup={(e) => e.key === "Enter" && searchMemories()}
            />
            <button on:click={searchMemories}>Search</button>
        </div>

        <div class="tabs">
            <button
                class={activeTab === "timeline" ? "active" : ""}
                on:click={() => {
                    activeTab = "timeline";
                    fetchMemoryTimeline();
                }}
            >
                Timeline
            </button>
            <button
                class={activeTab === "insights" ? "active" : ""}
                on:click={() => {
                    activeTab = "insights";
                    fetchInsights();
                }}
            >
                Insights
            </button>
            <button
                class={activeTab === "entities" ? "active" : ""}
                on:click={() => {
                    activeTab = "entities";
                    fetchEntities();
                }}
            >
                Entities
            </button>
            <button
                class={activeTab === "tags" ? "active" : ""}
                on:click={() => {
                    activeTab = "tags";
                    fetchMemoryTags();
                }}
            >
                Tags
            </button>
        </div>
    </div>

    <!-- Loading State -->
    {#if loading}
        <div class="loading">Loading memory system data...</div>
    {:else}
        <!-- Memory Timeline -->
        {#if activeTab === "timeline"}
            <div class="memory-list">
                <h3>Memory Timeline</h3>
                {#if memories.length === 0}
                    <div class="empty-state">No memories found</div>
                {:else}
                    {#each memories as memory (memory.id)}
                        <div
                            class="memory-card"
                            on:click={() => getMemoryDetails(memory.id)}
                        >
                            <div class="memory-header">
                                <span class="memory-type-icon"
                                    >{getMemoryTypeIcon(
                                        memory.memory_type,
                                    )}</span
                                >
                                <span class="memory-type"
                                    >{memory.memory_type}</span
                                >
                                <span class="memory-date"
                                    >{formatDate(memory.created)}</span
                                >
                            </div>
                            <h4 class="memory-title">{memory.title}</h4>
                            <p class="memory-content">
                                {memory.content.substring(0, 120)}...
                            </p>
                            <div class="memory-tags">
                                {#each parseJsonField(memory.tags) as tag}
                                    <span
                                        class="tag"
                                        on:click|stopPropagation={() =>
                                            filterByTag(tag)}>{tag}</span
                                    >
                                {/each}
                            </div>
                            <div class="memory-metrics">
                                <span class="metric" title="Importance"
                                    >📊 {memory.importance.toFixed(2)}</span
                                >
                                <span class="metric" title="Strength"
                                    >💪 {memory.strength.toFixed(2)}</span
                                >
                                <span class="metric" title="Access Count"
                                    >👁️ {memory.access_count}</span
                                >
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Insights -->
        {:else if activeTab === "insights"}
            <div class="insights-list">
                <h3>Insights</h3>
                {#if insights.length === 0}
                    <div class="empty-state">No insights found</div>
                {:else}
                    {#each insights as insight (insight.id)}
                        <div
                            class="insight-card"
                            on:click={() => getInsightDetails(insight.id)}
                        >
                            <div class="insight-header">
                                <span class="insight-category"
                                    >{insight.category}</span
                                >
                                <span
                                    class="insight-confidence"
                                    title="Confidence"
                                    >{(insight.confidence * 100).toFixed(
                                        0,
                                    )}%</span
                                >
                            </div>
                            <h4 class="insight-title">{insight.title}</h4>
                            <p class="insight-content">{insight.content}</p>
                            {#if insight.user_rating > 0}
                                <div class="rating">
                                    <span
                                        >Your rating: {insight.user_rating.toFixed(
                                            1,
                                        )}</span
                                    >
                                </div>
                            {:else}
                                <div class="rating-buttons">
                                    <span>Rate this insight:</span>
                                    {#each [1, 2, 3, 4, 5] as star}
                                        <button
                                            class="star-button"
                                            on:click|stopPropagation={() =>
                                                rateInsight(insight.id, star)}
                                        >
                                            ⭐
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Entities -->
        {:else if activeTab === "entities"}
            <div class="entities-list">
                <h3>Entities</h3>
                {#if entities.length === 0}
                    <div class="empty-state">No entities found</div>
                {:else}
                    {#each entities as entity (entity.id)}
                        <div
                            class="entity-card"
                            on:click={() => getEntityDetails(entity.id)}
                        >
                            <div class="entity-header">
                                <span class="entity-type-icon"
                                    >{getEntityTypeIcon(
                                        entity.entity_type,
                                    )}</span
                                >
                                <span class="entity-type"
                                    >{entity.entity_type}</span
                                >
                            </div>
                            <h4 class="entity-name">{entity.name}</h4>
                            <p class="entity-description">
                                {entity.description}
                            </p>
                            <div class="entity-metrics">
                                <span class="metric" title="Importance"
                                    >📊 {entity.importance.toFixed(2)}</span
                                >
                                <span class="metric" title="Interactions"
                                    >🔄 {entity.interaction_count}</span
                                >
                                <span class="metric" title="First Seen"
                                    >🕒 {new Date(
                                        entity.first_seen,
                                    ).toLocaleDateString()}</span
                                >
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Tags -->
        {:else if activeTab === "tags"}
            <div class="tags-list">
                <h3>Memory Tags</h3>
                {#if memoryTags.length === 0}
                    <div class="empty-state">No tags found</div>
                {:else}
                    <div class="tag-cloud">
                        {#each memoryTags as tagItem}
                            <div
                                class="tag-item"
                                style="font-size: {Math.max(
                                    0.8,
                                    Math.min(2, 0.8 + tagItem.count / 10),
                                )}rem"
                                on:click={() => filterByTag(tagItem.tag)}
                            >
                                {tagItem.tag}
                                <span class="tag-count">({tagItem.count})</span>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    {/if}

    <!-- Memory Detail Modal -->
    {#if selectedMemory}
        <div class="modal">
            <div class="modal-content">
                <span class="close" on:click={() => (selectedMemory = null)}
                    >&times;</span
                >
                <div class="memory-detail">
                    <div class="memory-detail-header">
                        <span class="memory-type-icon"
                            >{getMemoryTypeIcon(
                                selectedMemory.memory_type,
                            )}</span
                        >
                        <span class="memory-type"
                            >{selectedMemory.memory_type}</span
                        >
                        <span class="memory-date"
                            >{formatDate(selectedMemory.created)}</span
                        >
                    </div>
                    <h3>{selectedMemory.title}</h3>
                    <p class="memory-detail-content">
                        {selectedMemory.content}
                    </p>
                    <div class="memory-detail-tags">
                        <h4>Tags</h4>
                        <div class="tags">
                            {#each parseJsonField(selectedMemory.tags) as tag}
                                <span
                                    class="tag"
                                    on:click={() => {
                                        filterByTag(tag);
                                        selectedMemory = null;
                                    }}>{tag}</span
                                >
                            {/each}
                        </div>
                    </div>
                    <div class="memory-detail-metrics">
                        <h4>Metrics</h4>
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-label">Importance</span>
                                <span class="metric-value"
                                    >{selectedMemory.importance.toFixed(
                                        2,
                                    )}</span
                                >
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Strength</span>
                                <span class="metric-value"
                                    >{selectedMemory.strength.toFixed(2)}</span
                                >
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Access Count</span>
                                <span class="metric-value"
                                    >{selectedMemory.access_count}</span
                                >
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Last Accessed</span>
                                <span class="metric-value"
                                    >{formatDate(
                                        selectedMemory.last_accessed,
                                    )}</span
                                >
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    {/if}

    <!-- Entity Detail Modal -->
    {#if selectedEntity}
        <div class="modal">
            <div class="modal-content">
                <span class="close" on:click={() => (selectedEntity = null)}
                    >&times;</span
                >
                <div class="entity-detail">
                    <div class="entity-detail-header">
                        <span class="entity-type-icon"
                            >{getEntityTypeIcon(
                                selectedEntity.entity.entity_type,
                            )}</span
                        >
                        <span class="entity-type"
                            >{selectedEntity.entity.entity_type}</span
                        >
                    </div>
                    <h3>{selectedEntity.entity.name}</h3>
                    <p class="entity-detail-description">
                        {selectedEntity.entity.description}
                    </p>

                    <div class="entity-detail-metrics">
                        <h4>Information</h4>
                        <div class="metrics-grid">
                            <div class="metric-item">
                                <span class="metric-label">Importance</span>
                                <span class="metric-value"
                                    >{selectedEntity.entity.importance.toFixed(
                                        2,
                                    )}</span
                                >
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Interactions</span>
                                <span class="metric-value"
                                    >{selectedEntity.entity
                                        .interaction_count}</span
                                >
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">First Seen</span>
                                <span class="metric-value"
                                    >{formatDate(
                                        selectedEntity.entity.first_seen,
                                    )}</span
                                >
                            </div>
                            <div class="metric-item">
                                <span class="metric-label">Last Seen</span>
                                <span class="metric-value"
                                    >{formatDate(
                                        selectedEntity.entity.last_seen,
                                    )}</span
                                >
                            </div>
                        </div>
                    </div>

                    {#if selectedEntity.related_memories && selectedEntity.related_memories.length > 0}
                        <div class="related-memories">
                            <h4>Related Memories</h4>
                            <div class="related-list">
                                {#each selectedEntity.related_memories as memory (memory.id)}
                                    <div
                                        class="related-item"
                                        on:click={() => {
                                            getMemoryDetails(memory.id);
                                            selectedEntity = null;
                                        }}
                                    >
                                        <span class="memory-type-icon"
                                            >{getMemoryTypeIcon(
                                                memory.memory_type,
                                            )}</span
                                        >
                                        <span class="related-title"
                                            >{memory.title}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}

    <!-- Insight Detail Modal -->
    {#if selectedInsight}
        <div class="modal">
            <div class="modal-content">
                <span class="close" on:click={() => (selectedInsight = null)}
                    >&times;</span
                >
                <div class="insight-detail">
                    <div class="insight-detail-header">
                        <span class="insight-category"
                            >{selectedInsight.insight.category}</span
                        >
                        <span class="insight-confidence"
                            >Confidence: {(
                                selectedInsight.insight.confidence * 100
                            ).toFixed(0)}%</span
                        >
                    </div>
                    <h3>{selectedInsight.insight.title}</h3>
                    <p class="insight-detail-content">
                        {selectedInsight.insight.content}
                    </p>

                    {#if selectedInsight.insight.user_rating > 0}
                        <div class="rating">
                            <span
                                >Your rating: {selectedInsight.insight.user_rating.toFixed(
                                    1,
                                )}</span
                            >
                        </div>
                    {:else}
                        <div class="rating-buttons">
                            <span>Rate this insight:</span>
                            {#each [1, 2, 3, 4, 5] as star}
                                <button
                                    class="star-button"
                                    on:click={() => {
                                        if (selectedInsight) {
                                            rateInsight(
                                                selectedInsight.insight.id,
                                                star,
                                            );
                                        }
                                    }}
                                >
                                    ⭐
                                </button>
                            {/each}
                        </div>
                    {/if}

                    {#if selectedInsight.source_memories && selectedInsight.source_memories.length > 0}
                        <div class="source-memories">
                            <h4>Source Memories</h4>
                            <div class="source-list">
                                {#each selectedInsight.source_memories as memory (memory.id)}
                                    <div
                                        class="source-item"
                                        on:click={() => {
                                            getMemoryDetails(memory.id);
                                            selectedInsight = null;
                                        }}
                                    >
                                        <span class="memory-type-icon"
                                            >{getMemoryTypeIcon(
                                                memory.memory_type,
                                            )}</span
                                        >
                                        <span class="source-title"
                                            >{memory.title}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    {#if selectedInsight.related_entities && selectedInsight.related_entities.length > 0}
                        <div class="related-entities">
                            <h4>Related Entities</h4>
                            <div class="entity-list">
                                {#each selectedInsight.related_entities as entity (entity.id)}
                                    <div
                                        class="entity-item"
                                        on:click={() => {
                                            getEntityDetails(entity.id);
                                            selectedInsight = null;
                                        }}
                                    >
                                        <span class="entity-type-icon"
                                            >{getEntityTypeIcon(
                                                entity.entity_type,
                                            )}</span
                                        >
                                        <span class="entity-name"
                                            >{entity.name}</span
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .memory-dashboard {
        font-family: "Arial", sans-serif;
        padding: 20px;
        background-color: #f9f9f9;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    h2 {
        color: #333;
        margin-top: 0;
        border-bottom: 2px solid #ddd;
        padding-bottom: 10px;
    }

    .status-summary {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background-color: #fff;
        padding: 15px;
        border-radius: 6px;
        margin-bottom: 20px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .status-item {
        text-align: center;
    }

    .status-value {
        display: block;
        font-size: 24px;
        font-weight: bold;
        color: #4285f4;
    }

    .status-label {
        font-size: 14px;
        color: #666;
    }

    .consolidate-button {
        background-color: #4285f4;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: bold;
    }

    .consolidate-button:hover {
        background-color: #3367d6;
    }

    .navigation {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
    }

    .search-container {
        display: flex;
        gap: 8px;
    }

    .search-container input {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        width: 250px;
    }

    .search-container button {
        background-color: #4285f4;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }

    .tabs {
        display: flex;
        gap: 10px;
    }

    .tabs button {
        background-color: #f1f1f1;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }

    .tabs button.active {
        background-color: #4285f4;
        color: white;
    }

    .loading {
        text-align: center;
        padding: 40px;
        color: #666;
        font-style: italic;
    }

    .empty-state {
        text-align: center;
        padding: 40px;
        color: #666;
        font-style: italic;
        background-color: #f1f1f1;
        border-radius: 6px;
    }

    /* Memory List Styles */
    .memory-list,
    .insights-list,
    .entities-list,
    .tags-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
        gap: 20px;
        margin-top: 20px;
    }

    .memory-list h3,
    .insights-list h3,
    .entities-list h3,
    .tags-list h3 {
        grid-column: 1 / -1;
        margin-bottom: 10px;
        color: #333;
    }

    .memory-card,
    .insight-card,
    .entity-card {
        background-color: white;
        border-radius: 6px;
        padding: 15px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition:
            transform 0.2s,
            box-shadow 0.2s;
    }

    .memory-card:hover,
    .insight-card:hover,
    .entity-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .memory-header,
    .insight-header,
    .entity-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        font-size: 14px;
        color: #666;
    }

    .memory-type-icon,
    .entity-type-icon {
        font-size: 18px;
        margin-right: 8px;
    }

    .memory-title,
    .insight-title,
    .entity-name {
        margin: 0 0 10px 0;
        color: #333;
    }

    .memory-content,
    .insight-content,
    .entity-description {
        margin: 0 0 15px 0;
        color: #555;
        font-size: 14px;
        line-height: 1.4;
    }

    .memory-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 15px;
    }

    .tag {
        background-color: #e1f5fe;
        color: #0277bd;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    }

    .tag:hover {
        background-color: #b3e5fc;
    }

    .memory-metrics,
    .entity-metrics {
        display: flex;
        gap: 12px;
        font-size: 13px;
        color: #666;
    }

    .metric {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    /* Insight Card Styles */
    .insight-category {
        background-color: #ede7f6;
        color: #5e35b1;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
    }

    .insight-confidence {
        font-weight: bold;
        color: #555;
    }

    .rating,
    .rating-buttons {
        margin-top: 10px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .star-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 0;
    }

    /* Tags Cloud */
    .tag-cloud {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 20px;
        background-color: white;
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .tag-item {
        background-color: #e1f5fe;
        color: #0277bd;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .tag-item:hover {
        background-color: #b3e5fc;
    }

    .tag-count {
        color: #666;
        font-size: 0.8em;
    }

    /* Modal Styles */
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .modal-content {
        background-color: white;
        padding: 20px;
        border-radius: 8px;
        width: 80%;
        max-width: 800px;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
    }

    .close {
        position: absolute;
        top: 15px;
        right: 20px;
        font-size: 24px;
        font-weight: bold;
        cursor: pointer;
    }

    /* Detail View Styles */
    .memory-detail,
    .entity-detail,
    .insight-detail {
        padding: 10px;
    }

    .memory-detail-header,
    .entity-detail-header,
    .insight-detail-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
        font-size: 14px;
        color: #666;
    }

    .memory-detail-content,
    .insight-detail-content,
    .entity-detail-description {
        background-color: #f9f9f9;
        padding: 15px;
        border-radius: 6px;
        margin-bottom: 20px;
        line-height: 1.5;
    }

    .memory-detail-tags,
    .memory-detail-metrics {
        margin-bottom: 20px;
    }

    .memory-detail-tags h4,
    .memory-detail-metrics h4,
    .entity-detail-metrics h4,
    .related-memories h4,
    .source-memories h4,
    .related-entities h4 {
        margin-bottom: 10px;
        color: #333;
        font-size: 16px;
    }

    .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 15px;
    }

    .metric-item {
        background-color: #f1f1f1;
        padding: 10px;
        border-radius: 6px;
        text-align: center;
    }

    .metric-label {
        display: block;
        font-size: 12px;
        color: #666;
        margin-bottom: 5px;
    }

    .metric-value {
        font-weight: bold;
        color: #333;
    }

    .related-list,
    .source-list,
    .entity-list {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 10px;
        margin-top: 10px;
    }

    .related-item,
    .source-item,
    .entity-item {
        background-color: #f1f1f1;
        padding: 10px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .related-item:hover,
    .source-item:hover,
    .entity-item:hover {
        background-color: #e1f5fe;
    }

    @media (max-width: 768px) {
        .navigation {
            flex-direction: column;
            gap: 15px;
        }

        .memory-list,
        .insights-list,
        .entities-list,
        .tags-list {
            grid-template-columns: 1fr;
        }

        .modal-content {
            width: 90%;
            max-height: 90vh;
        }

        .metrics-grid {
            grid-template-columns: 1fr 1fr;
        }
    }
</style>
