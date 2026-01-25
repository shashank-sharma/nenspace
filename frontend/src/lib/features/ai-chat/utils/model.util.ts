import type { ModelInfo } from '../types';

export function groupModelsByProvider(models: ModelInfo[]): Map<string, ModelInfo[]> {
    const grouped = new Map<string, ModelInfo[]>();

    models.forEach(model => {
        if (!grouped.has(model.provider)) {
            grouped.set(model.provider, []);
        }
        grouped.get(model.provider)!.push(model);
    });

    return grouped;
}

export function getModelDisplayName(model: ModelInfo): string {
    return model.name || model.id.split('/').pop() || model.id;
}

export function getModelShortName(model: ModelInfo): string {
    return model.id.split('/').pop() || model.id;
}
