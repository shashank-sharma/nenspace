export const MUSIC_PAGE_SIZE = 50;

export const SEARCH_DEBOUNCE_MS = 300;

export const SUPPORTED_AUDIO_FORMATS = [
    'audio/mpeg',
    'audio/flac',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    'audio/aac',
    'audio/x-m4a'
];

export const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];

export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

export const DEFAULT_VOLUME = 0.8;

export const SEEK_STEP = 10;

export const VOLUME_STEP = 0.1;

export const VISUALIZER_MODES = ['bars', 'waveform', 'circular'] as const;

export type VisualizerMode = typeof VISUALIZER_MODES[number];

export const VISUALIZER_COLORS = {
    bars: {
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--primary) / 0.5)'
    },
    waveform: {
        stroke: 'hsl(var(--primary))',
        fill: 'hsl(var(--primary) / 0.2)'
    },
    circular: {
        gradient: ['hsl(var(--primary))', 'hsl(var(--accent))']
    }
};

export const STORAGE_KEYS = {
    VOLUME: 'music-player-volume',
    REPEAT_MODE: 'music-player-repeat',
    SHUFFLE_MODE: 'music-player-shuffle',
    QUEUE: 'music-player-queue',
    CURRENT_TRACK: 'music-player-current',
    CACHED_TRACKS: 'music-cached-tracks'
};

export const MUSIC_EVENTS = {
    TRACK_CHANGED: 'music-track-changed',
    PLAYBACK_STATE_CHANGED: 'music-playback-state-changed',
    QUEUE_UPDATED: 'music-queue-updated',
    VOLUME_CHANGED: 'music-volume-changed',
    PROGRESS_UPDATED: 'music-progress-updated'
};




