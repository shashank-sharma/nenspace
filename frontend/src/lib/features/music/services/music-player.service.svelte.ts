import { browser } from '$app/environment';
import type { MusicTrack, QueueItem, RepeatMode, ShuffleMode, PlayerState } from '../types';
import { MusicService } from './music.service';
import { STORAGE_KEYS, DEFAULT_VOLUME, MUSIC_EVENTS } from '../constants';
import { isTauriEnvironment } from '$lib/utils/tauri.util';

function generateQueueId(): string {
    return `queue_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

class MusicPlayerServiceImpl {
    #audio: HTMLAudioElement | null = null;
    #audioInitialized: boolean = false;
    #tauriEmit: any = null;
    #lastTauriUpdateSecond: number = -1;
    #currentTrack = $state<MusicTrack | null>(null);
    #queue = $state<QueueItem[]>([]);
    #queueIndex = $state<number>(-1);
    #isPlaying = $state<boolean>(false);
    #currentTime = $state<number>(0);
    #duration = $state<number>(0);
    #buffered = $state<number>(0);
    #volume = $state<number>(DEFAULT_VOLUME);
    #isMuted = $state<boolean>(false);
    #repeatMode = $state<RepeatMode>('none');
    #shuffleMode = $state<ShuffleMode>('off');
    #originalQueue = $state<QueueItem[]>([]);
    #playStartTime: number = 0;
    #hasRecordedPlay: boolean = false;

    get currentTrack(): MusicTrack | null {
        return this.#currentTrack;
    }

    get queue(): QueueItem[] {
        return this.#queue;
    }

    get queueIndex(): number {
        return this.#queueIndex;
    }

    get isPlaying(): boolean {
        return this.#isPlaying;
    }

    get currentTime(): number {
        return this.#currentTime;
    }

    get duration(): number {
        return this.#duration;
    }

    get buffered(): number {
        return this.#buffered;
    }

    get volume(): number {
        return this.#volume;
    }

    get isMuted(): boolean {
        return this.#isMuted;
    }

    get repeatMode(): RepeatMode {
        return this.#repeatMode;
    }

    get shuffleMode(): ShuffleMode {
        return this.#shuffleMode;
    }

    get progress(): number {
        if (!this.#duration) return 0;
        return (this.#currentTime / this.#duration) * 100;
    }

    get hasNext(): boolean {
        if (this.#repeatMode === 'all') return this.#queue.length > 0;
        return this.#queueIndex < this.#queue.length - 1;
    }

    get hasPrevious(): boolean {
        if (this.#repeatMode === 'all') return this.#queue.length > 0;
        return this.#queueIndex > 0;
    }

    initialize(): void {
        if (!browser) return;

        if (!this.#audio) {
            this.#audio = new Audio();
            this.#audio.preload = 'auto';
        }

        if (!this.#audioInitialized) {
            if (isTauriEnvironment()) {
                import('@tauri-apps/api/event').then(m => {
                    this.#tauriEmit = m.emit;
                });
            }

            let lastUpdateTime = 0;
            this.#audio.addEventListener('timeupdate', () => {
                const now = performance.now();
                if (now - lastUpdateTime < 250) return;
                lastUpdateTime = now;

                const time = this.#audio?.currentTime || 0;
                this.#currentTime = time;
                
                if (this.#audio && this.#audio.buffered.length > 0) {
                    const bufferedEnd = this.#audio.buffered.end(this.#audio.buffered.length - 1);
                    this.#buffered = (bufferedEnd / (this.#duration || 1)) * 100;
                }

                const second = Math.floor(time);
                if (second !== this.#lastTauriUpdateSecond) {
                    this.#lastTauriUpdateSecond = second;
                    this.emitTauriMusicUpdate();
                }
                
                this.emitEvent(MUSIC_EVENTS.PROGRESS_UPDATED);
            });

            this.#audio.addEventListener('loadedmetadata', () => {
                this.#duration = this.#audio?.duration || 0;
            });

            this.#audio.addEventListener('ended', () => {
                this.handleTrackEnd();
            });

            this.#audio.addEventListener('play', () => {
                this.#isPlaying = true;
                this.emitEvent(MUSIC_EVENTS.PLAYBACK_STATE_CHANGED);
                this.emitTauriMusicUpdate();
            });

            this.#audio.addEventListener('pause', () => {
                this.#isPlaying = false;
                this.emitEvent(MUSIC_EVENTS.PLAYBACK_STATE_CHANGED);
                this.emitTauriMusicUpdate();
            });

            this.#audio.addEventListener('error', (e) => {
                console.error('Audio error:', e);
                this.#isPlaying = false;
            });

            this.#audioInitialized = true;
        }

        this.loadSettings();
        this.setupMediaSession();
        this.setupTauriCommandListener();
    }

    private loadSettings(): void {
        if (!browser) return;

        const savedVolume = localStorage.getItem(STORAGE_KEYS.VOLUME);
        if (savedVolume) {
            this.#volume = parseFloat(savedVolume);
            if (this.#audio) this.#audio.volume = this.#volume;
        }

        const savedRepeat = localStorage.getItem(STORAGE_KEYS.REPEAT_MODE) as RepeatMode;
        if (savedRepeat) this.#repeatMode = savedRepeat;

        const savedShuffle = localStorage.getItem(STORAGE_KEYS.SHUFFLE_MODE) as ShuffleMode;
        if (savedShuffle) this.#shuffleMode = savedShuffle;
    }

    private saveSettings(): void {
        if (!browser) return;

        localStorage.setItem(STORAGE_KEYS.VOLUME, String(this.#volume));
        localStorage.setItem(STORAGE_KEYS.REPEAT_MODE, this.#repeatMode);
        localStorage.setItem(STORAGE_KEYS.SHUFFLE_MODE, this.#shuffleMode);
    }

    private setupMediaSession(): void {
        if (!browser || !('mediaSession' in navigator)) return;

        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.seekTime !== undefined) {
                this.seek(details.seekTime);
            }
        });
    }

    private updateMediaSession(): void {
        if (!browser || !('mediaSession' in navigator) || !this.#currentTrack) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: this.#currentTrack.title,
            artist: this.#currentTrack.artist,
            album: this.#currentTrack.album
        });
    }

    private emitEvent(eventName: string, detail?: any): void {
        if (!browser) return;
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
    }

    private async emitTauriMusicUpdate(): Promise<void> {
        if (!browser || !isTauriEnvironment() || !this.#tauriEmit) return;
        
        try {
            await this.#tauriEmit('music-playback-update', {
                isPlaying: this.#isPlaying,
                track: this.#currentTrack ? {
                    title: this.#currentTrack.title,
                    artist: this.#currentTrack.artist
                } : null,
                progress: this.progress
            });
        } catch (error) {
            console.error('Failed to emit Tauri music update:', error);
        }
    }

    async setupTauriCommandListener(): Promise<(() => void) | null> {
        if (!browser || !isTauriEnvironment()) return null;

        try {
            const { listen } = await import('@tauri-apps/api/event');
            const unlisten = await listen<{ command: string }>('music-controls', (event) => {
                switch (event.payload.command) {
                    case 'previous':
                        this.previous();
                        break;
                    case 'next':
                        this.next();
                        break;
                    case 'toggle':
                        this.togglePlayPause();
                        break;
                }
            });
            return unlisten;
        } catch (error) {
            console.error('Failed to setup Tauri music command listener:', error);
            return null;
        }
    }

    async playTrack(track: MusicTrack): Promise<void> {
        this.initialize();

        if (this.#currentTrack?.id === track.id) {
            if (!this.#isPlaying) {
                try {
                    await this.#audio!.play();
                } catch (error) {
                    console.error('Failed to resume track:', error);
                    await this.loadAndPlayTrack(track);
                }
            }
            return;
        }

        await this.loadAndPlayTrack(track);
    }

    private async loadAndPlayTrack(track: MusicTrack): Promise<void> {
        this.recordCurrentPlay();

        this.#currentTrack = track;
        this.#audio!.src = MusicService.getStreamUrl(track.id);
        this.#playStartTime = Date.now();
        this.#hasRecordedPlay = false;
        this.#buffered = 0;

        try {
            await this.#audio!.play();
            this.updateMediaSession();
            this.emitEvent(MUSIC_EVENTS.TRACK_CHANGED, { track });
        } catch (error) {
            console.error('Failed to play track:', error);
        }
    }

    async playQueue(tracks: MusicTrack[], startIndex: number = 0): Promise<void> {
        this.#queue = tracks.map(track => ({
            track,
            queueId: generateQueueId()
        }));
        this.#originalQueue = [...this.#queue];
        this.#queueIndex = startIndex;

        if (this.#shuffleMode === 'on') {
            this.shuffleQueue();
        }

        if (this.#queue[this.#queueIndex]) {
            await this.playTrack(this.#queue[this.#queueIndex].track);
        }

        this.emitEvent(MUSIC_EVENTS.QUEUE_UPDATED);
    }

    async play(): Promise<void> {
        if (!this.#audio) {
            this.initialize();
        }

        if (!this.#audio!.src || this.#audio!.src === '' || this.#audio!.src === 'about:blank') {
            if (this.#currentTrack) {
                await this.playTrack(this.#currentTrack);
                return;
            }
            return;
        }

        try {
            await this.#audio!.play();
        } catch (error) {
            console.error('Failed to play:', error);
            if (this.#currentTrack) {
                await this.playTrack(this.#currentTrack);
            }
        }
    }

    pause(): void {
        this.#audio?.pause();
    }

    togglePlayPause(): void {
        if (this.#isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    async next(): Promise<void> {
        if (this.#queue.length === 0) return;

        let nextIndex = this.#queueIndex + 1;

        if (nextIndex >= this.#queue.length) {
            if (this.#repeatMode === 'all') {
                nextIndex = 0;
            } else {
                return;
            }
        }

        this.#queueIndex = nextIndex;
        await this.playTrack(this.#queue[nextIndex].track);
    }

    async previous(): Promise<void> {
        if (this.#queue.length === 0) return;

        if (this.#currentTime > 3) {
            this.seek(0);
            return;
        }

        let prevIndex = this.#queueIndex - 1;

        if (prevIndex < 0) {
            if (this.#repeatMode === 'all') {
                prevIndex = this.#queue.length - 1;
            } else {
                this.seek(0);
                return;
            }
        }

        this.#queueIndex = prevIndex;
        await this.playTrack(this.#queue[prevIndex].track);
    }

    seek(time: number): void {
        if (!this.#audio) return;
        this.#audio.currentTime = Math.max(0, Math.min(time, this.#duration));
    }

    seekPercent(percent: number): void {
        const time = (percent / 100) * this.#duration;
        this.seek(time);
    }

    setVolume(volume: number): void {
        this.#volume = Math.max(0, Math.min(1, volume));
        if (this.#audio) {
            this.#audio.volume = this.#volume;
        }
        this.#isMuted = this.#volume === 0;
        this.saveSettings();
        this.emitEvent(MUSIC_EVENTS.VOLUME_CHANGED, { volume: this.#volume });
    }

    toggleMute(): void {
        if (this.#isMuted) {
            this.#audio!.volume = this.#volume || DEFAULT_VOLUME;
            this.#isMuted = false;
        } else {
            this.#audio!.volume = 0;
            this.#isMuted = true;
        }
    }

    setRepeatMode(mode: RepeatMode): void {
        this.#repeatMode = mode;
        this.saveSettings();
    }

    cycleRepeatMode(): void {
        const modes: RepeatMode[] = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.#repeatMode);
        this.#repeatMode = modes[(currentIndex + 1) % modes.length];
        this.saveSettings();
    }

    toggleShuffle(): void {
        if (this.#shuffleMode === 'off') {
            this.#shuffleMode = 'on';
            this.shuffleQueue();
        } else {
            this.#shuffleMode = 'off';
            this.restoreOriginalQueue();
        }
        this.saveSettings();
    }

    private shuffleQueue(): void {
        if (this.#queue.length <= 1) return;

        const currentItem = this.#queue[this.#queueIndex];
        const otherItems = this.#queue.filter((_, i) => i !== this.#queueIndex);

        for (let i = otherItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [otherItems[i], otherItems[j]] = [otherItems[j], otherItems[i]];
        }

        this.#queue = [currentItem, ...otherItems];
        this.#queueIndex = 0;
        this.emitEvent(MUSIC_EVENTS.QUEUE_UPDATED);
    }

    private restoreOriginalQueue(): void {
        const currentTrackId = this.#currentTrack?.id;
        this.#queue = [...this.#originalQueue];
        this.#queueIndex = this.#queue.findIndex(item => item.track.id === currentTrackId);
        if (this.#queueIndex === -1) this.#queueIndex = 0;
        this.emitEvent(MUSIC_EVENTS.QUEUE_UPDATED);
    }

    addToQueue(track: MusicTrack): void {
        this.#queue.push({
            track,
            queueId: generateQueueId()
        });
        this.#originalQueue.push({
            track,
            queueId: generateQueueId()
        });
        this.emitEvent(MUSIC_EVENTS.QUEUE_UPDATED);
    }

    removeFromQueue(queueId: string): void {
        const index = this.#queue.findIndex(item => item.queueId === queueId);
        if (index === -1) return;

        if (index < this.#queueIndex) {
            this.#queueIndex--;
        } else if (index === this.#queueIndex) {
            this.next();
        }

        this.#queue = this.#queue.filter(item => item.queueId !== queueId);
        this.#originalQueue = this.#originalQueue.filter(item => item.queueId !== queueId);
        this.emitEvent(MUSIC_EVENTS.QUEUE_UPDATED);
    }

    clearQueue(): void {
        this.#queue = [];
        this.#originalQueue = [];
        this.#queueIndex = -1;
        this.emitEvent(MUSIC_EVENTS.QUEUE_UPDATED);
    }

    async playFromQueue(queueId: string): Promise<void> {
        const index = this.#queue.findIndex(item => item.queueId === queueId);
        if (index === -1) return;

        this.#queueIndex = index;
        await this.playTrack(this.#queue[index].track);
    }

    private async handleTrackEnd(): Promise<void> {
        await this.recordCurrentPlay();

        if (this.#repeatMode === 'one') {
            this.seek(0);
            this.play();
            return;
        }

        await this.next();
    }

    private async recordCurrentPlay(): Promise<void> {
        if (!this.#currentTrack || this.#hasRecordedPlay) return;

        const playDuration = (Date.now() - this.#playStartTime) / 1000;
        const completed = playDuration >= this.#duration * 0.9;

        if (playDuration > 30) {
            try {
                await MusicService.recordPlay(this.#currentTrack.id, playDuration, completed);
                this.#hasRecordedPlay = true;
            } catch (error) {
                console.error('Failed to record play:', error);
            }
        }
    }

    stop(): void {
        this.recordCurrentPlay();
        this.pause();
        this.#audio?.removeAttribute('src');
        this.#currentTrack = null;
        this.#currentTime = 0;
        this.#duration = 0;
        this.#buffered = 0;
        this.clearQueue();
    }

    getState(): PlayerState {
        return {
            currentTrack: this.#currentTrack,
            queue: this.#queue,
            queueIndex: this.#queueIndex,
            isPlaying: this.#isPlaying,
            isPaused: !this.#isPlaying && this.#currentTrack !== null,
            currentTime: this.#currentTime,
            duration: this.#duration,
            volume: this.#volume,
            isMuted: this.#isMuted,
            repeatMode: this.#repeatMode,
            shuffleMode: this.#shuffleMode
        };
    }

    getAudioElement(): HTMLAudioElement | null {
        return this.#audio;
    }

    cleanup(): void {
        this.recordCurrentPlay();
        if (this.#audio) {
            this.#audio.pause();
        }
    }

    fullCleanup(): void {
        this.recordCurrentPlay();
        if (this.#audio) {
            this.#audio.pause();
            this.#audio.src = '';
        }
        this.#currentTrack = null;
        this.#currentTime = 0;
        this.#duration = 0;
        this.#buffered = 0;
        this.clearQueue();
    }
}

export const MusicPlayerService = new MusicPlayerServiceImpl();

