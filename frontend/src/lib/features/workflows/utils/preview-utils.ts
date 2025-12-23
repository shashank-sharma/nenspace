import type { DataEnvelope } from '../types';

/**
 * Apply a single transformation to a record
 * This is a simplified client-side version for preview
 */
export function applyTransformationToRecord(
    record: Record<string, any>,
    transformation: Record<string, any>
): Record<string, any> {
    const result = { ...record };
    const type = transformation.type;
    const sourceField = transformation.sourceField;
    const targetField = transformation.targetField;

    switch (type) {
        case 'rename':
            if (sourceField && targetField && result[sourceField] !== undefined) {
                result[targetField] = result[sourceField];
                delete result[sourceField];
            }
            break;
        case 'delete':
            if (sourceField) {
                delete result[sourceField];
            }
            break;
        case 'add':
            if (targetField) {
                result[targetField] = transformation.value || '';
            }
            break;
        case 'modify':
            if (sourceField && result[sourceField] !== undefined) {
                if (transformation.value !== undefined) {
                    result[sourceField] = transformation.value;
                } else if (transformation.expression) {
                    // Simple expression evaluation (basic support)
                    let expr = transformation.expression;
                    for (const [key, value] of Object.entries(result)) {
                        expr = expr.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
                    }
                    result[sourceField] = expr;
                }
            }
            break;
        case 'cast':
            if (sourceField && result[sourceField] !== undefined) {
                const toType = transformation.toType;
                const value = result[sourceField];
                try {
                    switch (toType) {
                        case 'string':
                            result[sourceField] = String(value);
                            break;
                        case 'number':
                            result[sourceField] = Number(value) || 0;
                            break;
                        case 'boolean':
                            result[sourceField] = Boolean(value);
                            break;
                        case 'date':
                            result[sourceField] = new Date(value).toISOString();
                            break;
                    }
                } catch (e) {
                    // Cast failed, keep original
                }
            }
            break;
        case 'copy':
            if (sourceField && targetField && result[sourceField] !== undefined) {
                result[targetField] = result[sourceField];
            }
            break;
        case 'lowercase':
            if (sourceField && typeof result[sourceField] === 'string') {
                result[sourceField] = result[sourceField].toLowerCase();
            }
            break;
        case 'uppercase':
            if (sourceField && typeof result[sourceField] === 'string') {
                result[sourceField] = result[sourceField].toUpperCase();
            }
            break;
        case 'trim':
            if (sourceField && typeof result[sourceField] === 'string') {
                result[sourceField] = result[sourceField].trim();
            }
            break;
        case 'replace':
            if (sourceField && typeof result[sourceField] === 'string') {
                const oldValue = transformation.oldValue || '';
                const newValue = transformation.newValue || '';
                result[sourceField] = result[sourceField].replaceAll(oldValue, newValue);
            }
            break;
        case 'concat':
            if (sourceField) {
                const separator = transformation.separator || ',';
                const fields = targetField ? targetField.split(',').map(f => f.trim()) : [sourceField];
                const values = fields
                    .map(f => result[f])
                    .filter(v => v !== undefined)
                    .map(v => String(v));
                result[sourceField] = values.join(separator);
            }
            break;
        case 'split':
            if (sourceField && targetField && typeof result[sourceField] === 'string') {
                const separator = transformation.separator || ',';
                result[targetField] = result[sourceField].split(separator);
            }
            break;
    }

    return result;
}

/**
 * Apply multiple transformations to sample data for preview
 */
export function applyTransformationsToSample(
    sampleData: DataEnvelope,
    transformations: Array<Record<string, any>>
): {
    data: Array<Record<string, any>>;
    error: string | null;
} {
    if (!sampleData || !sampleData.data || sampleData.data.length === 0) {
        return {
            data: [],
            error: 'No sample data available'
        };
    }

    if (transformations.length === 0) {
        return {
            data: sampleData.data,
            error: null
        };
    }

    try {
        const transformed = sampleData.data.map(record => {
            let result = { ...record };
            
            // Apply transformations in order
            for (const transformation of transformations) {
                result = applyTransformationToRecord(result, transformation);
            }
            
            return result;
        });

        return {
            data: transformed,
            error: null
        };
    } catch (error) {
        return {
            data: [],
            error: error instanceof Error ? error.message : 'Preview generation failed'
        };
    }
}

