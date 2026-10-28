import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MediaItem, MusicApiService } from './music-api.service';

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  readonly currentSong = signal<MediaItem | null>(null);
  readonly queue = signal<MediaItem[]>([]);
  readonly queueIndex = signal(-1);
  readonly manifestUrl = signal('');
  readonly token = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly isPlaying = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  private stopWatching: (() => void) | null = null;
  private requestGeneration = 0;
  private audioElement: HTMLAudioElement | null = null;

  constructor(
    private readonly api: MusicApiService,
    private readonly router: Router,
  ) {}

  coverColor(): string {
    const palette = [
      'linear-gradient(145deg, #f8b195, #b83b5e)',
      'linear-gradient(145deg, #6c5b7b, #355c7d)',
      'linear-gradient(145deg, #99b898, #2a5b84)',
      'linear-gradient(145deg, #f6d365, #fda085)',
      'linear-gradient(145deg, #a18cd1, #fbc2eb)',
    ];
    const id = this.currentSong()?.id ?? '';
    const index = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
    return palette[index % palette.length];
  }

  async play(song: MediaItem, playlist?: readonly MediaItem[]): Promise<void> {
    if (!song.id) {
      this.error.set('This track does not include a song ID, so it cannot be played.');
      return;
    }
    if (playlist) {
      const playableSongs = playlist.filter((item) => !!item.id);
      const selectedIndex = playableSongs.findIndex((item) => item.id === song.id);
      if (selectedIndex >= 0) {
        this.queue.set([...playableSongs]);
        this.queueIndex.set(selectedIndex);
      } else {
        this.queue.set([...playableSongs, song]);
        this.queueIndex.set(playableSongs.length);
      }
    } else {
      const existingIndex = this.queue().findIndex((item) => item.id === song.id);
      if (existingIndex >= 0) {
        this.queueIndex.set(existingIndex);
      } else {
        this.queue.set([song]);
        this.queueIndex.set(0);
      }
    }
    this.requestGeneration += 1;
    const generation = this.requestGeneration;
    this.stopWatching?.();
    this.stopWatching = null;
    this.currentSong.set(song);
    this.error.set('');
    this.loading.set(true);
    this.manifestUrl.set('');
    this.token.set('');
    this.isPlaying.set(false);
    this.currentTime.set(0);
    this.duration.set(0);
    void this.router.navigate(['/now-playing']);
    try {
      const session = await this.api.playbackSession(song.id);
      if (generation !== this.requestGeneration) {
        return;
      }
      const active = await this.api.playbackStatus(song.id, session.token);
      if (generation !== this.requestGeneration) {
        return;
      }
      if (!active) {
        throw new Error('This playback session is no longer active. Start the track again to get a new session.');
      }
      this.token.set(session.token);
      this.stopWatching = this.api.watchPlaybackEvents(
        song.id,
        session.token,
        () => {
          if (generation === this.requestGeneration) {
            this.stop();
            this.error.set('Playback was stopped because this account started listening on another device.');
          }
        },
        (message) => {
          if (generation === this.requestGeneration) {
            this.error.set(`Playback session monitoring failed: ${message}`);
          }
        },
      );
      this.manifestUrl.set(this.api.absoluteUrl(`/api/auth/song/${encodeURIComponent(song.id)}/hls/index.m3u8`));
    } catch (error) {
      this.error.set(this.api.toUserMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  playNext(): void {
    const nextIndex = this.queueIndex() + 1;
    const nextSong = this.queue()[nextIndex];
    if (nextSong) {
      void this.play(nextSong, this.queue());
    }
  }

  playPrevious(): void {
    if (this.currentTime() > 3) {
      this.seekTo(0);
      return;
    }
    const previousSong = this.queue()[this.queueIndex() - 1];
    if (previousSong) {
      void this.play(previousSong, this.queue());
    }
  }

  setError(message: string): void {
    this.error.set(message);
  }

  bindAudioElement(audio: HTMLAudioElement): void {
    this.audioElement = audio;
  }

  updateProgress(currentTime: number, duration: number): void {
    this.currentTime.set(Number.isFinite(currentTime) ? currentTime : 0);
    this.duration.set(Number.isFinite(duration) ? duration : 0);
  }

  setPlaying(isPlaying: boolean): void {
    this.isPlaying.set(isPlaying);
  }

  togglePlayback(): void {
    if (!this.audioElement || !this.currentSong()) {
      return;
    }

    if (this.audioElement.paused) {
      void this.audioElement.play().catch(() => {
        this.setError('Playback could not start. Use the player controls below or try again.');
      });
    } else {
      this.audioElement.pause();
    }
  }

  seekTo(time: number): void {
    if (!this.audioElement || !Number.isFinite(time)) {
      return;
    }
    this.audioElement.currentTime = Math.max(0, Math.min(time, this.audioElement.duration || 0));
    this.updateProgress(this.audioElement.currentTime, this.audioElement.duration);
  }

  stop(): void {
    this.requestGeneration += 1;
    this.stopWatching?.();
    this.stopWatching = null;
    this.currentSong.set(null);
    this.manifestUrl.set('');
    this.token.set('');
    this.loading.set(false);
    this.error.set('');
    this.isPlaying.set(false);
    this.updateProgress(0, 0);
  }
}
