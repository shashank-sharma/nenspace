export interface MusicTrack {
    id: string;
    user: string;
    title: string;
    artist: string;
    album: string;
    album_artist: string;
    genre: string;
    year: number;
    track_number: number;
    disc_number: number;
    duration: number;
    bitrate: number;
    sample_rate: number;
    format: string;
    file_path: string;
    file_size: number;
    file_hash: string;
    cover_art: string;
    play_count: number;
    last_played: string;
    rating: number;
    tags?: string[];
    expand?: {
        tags?: Tag[];
    };
    created: string;
    updated: string;
}

export interface Tag {
    id: string;
    name: string;
    color?: string;
    description?: string;
    user: string;
}

export interface MusicPlaylist {
    id: string;
    user: string;
    name: string;
    description: string;
    cover_image: string;
    is_smart: boolean;
    track_count: number;
    total_duration: number;
    created: string;
    updated: string;
}

export interface MusicPlaylistTrack {
    id: string;
    playlist: string;
    track: string;
    position: number;
    added_at: string;
}

export interface MusicPlayHistory {
    id: string;
    user: string;
    track: string;
    played_at: string;
    duration_played: number;
    completed: boolean;
}

export interface AlbumInfo {
    album: string;
    album_artist: string;
    artist: string;
    year: number;
    track_count: number;
    cover_art: string;
    track_id: string;
    genre: string;
}

export interface ArtistInfo {
    artist: string;
    album_count: number;
    track_count: number;
}

export interface TrackStats {
    track_id: string;
    title: string;
    artist: string;
    play_count: number;
    duration: number;
}

export interface ArtistStats {
    artist: string;
    play_count: number;
}

export interface AlbumStats {
    album: string;
    artist: string;
    play_count: number;
}

export interface PlayRecord {
    track_id: string;
    title: string;
    artist: string;
    played_at: string;
    completed: boolean;
}

export interface ListeningStats {
    total_tracks: number;
    total_plays: number;
    total_listen_time: number;
    top_tracks: TrackStats[];
    top_artists: ArtistStats[];
    top_albums: AlbumStats[];
    genre_distribution: Record<string, number>;
    recent_plays: PlayRecord[];
}

export interface ScanProgress {
    total_files: number;
    processed_files: number;
    current_file: string;
    status: 'starting' | 'scanning' | 'completed' | 'error';
    errors: string[];
}

export interface MusicFilter {
    artist?: string;
    album?: string;
    genre?: string;
    tags?: string[];
    search?: string;
    page?: number;
    perPage?: number;
    sort?: string;
}

export interface QueueItem {
    track: MusicTrack;
    queueId: string;
}

export type RepeatMode = 'none' | 'one' | 'all';

export type ShuffleMode = 'off' | 'on';

export interface PlayerState {
    currentTrack: MusicTrack | null;
    queue: QueueItem[];
    queueIndex: number;
    isPlaying: boolean;
    isPaused: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    repeatMode: RepeatMode;
    shuffleMode: ShuffleMode;
}

export interface LocalMusicTrack extends MusicTrack {
    localId?: string;
    syncStatus?: 'synced' | 'pending' | 'failed';
    lastModified?: number;
    cachedAudioBlob?: Blob;
}

