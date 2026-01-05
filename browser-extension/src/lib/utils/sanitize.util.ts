/**
 * Sanitization utilities for safe HTML rendering
 * Prevents XSS attacks by escaping HTML entities
 */

/**
 * Escape HTML entities to prevent XSS attacks
 * Safe for use with Svelte's text interpolation
 * 
 * @param text - The text to escape
 * @returns Escaped HTML-safe string
 * 
 * @example
 * ```typescript
 * const safe = escapeHtml('<script>alert("xss")</script>');
 * // Returns: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 * ```
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }

  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'/]/g, (char) => escapeMap[char] || char);
}

/**
 * Sanitize notification message for safe display
 * Trims whitespace and escapes HTML
 * 
 * @param message - The notification message
 * @returns Sanitized message
 */
export function sanitizeNotificationMessage(message: string | null | undefined): string {
  if (!message) {
    return '';
  }

  return escapeHtml(String(message).trim());
}

/**
 * Validate and sanitize a URL for safe use
 * 
 * @param url - The URL to validate
 * @param allowedHosts - Array of allowed hostnames (optional)
 * @returns Sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string | null | undefined, allowedHosts?: string[]): string {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    
    // If allowed hosts specified, validate
    if (allowedHosts && allowedHosts.length > 0) {
      if (!allowedHosts.includes(parsed.hostname)) {
        return '';
      }
    }

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Check if a favicon URL is valid and safe
 * 
 * @param url - The favicon URL
 * @returns True if URL is valid and safe
 */
export function isValidFaviconUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow Google's favicon service
    return parsed.hostname === 'www.google.com' && 
           parsed.pathname.startsWith('/s2/favicons');
  } catch {
    return false;
  }
}

