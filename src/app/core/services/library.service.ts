import { Injectable, effect, inject, signal } from '@angular/core';
import { MediaItem, MusicApiService } from './music-api.service';

export interface PlaylistTrack {
  songId: string;
  artistId: string;
  songName: string;
  artistName: string;
  songImage: string;
  songType: string;
  position: number;
}

export interface UserPlaylist {
  playlistId: number;
  name: string;
  description: string;
  coverImage: string | null;
  createdAt: string | null;
  songIds: string[];
  songs: PlaylistTrack[];
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function unwrapData(value: unknown): unknown {
  const outer = record(value);
  return Object.prototype.hasOwnProperty.call(outer, 'data') ? outer['data'] : value;
}

function playlistFrom(value: unknown): UserPlaylist | null {
  const item = record(value);
  const playlistId = Number(item['playlistId']);
  if (!Number.isSafeInteger(playlistId) || playlistId <= 0 || typeof item['name'] !== 'string') return null;
  const songIds = Array.isArray(item['songIds']) ? item['songIds'].map(String) : [];
  const songs: PlaylistTrack[] = Array.isArray(item['songs']) ? item['songs'].flatMap(value => {
    const track = record(value);
    const songId = typeof track['songId'] === 'string' ? track['songId'] : '';
    const songName = typeof track['songName'] === 'string' ? track['songName'] : '';
    if (!songId || !songName) return [];
    return [{
      songId,
      artistId: String(track['artistId'] ?? ''),
      songName,
      artistName: typeof track['artistName'] === 'string' ? track['artistName'] : '',
      songImage: typeof track['songImage'] === 'string' ? track['songImage'] : '',
      songType: typeof track['songType'] === 'string' ? track['songType'] : '',
      position: Number.isFinite(Number(track['position'])) ? Number(track['position']) : 0,
    }];
  }) : [];
  return {
    playlistId,
    name: item['name'],
    description: typeof item['description'] === 'string' ? item['description'] : '',
    coverImage: typeof item['coverImage'] === 'string' ? item['coverImage'] : null,
    createdAt: typeof item['createdAt'] === 'string' ? item['createdAt'] : null,
    songIds,
  };
}

@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly api = inject(MusicApiService);
  readonly likedSongs = signal<MediaItem[]>([]);
  readonly playlists = signal<UserPlaylist[]>([]);
  readonly loadingFavorites = signal(false);
  readonly loadingPlaylists = signal(false);
  readonly error = signal('');

  isLiked(songId: string): boolean {
    return !!songId && this.likedSongs().some(song => song.id === songId);
  }

  async loadFavorites(): Promise<void> {
    if (!this.api.user()) { this.likedSongs.set([]); return; }
    this.loadingFavorites.set(true);
    this.error.set('');
    try {
      this.likedSongs.set(await this.api.libraryFavorites());
    } catch (error) {
      this.error.set(this.api.toUserMessage(error));
      throw error;
    } finally {
      this.loadingFavorites.set(false);
    }
  }

  async toggleLike(song: MediaItem): Promise<void> {
    if (!song.id || song.kind !== 'song') return;
    const wasLiked = this.isLiked(song.id);
    // Do not update optimistically: server state is authoritative across devices.
    if (wasLiked) await this.api.removeLibraryFavorite(song.id);
    else await this.api.addLibraryFavorite(song.id);
    await this.loadFavorites();
  }

  async removeLikedSong(songId: string): Promise<void> {
    await this.api.removeLibraryFavorite(songId);
    this.likedSongs.update(items => items.filter(song => song.id !== songId));
  }

  async loadPlaylists(): Promise<void> {
    if (!this.api.user()) { this.playlists.set([]); return; }
    this.loadingPlaylists.set(true);
    this.error.set('');
    try {
      const data = unwrapData(await this.api.libraryPlaylists());
      this.playlists.set(Array.isArray(data) ? data.map(playlistFrom).filter((item): item is UserPlaylist => item !== null) : []);
    } catch (error) {
      this.error.set(this.api.toUserMessage(error));
      throw error;
    } finally {
      this.loadingPlaylists.set(false);
    }
  }

  async createPlaylist(name: string, description: string): Promise<UserPlaylist> {
    const data = unwrapData(await this.api.createLibraryPlaylist({ name: name.trim(), description: description.trim() }));
    const created = playlistFrom(data);
    if (!created) throw new Error('The server returned an invalid playlist.');
    this.playlists.update(items => [created, ...items.filter(item => item.playlistId !== created.playlistId)]);
    return created;
  }

  async getPlaylist(playlistId: number): Promise<UserPlaylist> {
    const playlist = playlistFrom(unwrapData(await this.api.getLibraryPlaylist(playlistId)));
    if (!playlist) throw new Error('The server returned an invalid playlist.');
    return playlist;
  }

  async updatePlaylist(playlistId: number, name: string, description: string): Promise<void> {
    const updated = playlistFrom(unwrapData(await this.api.updateLibraryPlaylist(playlistId, { name: name.trim(), description: description.trim() })));
    if (updated) this.playlists.update(items => items.map(item => item.playlistId === playlistId ? updated : item));
    else await this.loadPlaylists();
  }

  async deletePlaylist(playlistId: number): Promise<void> {
    await this.api.deleteLibraryPlaylist(playlistId);
    this.playlists.update(items => items.filter(item => item.playlistId !== playlistId));
  }

  async addSong(playlistId: number, songId: string): Promise<UserPlaylist> {
    const data = unwrapData(await this.api.addSongToLibraryPlaylist(playlistId, songId));
    const playlist = playlistFrom(data);
    if (playlist) this.playlists.update(items => items.map(item => item.playlistId === playlistId ? playlist : item));
    return playlist ?? this.getPlaylist(playlistId);
  }

  async removeSong(playlistId: number, songId: string): Promise<UserPlaylist> {
    const data = unwrapData(await this.api.removeSongFromLibraryPlaylist(playlistId, songId));
    const playlist = playlistFrom(data);
    if (playlist) this.playlists.update(items => items.map(item => item.playlistId === playlistId ? playlist : item));
    return playlist ?? this.getPlaylist(playlistId);
  }

  async reorderSongs(playlistId: number, songIds: string[]): Promise<UserPlaylist> {
    const data = unwrapData(await this.api.reorderLibraryPlaylist(playlistId, songIds));
    const playlist = playlistFrom(data);
    if (playlist) this.playlists.update(items => items.map(item => item.playlistId === playlistId ? playlist : item));
    return playlist ?? this.getPlaylist(playlistId);
  }
}
