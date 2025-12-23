/**
 * Email Utility
 * 
 * Reusable email formatting and parsing utilities
 */

/**
 * Format email string by extracting the email address from formats like:
 * - "Name <email@example.com>"
 * - "email@example.com"
 * 
 * @param str - Email string that may contain name and email
 * @returns Extracted email address or original string if no email found
 * 
 * @example
 * formatEmailString("John Doe <john@example.com>") // "John Doe"
 * formatEmailString("john@example.com") // "john@example.com"
 */
export function formatEmailString(str: string): string {
    if (!str) return "";
    const [email] = str.split("<");
    return email?.trim() || str;
}

/**
 * Format email date for display in mail list
 * Shows time if today, month/day if this year, full date if different year
 * 
 * @param date - Date string or Date object
 * @returns Formatted date string
 * 
 * @example
 * formatEmailDate(new Date()) // "2:30 PM" (if today)
 * formatEmailDate("2024-01-15") // "Jan 15" (if this year)
 * formatEmailDate("2023-01-15") // "Jan 15, 2023" (if different year)
 */
export function formatEmailDate(date: string | Date): string {
    const messageDate = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();

    // If it's today, show the time
    if (messageDate.toDateString() === now.toDateString()) {
        return messageDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }

    // If it's this year but not today, show the month and day
    if (messageDate.getFullYear() === now.getFullYear()) {
        return messageDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    }

    // If it's a different year, include the year
    return messageDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

