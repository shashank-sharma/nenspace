import { Bug, Info, AlertTriangle, XCircle, Skull } from 'lucide-svelte';
import type { LogLevel } from '../types';
import type { ComponentType } from 'svelte';

export interface LogLevelConfig {
    color: string;
    bg: string;
    border: string;
    icon: ComponentType;
    label: string;
}

export const LOG_LEVELS: Record<LogLevel, LogLevelConfig> = {
    debug: {
        color: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        icon: Bug as any,
        label: 'Debug'
    },
    info: {
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: Info as any,
        label: 'Info'
    },
    warn: {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: AlertTriangle as any,
        label: 'Warning'
    },
    error: {
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: XCircle as any,
        label: 'Error'
    },
    fatal: {
        color: 'text-rose-500',
        bg: 'bg-rose-500/20',
        border: 'border-rose-500/30',
        icon: Skull as any,
        label: 'Fatal'
    }
};

export const LOGS_PER_PAGE = 50;
export const SEARCH_DEBOUNCE_MS = 300;
export const REALTIME_MAX_LOGS = 200;

