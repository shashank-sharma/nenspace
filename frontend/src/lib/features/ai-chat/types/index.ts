export interface Conversation {
    id: string;
    user: string;
    title: string;
    model: string;
    system_prompt?: string;
    settings?: {
        temperature?: number;
        max_tokens?: number;
        [key: string]: any;
    };
    is_favorite: boolean;
    tags?: string[];
    archived: boolean;
    created: string;
    updated: string;
}

export interface Source {
    title: string;
    url: string;
    snippet?: string;
}

export interface ToolExecution {
    name: string;
    state: 'pending' | 'running' | 'completed' | 'error';
    input: Record<string, any>;
    output?: any;
    error?: string;
}

export interface ChatMessage {
    id: string;
    conversation: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model_used?: string;
    tokens?: number;
    parent_message?: string;
    metadata?: {
        files?: Array<{
            name: string;
            type: string;
            size: number;
            url?: string;
            data?: string;
            id?: string;
        }>;
        reactions?: Record<string, any>;
        sources?: Source[];
        reasoning?: string;
        tools?: ToolExecution[];
        [key: string]: any;
    };
    created: string;
}

export interface ModelPreset {
    id: string;
    user: string;
    name: string;
    model: string;
    temperature: number;
    max_tokens: number;
    system_prompt?: string;
    is_default: boolean;
    created: string;
}

export interface ChatSettings {
    id: string;
    user: string;
    default_model: string;
    theme: 'light' | 'dark' | 'auto';
    status_window_position?: { x: number; y: number };
    keyboard_shortcuts?: Record<string, string>;
}

export interface ChatUsageStats {
    id: string;
    user: string;
    conversation?: string;
    date: string;
    tokens_used: number;
    requests_count: number;
    cost?: number;
    model: string;
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: string;
    max_tokens?: number;
    supports_streaming: boolean;
    supports_tools: boolean;
    pricing?: {
        input_cost_per_token?: number;
        output_cost_per_token?: number;
    };
}

export interface ConversationFilter {
    searchQuery?: string;
    model?: string;
    archived?: boolean;
    favorite?: boolean;
    tags?: string[];
}

export interface ChatState {
    conversations: Conversation[];
    activeConversation: Conversation | null;
    messages: ChatMessage[];
    isLoading: boolean;
    isStreaming: boolean;
    error: string | null;
    searchQuery: string;
}

export interface LocalConversation extends Conversation {
    localId?: string;
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number;
}

export interface LocalChatMessage extends ChatMessage {
    localId?: string;
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number;
}

export interface TokenUsage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cachedTokens?: number;
    reasoningTokens?: number;
}

export interface Checkpoint {
    id: string;
    messageId: string;
    conversationId: string;
    title?: string;
    created: string;
}

export interface MessageBranch {
    messageId: string;
    branches: ChatMessage[];
    currentIndex: number;
}
