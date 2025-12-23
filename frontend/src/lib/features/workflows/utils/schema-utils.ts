import type { DataSchema, FieldDefinition } from '../types';

/**
 * Get field names from a schema
 */
export function getFieldNames(schema: DataSchema | null): string[] {
    if (!schema || !schema.fields) return [];
    return schema.fields.map(f => f.name);
}

/**
 * Get field by name from schema
 */
export function getFieldByName(schema: DataSchema | null, fieldName: string): FieldDefinition | null {
    if (!schema || !schema.fields) return null;
    return schema.fields.find(f => f.name === fieldName) || null;
}

/**
 * Check if a field exists in schema
 */
export function fieldExists(schema: DataSchema | null, fieldName: string): boolean {
    return getFieldByName(schema, fieldName) !== null;
}

/**
 * Get field type from schema
 */
export function getFieldType(schema: DataSchema | null, fieldName: string): string | null {
    const field = getFieldByName(schema, fieldName);
    return field?.type || null;
}

/**
 * Validate field reference
 */
export function validateFieldReference(schema: DataSchema | null, fieldName: string): {
    valid: boolean;
    error?: string;
} {
    if (!fieldName) {
        return { valid: false, error: 'Field name is required' };
    }

    if (!schema || !schema.fields) {
        return { valid: true }; // No schema available, allow custom fields
    }

    const field = getFieldByName(schema, fieldName);
    if (!field) {
        return { valid: false, error: `Field "${fieldName}" not found in schema` };
    }

    return { valid: true };
}

/**
 * Get compatible types for casting
 */
export function getCompatibleCastTypes(sourceType: string): string[] {
    const typeMap: Record<string, string[]> = {
        string: ['string', 'number', 'boolean', 'date'],
        number: ['string', 'number', 'boolean'],
        boolean: ['string', 'boolean', 'number'],
        date: ['string', 'date'],
        json: ['string', 'json'],
    };

    return typeMap[sourceType] || ['string', 'number', 'boolean', 'date'];
}

/**
 * Check if type cast is valid
 */
export function isValidCast(sourceType: string, targetType: string): boolean {
    const compatible = getCompatibleCastTypes(sourceType);
    return compatible.includes(targetType);
}

