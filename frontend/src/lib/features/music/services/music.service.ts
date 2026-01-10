import { pb } from '$lib/config/pocketbase';
import { FilterBuilder } from '$lib/utils';
import type {
    MusicTrack,
    MusicPlaylist,
    AlbumInfo,
    ArtistInfo,
    ListeningStats,
    ScanProgress,
    MusicFilter,
    Tag
} from '../types';
import { MUSIC_PAGE_SIZE } from '../constants';

export class MusicService {
    static async getTracks(filter?: MusicFilter): Promise<{
        items: MusicTrack[];
        page: number;
        perPage: number;
        totalItems: number;
    }> {
        const filterBuilder = FilterBuilder.create()
            .equals('user', pb.authStore.model?.id);
        
        if (filter?.artist) filterBuilder.equals('artist', filter.artist);
        if (filter?.album) filterBuilder.equals('album', filter.album);
        if (filter?.genre) filterBuilder.equals('genre', filter.genre);
        if (filter?.tags && filter.tags.length > 0) filterBuilder.in('tags', filter.tags);
        
        if (filter?.search) {
            filterBuilder.or([
                FilterBuilder.create().contains('title', filter.search),
                FilterBuilder.create().contains('artist', filter.search),
                FilterBuilder.create().contains('album', filter.search)
            ]);
        }

        const result = await pb.collection('music_tracks').getList(
            filter?.page || 1,
            filter?.perPage || MUSIC_PAGE_SIZE,
            {
                filter: filterBuilder.build(),
                sort: filter?.sort || '-created',
                expand: 'tags'
            }
        );

        return {
            items: result.items as unknown as MusicTrack[],
            page: result.page,
            perPage: result.perPage,
            totalItems: result.totalItems
        };
    }

    static async getTrack(id: string): Promise<MusicTrack> {
        const record = await pb.collection('music_tracks').getOne(id, {
            expand: 'tags'
        });
        return record as unknown as MusicTrack;
    }

