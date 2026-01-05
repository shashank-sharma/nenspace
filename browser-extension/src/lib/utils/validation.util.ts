// Validation utilities

import { ERROR_MESSAGES } from '$lib/config/constants'

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Check if field is not empty
 */
export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0
}

/**
 * Validate required field
 */
export function validateRequired(value: string, fieldName: string): string | null {
  if (!isNotEmpty(value)) {
    return `${fieldName} ${ERROR_MESSAGES.REQUIRED_FIELD.toLowerCase()}`
  }
  return null
}

/**
 * Validate email field
 */
export function validateEmail(email: string): string | null {
  if (!isNotEmpty(email)) {
    return ERROR_MESSAGES.REQUIRED_FIELD
  }
  if (!isValidEmail(email)) {
    return ERROR_MESSAGES.INVALID_EMAIL
  }
  return null
}

/**
 * Validate URL field
 */
export function validateUrl(url: string): string | null {
  if (!isNotEmpty(url)) {
    return ERROR_MESSAGES.REQUIRED_FIELD
  }
  if (!isValidUrl(url)) {
    return ERROR_MESSAGES.INVALID_URL
  }
  return null
}

/**
 * Validate password (minimum length)
 */
export function validatePassword(password: string, minLength: number = 8): string | null {
  if (!isNotEmpty(password)) {
    return ERROR_MESSAGES.REQUIRED_FIELD
  }
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters`
  }
  return null
}

