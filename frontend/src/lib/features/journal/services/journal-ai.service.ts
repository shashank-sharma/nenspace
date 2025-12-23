/**
 * Journal AI Service
 * 
 * Handles AI reflection generation for stream entries.
 * Uses the backend AI service for generating reflections.
 */

import { pb } from '$lib/config/pocketbase';
import type { LocalStreamEntry } from '../types';
import { extractTitle } from '../utils/date.utils';
import { generateEntryId } from '../utils/pocketbase-id.util';

export interface AIReflectionRequest {
    entryId: string;
    content: string;
    title?: string;
}

export interface AIReflectionResponse {
    reflection: string;
    context?: Record<string, any>;
}

/**
 * Validate entry is synced and has real backend ID
 */
function validateEntrySynced(entry: LocalStreamEntry): void {
    if (!entry.id) {
        throw new Error('Entry ID is required');
    }
    
    if (entry.syncStatus === 'pending') {
        throw new Error('Entry is still syncing, please wait');
    }
    
    if (entry.syncStatus === 'failed') {
        throw new Error('Entry sync failed, please retry sync before using AI');
    }
    
    if (entry.syncStatus !== 'synced') {
        throw new Error('Entry must be synced before using AI features');
    }
}

/**
 * Generate AI reflection for an entry
 */
export async function generateAIReflection(entry: LocalStreamEntry): Promise<LocalStreamEntry> {
    try {
        // Pre-flight check: ensure entry is synced
        validateEntrySynced(entry);

        const url = `/api/journal/entries/${entry.id}/ai-reflect`;
        console.log('[JournalAI] Generating reflection for entry:', entry.id, 'URL:', url);
        
        const response = await pb.send(url, {
            method: 'POST',
            body: JSON.stringify({}),
        });

        // Backend wraps response in { success: true, data: {...} }
        const responseData = (response as any)?.data || response;
        const reflectionData = responseData as AIReflectionResponse;

        // Validate response
        if (!reflectionData || !reflectionData.reflection) {
            throw new Error('AI reflection response is empty or invalid');
        }

        const reflectionText = reflectionData.reflection.trim();
        if (reflectionText.length === 0) {
            throw new Error('AI reflection is empty');
        }

        // Defensive check: ensure parent entry is synced
        if (entry.syncStatus !== 'synced') {
            throw new Error('Parent entry must be synced before generating AI reflection');
        }

        // Create a new entry for the AI reflection
        const reflectionEntry: LocalStreamEntry = {
            id: generateEntryId(), // Use PocketBase-style ID
            user: entry.user,
            content: reflectionText,
            title: extractTitle(reflectionText) || 'AI Reflection',
            entry_date: entry.entry_date, // Same date as original entry
            entry_type: 'ai_reflection',
            entry_color: entry.entry_color || 'blue',
            is_highlighted: false,
            ai_context: reflectionData.context || {},
            parent_entry: entry.id, // Use synced parent ID
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            syncStatus: 'pending',
            lastModified: Date.now(),
        };

        return reflectionEntry;
    } catch (error) {
        console.error('Failed to generate AI reflection:', error);
        throw new Error(`Failed to generate AI reflection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

export interface AIQueryRequest {
    query: string;
    thread_ids?: string[];
}

export interface AIQueryResponse {
    response: string;
    context?: Record<string, any>;
}

/**
 * Ask AI a question about an entry
 * Simplified to match generateAIReflection pattern - uses entry.id directly
 */
export async function askAI(entry: LocalStreamEntry, userQuery: string, threadIds?: string[]): Promise<LocalStreamEntry> {
    try {
        // Pre-flight check: ensure entry is synced
        validateEntrySynced(entry);

        if (!userQuery || !userQuery.trim()) {
            throw new Error('Query is required');
        }

        const url = `/api/journal/entries/${entry.id}/ai-query`;
        console.log('[JournalAI] Asking AI about entry:', entry.id, 'URL:', url, 'Thread IDs:', threadIds);
        
        const requestData: AIQueryRequest = {
            query: userQuery.trim(),
            ...(threadIds && threadIds.length > 0 && { thread_ids: threadIds }),
        };
        
        const response = await pb.send(url, {
            method: 'POST',
            body: JSON.stringify(requestData),
        });

        // Backend wraps response in { success: true, data: {...} }
        const responseData = (response as any)?.data || response;
        const queryData = responseData as AIQueryResponse;

        // Validate response
        if (!queryData || !queryData.response) {
            throw new Error('AI query response is empty or invalid');
        }

        const responseText = queryData.response.trim();
        if (responseText.length === 0) {
            throw new Error('AI response is empty');
        }

        // Format content to show both question and answer
        const formattedContent = `Q: ${userQuery.trim()}\n\nA: ${responseText}`;

        // Defensive check: ensure parent entry is synced
        if (entry.syncStatus !== 'synced') {
            throw new Error('Parent entry must be synced before asking AI');
        }

        // Create a new entry for the AI response
        // Store user query in ai_context for UI reference
        const aiResponseEntry: LocalStreamEntry = {
            id: generateEntryId(), // Use PocketBase-style ID
            user: entry.user,
            content: formattedContent,
            title: extractTitle(responseText) || 'AI Response',
            entry_date: entry.entry_date, // Same date as original entry
            entry_type: 'ai_expanded',
            entry_color: entry.entry_color || 'blue',
            is_highlighted: false,
            ai_context: {
                ...queryData.context,
                user_query: userQuery.trim(),
            },
            parent_entry: entry.id, // Use synced parent ID
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            syncStatus: 'pending',
            lastModified: Date.now(),
        };

        return aiResponseEntry;
    } catch (error) {
        console.error('[JournalAI] Failed to ask AI:', error);
        throw new Error(`Failed to ask AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

