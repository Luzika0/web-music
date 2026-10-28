import { Injectable, signal } from '@angular/core';
import { MediaItem, MusicApiService } from './music-api.service';

@Injectable({ providedIn: 'root' })
export class PlaybackService {
  readonly currentSong = signal<MediaItem | null>(null);
  readonly manifestUrl = signal('');
  readonly token = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  private stopWatching: (() => void) | null = null;
  private requestGeneration = 0;

  constructor(private readonly api: MusicApiService) {}

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

  async play(song: MediaItem): Promise<void> {
    if (!song.id) {
      this.error.set('This track does not include a song ID, so it cannot be played.');
      return;
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

  setError(message: string): void {
    this.error.set(message);
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
  }
}
