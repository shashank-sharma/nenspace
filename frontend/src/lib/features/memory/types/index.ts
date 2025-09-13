/**
 * Interface for Memory object
 */
export interface Memory {
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

/**
 * Interface for Entity object
 */
export interface Entity {
    id: string;
    name: string;
    description: string;
    entity_type: string;
    importance: number;
    interaction_count: number;
    first_seen: string;
    last_seen: string;
}

/**
 * Interface for Insight object
 */
export interface Insight {
    id: string;
    title: string;
    content: string;
    category: string;
    confidence: number;
    user_rating: number;
    is_highlighted: boolean;
}

/**
 * Interface for Tag count
 */
export interface TagCount {
    tag: string;
    count: number;
}

/**
 * Interface for Memory system status
 */
export interface StatusData {
    memory_count: number;
    entity_count: number;
    insight_count: number;
}

/**
 * Interface for selected memory detail
 */
export interface SelectedMemory {
    memory: Memory;
    related_entities?: Entity[];
}

/**
 * Interface for selected entity detail
 */
export interface SelectedEntity {
    entity: Entity;
    related_memories?: Memory[];
}

/**
 * Interface for selected insight detail
 */
export interface SelectedInsight {
    insight: Insight;
    source_memories?: Memory[];
    related_entities?: Entity[];
} 