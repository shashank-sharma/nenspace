import { writable } from 'svelte/store';
import { pb } from '$lib/config/pocketbase';
import type { ChronicleState, JournalEntry } from '../types';
import { toast } from 'svelte-sonner';
import { browser } from '$app/environment';

const initialState: ChronicleState = {
    currentEntry: null,
    isLoading: false,
    error: null,
    currentStep: 1,
    viewMode: 'edit',
    hasEntryForToday: false
};

// Load state from localStorage if available
function getInitialState(): ChronicleState {
    if (browser) {
        const savedState = localStorage.getItem('chroniclesState');
        if (savedState) {
            try {
                return JSON.parse(savedState);
            } catch (e) {
                console.error('Failed to parse saved chronicles state', e);
            }
        }
    }
    return initialState;
}

function createChroniclesStore() {
    const { subscribe, set, update } = writable<ChronicleState>(getInitialState());

    // Save state to localStorage whenever it changes
    const saveToLocalStorage = (state: ChronicleState) => {
        if (browser) {
            localStorage.setItem('chroniclesState', JSON.stringify(state));
        }
    };

    return {
        subscribe,
        
        // Reset store to initial state
        reset() {
            set(initialState);
            if (browser) {
                localStorage.removeItem('chroniclesState');
            }
        },
        
        // Set current step in the flow
        setStep(step: number) {
            update(state => {
                const newState = { ...state, currentStep: step };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        // Next step in the flow
        nextStep() {
            update(state => {
                const newState = { 
                    ...state, 
                    currentStep: Math.min(state.currentStep + 1, 5) 
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        // Previous step in the flow
        prevStep() {
            update(state => {
                const newState = { 
                    ...state, 
                    currentStep: Math.max(state.currentStep - 1, 1) 
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        // Toggle view mode
        setViewMode(mode: 'edit' | 'preview' | 'markdown') {
            update(state => {
                const newState = { ...state, viewMode: mode };
                saveToLocalStorage(newState);
                return newState;
            });
        },
        
        async loadEntry(date: Date) {
            update(state => ({ ...state, isLoading: true }));
            try {
                const formattedDate = date.toISOString().split('T')[0];
                const userId = pb.authStore.model?.id;
                
                if (!userId) {
                    throw new Error('User not authenticated');
                }
                
                const record = await pb.collection('journal_entries').getFirstListItem(
                    `date = "${formattedDate}" && user = "${userId}"`
                );
                
                // Convert record to JournalEntry type
                const journalEntry: JournalEntry = {
                    id: record.id,
                    user: record.user,
                    title: record.title,
                    content: record.content,
                    date: record.date,
                    mood: record.mood,
                    tags: record.tags,
                    energy: record.energy,
                    memorable_events: record.memorable_events,
                    wins: record.wins,
                    habits_completed: record.habits_completed,
                    challenges: record.challenges,
                    lessons_learned: record.lessons_learned,
                    tomorrow_focus: record.tomorrow_focus,
                    potential_obstacles: record.potential_obstacles
                };
                
                // If we found an entry for today, update hasEntryForToday
                const today = new Date().toISOString().split('T')[0];
                const isToday = formattedDate === today;
                
                update(state => {
                    const newState: ChronicleState = { 
                        ...state, 
                        currentEntry: journalEntry,
                        isLoading: false,
                        hasEntryForToday: isToday
                    };
                    saveToLocalStorage(newState);
                    return newState;
                });
            } catch (error) {
                const today = new Date().toISOString().split('T')[0];
                const isToday = date.toISOString().split('T')[0] === today;
                
                update(state => {
                    const newState: ChronicleState = { 
                        ...state, 
                        currentEntry: null,
                        isLoading: false,
                        hasEntryForToday: false,
                        // If no entry exists for today and we're looking at today,
                        // set to edit mode, otherwise preview
                        viewMode: isToday ? 'edit' : 'preview'
                    };
                    saveToLocalStorage(newState);
                    return newState;
                });
            }
        },

        // Create an empty entry for today
        createEmptyEntry() {
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            const title = today.toISOString().split('T')[0].replace(/-/g, "");
            const userId = pb.authStore.model?.id;
            
            if (!userId) {
                toast.error('Not authenticated');
                return;
            }
            
            const emptyEntry: JournalEntry = {
                user: userId,
                title,
                content: '',
                date: formattedDate,
                mood: 'neutral',
                tags: '',
                energy: 5,
                memorable_events: [],
                wins: [],
                habits_completed: false,
                challenges: '',
                lessons_learned: '',
                tomorrow_focus: '',
                potential_obstacles: ''
            };
            
            update(state => {
                const newState: ChronicleState = { 
                    ...state, 
                    currentEntry: emptyEntry,
                    currentStep: 1,
                    viewMode: 'edit'
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },

        // Update specific field in the current entry
        updateField<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
            update(state => {
                const newState: ChronicleState = { 
                    ...state, 
                    currentEntry: state.currentEntry ? {
                        ...state.currentEntry,
                        [field]: value
                    } : null
                };
                saveToLocalStorage(newState);
                return newState;
            });
        },

        async saveEntry(entry: JournalEntry) {
            update(state => ({ ...state, isLoading: true }));
            try {
                // Generate markdown content from structured fields
                const markdownContent = generateMarkdownFromEntry(entry);
                
                const userId = pb.authStore.model?.id;
                if (!userId) {
                    throw new Error('User not authenticated');
                }
                
                const data = {
                    ...entry,
                    content: markdownContent,
                    user: userId
                };

                let record;
                try {
                    const existingRecord = await pb.collection('journal_entries')
                        .getFirstListItem(`date = "${entry.date}" && user = "${userId}"`);
                    record = await pb.collection('journal_entries').update(existingRecord.id, data);
                    toast.success('Updated successfully');
                } catch {
                    record = await pb.collection('journal_entries').create(data);
                    toast.success('Saved successfully');
                }

                // Convert record to JournalEntry
                const savedEntry: JournalEntry = {
                    id: record.id,
                    user: record.user,
                    title: record.title,
                    content: record.content,
                    date: record.date,
                    mood: record.mood,
                    tags: record.tags,
                    energy: record.energy,
                    memorable_events: record.memorable_events,
                    wins: record.wins,
                    habits_completed: record.habits_completed,
                    challenges: record.challenges,
                    lessons_learned: record.lessons_learned,
                    tomorrow_focus: record.tomorrow_focus,
                    potential_obstacles: record.potential_obstacles
                };

                update(state => {
                    const newState: ChronicleState = { 
                        ...state, 
                        currentEntry: savedEntry,
                        isLoading: false,
                        hasEntryForToday: true,
                        viewMode: 'preview'
                    };
                    
                    // Clear localStorage after successfully saving
                    if (browser) {
                        localStorage.removeItem('chroniclesState');
                    }
                    
                    return newState;
                });
            } catch (error) {
                toast.error('Failed to save');
                update(state => {
                    const newState: ChronicleState = { 
                        ...state, 
                        isLoading: false,
                        error: 'Failed to save entry' 
                    };
                    saveToLocalStorage(newState);
                    return newState;
                });
            }
        }
    };
}

// Helper function to generate markdown from structured entry
function generateMarkdownFromEntry(entry: JournalEntry): string {
    // Start with YAML frontmatter
    let markdown = `---\n`;
    markdown += `date: "${entry.date}"\n`;
    markdown += `mood: "${entry.mood}"\n`;
    
    // Add memorable events as an array
    const events = entry.memorable_events || [];
    markdown += `meetings: [\n`;
    if (events.length > 0) {
        events.forEach((event, index) => {
            markdown += `  "${event.replace(/"/g, '\\"')}"`;
            if (index < events.length - 1) {
                markdown += ',\n';
            } else {
                markdown += '\n';
            }
        });
    }
    markdown += `]\n`;
    
    // Add energy as a numeric value
    if (entry.energy !== undefined) {
        markdown += `energy: ${entry.energy}\n`;
    }
    
    // Add tags if they exist
    if (entry.tags) {
        const tagArray = entry.tags.split(',').map(tag => tag.trim());
        markdown += `tags: [${tagArray.map(tag => `"${tag}"`).join(', ')}]\n`;
    }
    
    // Close frontmatter
    markdown += `---\n\n`;

    // Add title
    const date = new Date(entry.date);
    const formattedDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    markdown += `## Journal Entry: ${formattedDate}\n\n`;

    // Add wins section
    if (entry.wins && entry.wins.length) {
        markdown += `## Wins & Gratitude\n`;
        entry.wins.forEach(win => {
            markdown += `- ${win}\n`;
        });
        markdown += `- **Habits Completed:** ${entry.habits_completed ? 'Yes' : 'No'}\n\n`;
    }

    // Add challenges section
    if (entry.challenges) {
        markdown += `## Challenges & Growth\n`;
        markdown += `${entry.challenges}\n\n`;
        
        if (entry.lessons_learned) {
            markdown += `**Lessons Learned:**\n${entry.lessons_learned}\n\n`;
        }
    }

    // Add tomorrow's focus
    if (entry.tomorrow_focus) {
        markdown += `## Tomorrow's Focus\n`;
        markdown += `${entry.tomorrow_focus}\n\n`;
        
        if (entry.potential_obstacles) {
            markdown += `**Potential Obstacles:**\n${entry.potential_obstacles}\n\n`;
        }
    }

    return markdown;
}

export const chroniclesStore = createChroniclesStore();