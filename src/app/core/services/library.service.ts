import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { MediaItem, MusicApiService, PlaylistItem } from './music-api.service';

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(MusicApiService);

  readonly likedSongs = signal<MediaItem[]>([]);
  readonly playlists = signal<PlaylistItem[]>([]);
  readonly songOptions = signal<MediaItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const user = this.api.user();
      if (!isPlatformBrowser(this.platformId)) return;
      if (!user) {
        this.likedSongs.set([]);
        this.playlists.set([]);
        this.songOptions.set([]);
        return;
      }
      void this.reload();
    });
  }

  async reload(): Promise<void> {
    if (!this.api.user()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const [favorites, playlists] = await Promise.all([
        this.api.favoriteSongs(),
        this.api.playlists(),
      ]);
      this.likedSongs.set(favorites);
      this.playlists.set(playlists);
      try {
        this.songOptions.set((await this.api.songs(0, 100)).items);
      } catch {
        this.songOptions.set([]);
      }
    } catch (error) {
      this.error.set(this.api.toUserMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  isLiked(songId: string): boolean {
    return this.likedSongs().some((song) => song.id === songId);
  }

  toggleLike(song: MediaItem): void {
    if (!song.id || song.kind !== 'song' || !this.api.user()) return;
    const wasLiked = this.isLiked(song.id);
    const previous = this.likedSongs();
    this.likedSongs.set(wasLiked
      ? previous.filter((item) => item.id !== song.id)
      : [song, ...previous]);
    const request = wasLiked
      ? this.api.removeFavorite(song.id)
      : this.api.addFavorite(song.id);
    void request.catch((error: unknown) => {
      this.likedSongs.set(previous);
      this.error.set(this.api.toUserMessage(error));
    });
  }

  removeLikedSong(songId: string): void {
    const previous = this.likedSongs();
    this.likedSongs.set(previous.filter((song) => song.id !== songId));
    void this.api.removeFavorite(songId).catch((error: unknown) => {
      this.likedSongs.set(previous);
      this.error.set(this.api.toUserMessage(error));
    });
  }

  async createPlaylist(name: string, description = ''): Promise<void> {
    const playlist = await this.api.createPlaylist({ name, description });
    this.playlists.update((items) => [playlist, ...items]);
  }

  async deletePlaylist(id: string): Promise<void> {
    await this.api.deletePlaylist(id);
    this.playlists.update((items) => items.filter((item) => item.id !== id));
  }

  async addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
    await this.api.addSongToPlaylist(playlistId, songId);
    await this.reload();
  }

  async removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
    await this.api.removeSongFromPlaylist(playlistId, songId);
    await this.reload();
  }
}
