import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { MediaItem } from './music-api.service';

const LIBRARY_KEY = 'ksong.library.v1';

function isMediaItem(value: unknown): value is MediaItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return item['kind'] === 'song'
    && typeof item['id'] === 'string'
    && typeof item['name'] === 'string'
    && typeof item['artistId'] === 'string'
    && typeof item['artistName'] === 'string'
    && typeof item['imageKey'] === 'string';
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly likedSongs = signal<MediaItem[]>(this.loadLikedSongs());

  isLiked(songId: string): boolean {
    return this.likedSongs().some((song) => song.id === songId);
  }

  toggleLike(song: MediaItem): void {
    if (!song.id || song.kind !== 'song' || !isPlatformBrowser(this.platformId)) {
      return;
    }

    const updated = this.isLiked(song.id)
      ? this.likedSongs().filter((item) => item.id !== song.id)
      : [song, ...this.likedSongs()];
    this.likedSongs.set(updated);
    this.persist(updated);
  }

  removeLikedSong(songId: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const updated = this.likedSongs().filter((song) => song.id !== songId);
    this.likedSongs.set(updated);
    this.persist(updated);
  }

  private persist(songs: MediaItem[]): void {
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(songs));
    } catch {
      // Keep this device's in-memory collection usable if browser storage is blocked or full.
    }
  }

  private loadLikedSongs(): MediaItem[] {
    if (!isPlatformBrowser(this.platformId)) {
      return [];
    }
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]');
      return Array.isArray(saved) ? saved.filter(isMediaItem) : [];
    } catch {
      return [];
    }
  }
}