    static async updateTrack(id: string, data: Partial<MusicTrack>, coverArt?: File): Promise<MusicTrack> {
        const formData = new FormData();
        
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (key === 'tags' && Array.isArray(value)) {
                    value.forEach(tagId => formData.append('tags', tagId));
                } else {
                    formData.append(key, String(value));
                }
            }
        });

        if (coverArt) {
            formData.append('cover_art', coverArt);
        }

        const updated = await pb.collection('music_tracks').update(id, formData, {
            expand: 'tags'
        });
        return updated as unknown as MusicTrack;
    }

    static async getAllTags(): Promise<Tag[]> {
        const records = await pb.collection('tags').getFullList({
            sort: 'name',
            filter: `user = "${pb.authStore.model?.id}"`
        });
        return records as unknown as Tag[];
    }

    static async bulkUpdateTracks(ids: string[], data: Partial<MusicTrack>): Promise<void> {
        // PocketBase doesn't have a built-in bulk update via SDK that is efficient for many records,
        // so we'll use a batch if available or just parallel updates for now as per plan
        await Promise.all(ids.map(id => this.updateTrack(id, data)));
    }

    static async uploadTrack(file: File): Promise<MusicTrack> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await pb.send('/api/music/tracks/upload', {
            method: 'POST',
            body: formData
        });

        return response;
    }

    static async deleteTrack(id: string): Promise<void> {
        // Keep custom route because it handles file cleanup on disk
        await pb.send(`/api/music/tracks/${id}`, {
            method: 'DELETE'
        });
    }

    static async bulkDeleteTracks(ids: string[]): Promise<void> {
        await Promise.all(ids.map(id => this.deleteTrack(id)));
    }

    static getStreamUrl(trackId: string): string {
        return `${pb.baseUrl}/api/music/stream/${trackId}?token=${pb.authStore.token}`;
    }

    static getTrackCoverUrl(track: MusicTrack): string {
        if (!track.cover_art) return '';
        if (track.cover_art.startsWith('http') || track.cover_art.startsWith('blob:')) return track.cover_art;
        return pb.files.getUrl(track as any, track.cover_art);
    }

    static getPlaylistCoverUrl(playlist: MusicPlaylist): string {
        if (!playlist.cover_image) return '';
        if (playlist.cover_image.startsWith('http')) return playlist.cover_image;
        return pb.files.getUrl(playlist as any, playlist.cover_image);
    }

    static getAlbumCoverUrl(album: AlbumInfo): string {
        if (!album.cover_art) return '';
        if (album.cover_art.startsWith('http')) return album.cover_art;
        // Albums use the cover art of one of their tracks
        return pb.files.getUrl({ collectionId: 'music_tracks', id: album.track_id } as any, album.cover_art);
    }

    static async getAlbums(): Promise<AlbumInfo[]> {
        const response = await pb.send('/api/music/albums', {
            method: 'GET'
        });
        return response;
    }

    static async getArtists(): Promise<ArtistInfo[]> {
        const response = await pb.send('/api/music/artists', {
            method: 'GET'
        });
        return response;
    }

    static async getGenres(): Promise<string[]> {
        const response = await pb.send('/api/music/genres', {
            method: 'GET'
        });
        return response;
    }

    static async getPlaylists(): Promise<MusicPlaylist[]> {
        const result = await pb.collection('music_playlists').getFullList({
            filter: `user = "${pb.authStore.model?.id}"`,
            sort: '-created'
        });
        return result as unknown as MusicPlaylist[];
    }

    static async createPlaylist(name: string, description?: string): Promise<MusicPlaylist> {
        const created = await pb.collection('music_playlists').create({
            name,
            description,
            user: pb.authStore.model?.id,
            track_count: 0,
            total_duration: 0
        });
        return created as unknown as MusicPlaylist;
    }

    static async getPlaylist(id: string): Promise<{ playlist: MusicPlaylist; tracks: MusicTrack[] }> {
        const playlist = await pb.collection('music_playlists').getOne(id);
        const tracksResult = await pb.collection('music_playlist_tracks').getList(1, 1000, {
            filter: `playlist = "${id}"`,
            sort: 'position',
            expand: 'track'
        });
        
        const tracks = tracksResult.items.map(item => item.expand?.track).filter(Boolean) as unknown as MusicTrack[];

        return {
            playlist: playlist as unknown as MusicPlaylist,
            tracks
        };
    }

    static async updatePlaylist(id: string, data: { name?: string; description?: string }): Promise<MusicPlaylist> {
        const updated = await pb.collection('music_playlists').update(id, data);
        return updated as unknown as MusicPlaylist;
    }

    static async deletePlaylist(id: string): Promise<void> {
        await pb.collection('music_playlists').delete(id);
    }

    static async addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
        // 1. Get track and playlist info
        const [track, playlist] = await Promise.all([
            this.getTrack(trackId),
            pb.collection('music_playlists').getOne(playlistId)
        ]);

        // 2. Find next position
        const lastTrack = await pb.collection('music_playlist_tracks').getFirstListItem(`playlist = "${playlistId}"`, {
            sort: '-position'
        }).catch(() => null);

        const position = (lastTrack?.position || 0) + 1;

        // 3. Create link and update playlist stats
        await Promise.all([
            pb.collection('music_playlist_tracks').create({
                playlist: playlistId,
                track: trackId,
                position
            }),
            pb.collection('music_playlists').update(playlistId, {
                track_count: (playlist.track_count || 0) + 1,
                total_duration: (playlist.total_duration || 0) + Math.floor(track.duration || 0)
            })
        ]);
    }

    static async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
        // 1. Get track and playlist info
        const [track, playlist, link] = await Promise.all([
            this.getTrack(trackId),
            pb.collection('music_playlists').getOne(playlistId),
            pb.collection('music_playlist_tracks').getFirstListItem(
                `playlist = "${playlistId}" && track = "${trackId}"`
            )
        ]);

        // 2. Delete link and update playlist stats
        await Promise.all([
            pb.collection('music_playlist_tracks').delete(link.id),
            pb.collection('music_playlists').update(playlistId, {
                track_count: Math.max(0, (playlist.track_count || 0) - 1),
                total_duration: Math.max(0, (playlist.total_duration || 0) - Math.floor(track.duration || 0))
            })
        ]);
    }

    static async recordPlay(trackId: string, durationPlayed: number, completed: boolean): Promise<void> {
        // recordPlay still needs to update play_count which is complex, so keeping custom route
        await pb.send('/api/music/history', {
            method: 'POST',
            body: JSON.stringify({
                track_id: trackId,
                duration_played: durationPlayed,
                completed
            })
        });
    }

    static async getPlayHistory(limit: number = 50): Promise<any[]> {
        const result = await pb.collection('music_play_history').getList(1, limit, {
            filter: `user = "${pb.authStore.model?.id}"`,
            sort: '-created',
            expand: 'track'
        });
        return result.items;
    }

    static async getListeningStats(): Promise<ListeningStats> {
        const response = await pb.send('/api/music/stats', {
            method: 'GET'
        });
        return response;
    }

    static async startScan(): Promise<void> {
        await pb.send('/api/music/scan', {
            method: 'POST'
        });
    }

    static async getScanStatus(): Promise<ScanProgress> {
        const response = await pb.send('/api/music/scan/status', {
            method: 'GET'
        });
        return response;
    }

    static formatDuration(seconds: number): string {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    static formatFileSize(bytes: number): string {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let unitIndex = 0;
        let size = bytes;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }
}
