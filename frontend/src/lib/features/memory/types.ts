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

export interface Insight {
	id: string;
	title: string;
	content: string;
	category: string;
	confidence: number;
	user_rating: number;
	is_highlighted: boolean;
}

export interface TagCount {
	tag: string;
	count: number;
}

export interface StatusData {
	memory_count: number;
	entity_count: number;
	insight_count: number;
}
