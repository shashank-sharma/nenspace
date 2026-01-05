/**
 * Human-Readable Time Parser Utility
 * 
 * Parses natural language time expressions into seconds
 * Examples: "15 min", "1 hr", "60 sec", "1.5 hours", "30m", "2h"
 */

export interface ParsedTime {
  seconds: number;
  isValid: boolean;
  error?: string;
}

/**
 * Time unit multipliers (in seconds)
 */
const TIME_UNITS: Record<string, number> = {
  // Full names
  second: 1,
  seconds: 1,
  sec: 1,
  secs: 1,
  minute: 60,
  minutes: 60,
  min: 60,
  mins: 60,
  hour: 3600,
  hours: 3600,
  hr: 3600,
  hrs: 3600,
  day: 86400,
  days: 86400,
  d: 86400,
  // Abbreviations
  s: 1,
  m: 60,
  h: 3600,
};

/**
 * Regular expression patterns for parsing time
 */
const TIME_PATTERNS = [
  // Pattern: "1.5 hours", "15 min", "60 sec"
  /^([\d.]+)\s*([a-z]+)$/i,
  // Pattern: "1h", "30m", "60s"
  /^([\d.]+)([a-z]+)$/i,
  // Pattern: "1 hour 30 minutes"
  /^([\d.]+)\s*([a-z]+)(?:\s+([\d.]+)\s*([a-z]+))?$/i,
];

/**
 * Parse human-readable time string into seconds
 * 
 * @param input - Time string to parse (e.g., "15 min", "1 hr", "60 sec")
 * @returns ParsedTime object with seconds and validation status
 * 
 * @example
 * parseTime("15 min") // { seconds: 900, isValid: true }
 * parseTime("1 hr") // { seconds: 3600, isValid: true }
 * parseTime("60 sec") // { seconds: 60, isValid: true }
 * parseTime("1.5 hours") // { seconds: 5400, isValid: true }
 * parseTime("30m") // { seconds: 1800, isValid: true }
 * parseTime("2h") // { seconds: 7200, isValid: true }
 */
export function parseTime(input: string): ParsedTime {
  if (!input || typeof input !== 'string') {
    return {
      seconds: 0,
      isValid: false,
      error: 'Input must be a non-empty string'
    };
  }

  // Trim and lowercase
  const trimmed = input.trim().toLowerCase();
  
  if (!trimmed) {
    return {
      seconds: 0,
      isValid: false,
      error: 'Empty input'
    };
  }

  // Try to match patterns
  for (const pattern of TIME_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match) continue;

    try {
      // Extract numeric value and unit
      const value = parseFloat(match[1]);
      
      if (isNaN(value) || value < 0) {
        continue; // Try next pattern
      }

      const unit = match[2].toLowerCase();
      const multiplier = TIME_UNITS[unit];

      if (!multiplier) {
        // Try next pattern if unit not recognized
        continue;
      }

      let totalSeconds = value * multiplier;

      // Handle compound times like "1 hour 30 minutes"
      if (match[3] && match[4]) {
        const value2 = parseFloat(match[3]);
        const unit2 = match[4].toLowerCase();
        const multiplier2 = TIME_UNITS[unit2];
        
        if (!isNaN(value2) && multiplier2) {
          totalSeconds += value2 * multiplier2;
        }
      }

      return {
        seconds: Math.floor(totalSeconds),
        isValid: true
      };
    } catch (error) {
      // Try next pattern
      continue;
    }
  }

  // If no pattern matched, try to parse as pure number (assume seconds)
  const numberValue = parseFloat(trimmed);
  if (!isNaN(numberValue) && numberValue >= 0) {
    return {
      seconds: Math.floor(numberValue),
      isValid: true
    };
  }

  return {
    seconds: 0,
    isValid: false,
    error: `Unable to parse time format: "${input}". Try formats like "15 min", "1 hr", "60 sec"`
  };
}

/**
 * Format seconds into human-readable string
 * 
 * @param seconds - Number of seconds
 * @returns Human-readable time string
 * 
 * @example
 * formatTime(90) // "1m 30s"
 * formatTime(3665) // "1h 1m 5s"
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
}



