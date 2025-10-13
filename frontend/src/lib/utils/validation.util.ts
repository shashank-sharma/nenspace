/**
 * Form Validation Utilities
 * Reusable validation rules and validation logic for forms
 */

import { toast } from 'svelte-sonner';

/**
 * A validation rule that checks a value and returns a boolean
 */
export type ValidationRule<T = any> = {
    validate: (value: T) => boolean;
    message: string;
};

/**
 * A schema mapping field names to arrays of validation rules
 */
export type ValidationSchema<T> = {
    [K in keyof T]?: ValidationRule<T[K]>[];
};

/**
 * Result of validation containing validity status and errors
 */
export type ValidationResult<T> = {
    isValid: boolean;
    errors: Partial<Record<keyof T, string>>;
};

/**
 * Common Validation Rules
 */

/**
 * Validates that a value is not empty
 */
export const required = (message = 'This field is required'): ValidationRule => ({
    validate: (value: any) => {
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return value != null;
    },
    message,
});

/**
 * Validates minimum string length
 */
export const minLength = (min: number, message?: string): ValidationRule<string> => ({
    validate: (value: string) => (value?.length ?? 0) >= min,
    message: message ?? `Must be at least ${min} characters`,
});

/**
 * Validates maximum string length
 */
export const maxLength = (max: number, message?: string): ValidationRule<string> => ({
    validate: (value: string) => (value?.length ?? 0) <= max,
    message: message ?? `Must be at most ${max} characters`,
});

/**
 * Validates email format
 */
export const email = (message = 'Invalid email address'): ValidationRule<string> => ({
    validate: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value ?? ''),
    message,
});

/**
 * Validates URL format
 */
export const url = (message = 'Invalid URL'): ValidationRule<string> => ({
    validate: (value: string) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    },
    message,
});

/**
 * Validates against a custom regex pattern
 */
export const pattern = (regex: RegExp, message: string): ValidationRule<string> => ({
    validate: (value: string) => regex.test(value ?? ''),
    message,
});

/**
 * Validates minimum numeric value
 */
export const min = (minValue: number, message?: string): ValidationRule<number> => ({
    validate: (value: number) => value >= minValue,
    message: message ?? `Must be at least ${minValue}`,
});

/**
 * Validates maximum numeric value
 */
export const max = (maxValue: number, message?: string): ValidationRule<number> => ({
    validate: (value: number) => value <= maxValue,
    message: message ?? `Must be at most ${maxValue}`,
});

/**
 * Validates that value is within a range
 */
export const range = (minValue: number, maxValue: number, message?: string): ValidationRule<number> => ({
    validate: (value: number) => value >= minValue && value <= maxValue,
    message: message ?? `Must be between ${minValue} and ${maxValue}`,
});

/**
 * Validates IP address format (IPv4)
 */
export const ipAddress = (message = 'Invalid IP address'): ValidationRule<string> => ({
    validate: (value: string) => /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/.test(value ?? ''),
    message,
});

/**
 * Validates that array has at least one item
 */
export const notEmpty = (message = 'Please select at least one item'): ValidationRule<any[]> => ({
    validate: (value: any[]) => Array.isArray(value) && value.length > 0,
    message,
});

/**
 * Custom validation rule
 */
export const custom = <T>(
    validationFn: (value: T) => boolean,
    message: string
): ValidationRule<T> => ({
    validate: validationFn,
    message,
});

/**
 * Core validation function
 * Validates data against a schema and returns errors
 * 
 * @param data - The data object to validate
 * @param schema - The validation schema
 * @returns Validation result with isValid flag and errors object
 * 
 * @example
 * const result = validate(formData, {
 *     name: [required('Name is required'), minLength(3)],
 *     email: [required(), email()],
 * });
 * 
 * if (!result.isValid) {
 *     console.log(result.errors); // { name: 'Name is required' }
 * }
 */
export function validate<T extends Record<string, any>>(
    data: T,
    schema: ValidationSchema<T>
): ValidationResult<T> {
    const errors: Partial<Record<keyof T, string>> = {};

    for (const [field, rules] of Object.entries(schema) as [keyof T, ValidationRule[]][]) {
        const value = data[field];

        for (const rule of rules ?? []) {
            if (!rule.validate(value)) {
                errors[field] = rule.message;
                break; // Only show first error per field
            }
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Validate and show toast on error
 * Convenience function that validates data and shows first error as toast
 * 
 * @param data - The data object to validate
 * @param schema - The validation schema
 * @returns True if valid, false otherwise
 * 
 * @example
 * if (!validateWithToast(formData, schema)) {
 *     return; // Stop submission
 * }
 */
export function validateWithToast<T extends Record<string, any>>(
    data: T,
    schema: ValidationSchema<T>
): boolean {
    const result = validate(data, schema);

    if (!result.isValid) {
        const firstError = Object.values(result.errors)[0];
        if (firstError) {
            toast.error(firstError);
        }
        return false;
    }

    return true;
}

/**
 * Validate a single field
 * Useful for real-time validation as user types
 * 
 * @param value - The value to validate
 * @param rules - Array of validation rules
 * @returns Error message or null if valid
 * 
 * @example
 * const error = validateField(email, [required(), email()]);
 * if (error) {
 *     emailError = error;
 * }
 */
export function validateField<T>(value: T, rules: ValidationRule<T>[]): string | null {
    for (const rule of rules) {
        if (!rule.validate(value)) {
            return rule.message;
        }
    }
    return null;
}
