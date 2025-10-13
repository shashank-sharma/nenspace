import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils/pocketbase-filter.util';
import type { JournalEntry } from '../types';

/**
 * ChroniclesService
 * Handles all journal entry CRUD operations
 */
export class ChroniclesService {
    /**
     * Fetch journal entry by date
     * @throws Error if user not authenticated
     */
    static async getEntryByDate(date: Date): Promise<JournalEntry | null> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const dateStr = date.toISOString().slice(0, 10);

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .contains('date', dateStr)
            .build();

        try {
            const record = await pb
                .collection('journal_entries')
                .getFirstListItem(filter);
            
            return record as unknown as JournalEntry;
        } catch (error) {
            // No entry found is not an error - return null
            return null;
        }
    }

    /**
     * Create an empty journal entry template
     */
    static createEmptyEntry(date: Date): JournalEntry {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        return {
            user: userId,
            title: date.toISOString().split('T')[0].replace(/-/g, ''),
            content: '',
            date: date.toISOString().split('T')[0],
            mood: 'neutral',
            tags: '',
            energy: 5,
            memorable_events: [],
            wins: [],
            habits_completed: false,
            challenges: '',
            lessons_learned: '',
            tomorrow_focus: '',
            potential_obstacles: '',
        };
    }

    /**
     * Save or update a journal entry
     * @throws Error if user not authenticated or data invalid
     */
    static async saveJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        // Validate entry data
        if (!entry.date) {
            throw new Error('Entry date is required');
        }

        // Prepare data with user ID
        const data = {
            ...entry,
            user: userId,
        };

        let record;
        if (entry.id) {
            // Update existing entry
            record = await pb.collection('journal_entries').update(entry.id, data);
        } else {
            // Create new entry
            record = await pb.collection('journal_entries').create(data);
        }

        return record as unknown as JournalEntry;
    }

    /**
     * Get all journal entries for a user
     * @throws Error if user not authenticated
     */
    static async getAllEntries(): Promise<JournalEntry[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        const filter = FilterBuilder.create()
            .equals('user', userId)
            .build();

        const result = await pb.collection('journal_entries').getList(1, 100, {
            filter,
            sort: '-date',
        });

        return result.items as unknown as JournalEntry[];
    }

    /**
     * Delete a journal entry
     * @throws Error if user not authenticated
     */
    static async deleteEntry(entryId: string): Promise<void> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        await pb.collection('journal_entries').delete(entryId);
    }

    /**
     * Generate markdown content from structured entry
     */
    static generateMarkdownFromEntry(entry: JournalEntry): string {
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
            const tagArray = entry.tags.split(',').map((tag) => tag.trim());
            markdown += `tags: [${tagArray.map((tag) => `"${tag}"`).join(', ')}]\n`;
        }

        // Close frontmatter
        markdown += `---\n\n`;

        // Add title
        const date = new Date(entry.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        markdown += `## Journal Entry: ${formattedDate}\n\n`;

        // Add wins section
        if (entry.wins && entry.wins.length) {
            markdown += `## Wins & Gratitude\n`;
            entry.wins.forEach((win) => {
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
}