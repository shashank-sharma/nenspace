export interface JournalEntry {
    id?: string;
    user: string;
    title: string;
    content: string;
    date: string;
    mood: string;
    tags: string;
    energy?: number;
    memorable_events?: string[];
    wins?: string[];
    habits_completed?: boolean;
    challenges?: string;
    lessons_learned?: string;
    tomorrow_focus?: string;
    potential_obstacles?: string;
}

export interface ChronicleState {
    currentEntry: JournalEntry | null;
    isLoading: boolean;
    error: string | null;
    currentStep: number;
    viewMode: 'edit' | 'preview' | 'markdown';
    hasEntryForToday: boolean;
}

export type JournalStep = 
    'mood' | 
    'events' | 
    'wins' | 
    'challenges' | 
    'tomorrow' | 
    'complete';

export * from './chronicle.types';
export * from './weather.types';