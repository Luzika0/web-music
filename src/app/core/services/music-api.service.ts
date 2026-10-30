import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { getAppConfig } from '../config/app-config';
import { AdminPermissionAdapter } from '../auth/admin-permission.adapter';
import { IMAGE_CACHE_FRESH_MS, PAGE_CACHE_FRESH_MS, MediaCacheService } from './media-cache.service';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  permissions: string[];
}

export interface MediaItem {
  id: string;
  artistId: string;
  name: string;
  artistName: string;
  imageKey: string;
  kind: 'song' | 'artist';
  albumId?: string;
  albumName?: string;
  albumImageKey?: string;
}

export interface MediaPage {
  items: MediaItem[];
  page: number;
  totalPages: number | null;
}

export interface PlaybackSession {
  token: string;
  sessionId: string;
  expiresAt: string;
  songId: string;
}

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions {
  params?: HttpParams;
  body?: unknown;
  headers?: HttpHeaders;
  authenticated?: boolean;
  playbackToken?: string;
  retryUnauthorized?: boolean;
}

const SESSION_KEY = 'ksong.session.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pathValue(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function firstString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value);
    }
  }
  return '';
}

function mediaRows(response: unknown): unknown[] {
  const candidates = [
    pathValue(response, 'data'),
    pathValue(response, 'data', 'content'),
    pathValue(response, 'data', 'items'),
    pathValue(response, 'data', 'songs'),
    pathValue(response, 'data', 'artists'),
    pathValue(response, 'content'),
    pathValue(response, 'items'),
    pathValue(response, 'songs'),
    pathValue(response, 'artists'),
  ];
  return candidates.find(Array.isArray) as unknown[] | undefined ?? [];
}

function totalPages(response: unknown): number | null {
  const candidates = [
    pathValue(response, 'data', 'totalPages'),
    pathValue(response, 'data', 'totalPage'),
    pathValue(response, 'data', 'page', 'totalPages'),
    pathValue(response, 'totalPages'),
    pathValue(response, 'totalPage'),
    pathValue(response, 'page', 'totalPages'),
  ];
  const value = candidates.find((candidate) => typeof candidate === 'number');
  return typeof value === 'number' && value >= 0 ? value : null;
}

function normalizeMedia(response: unknown, kind: MediaItem['kind'], page: number): MediaPage {
  const items = mediaRows(response).flatMap((value): MediaItem[] => {
    if (!isRecord(value)) {
      return [];
    }
    // Artist IDs must never be used as song IDs: playback authorization needs the real song ID.
    const id = firstString(value, kind === 'song'
      ? ['songId', 'songID', 'id', '_id']
      : ['artistId', 'artistID', 'id', '_id']);
    const artistId = firstString(value, ['artistId', 'artistID']);
    const name = firstString(value, kind === 'song'
      ? ['songName', 'name', 'title']
      : ['artistName', 'name', 'title']);
    const artistName = firstString(value, ['artistName', 'artist', 'albumName']);
    const imageKey = firstString(value, [
      'r2Imagekey', 'r2ImageKey', 'imageKey', 'image', 'songImage', 'artistImage', 'albumImage', 'albumIamge',
    ]);
    const albumId = firstString(value, ['albumId', 'albumID']) || firstString(
      isRecord(value['album']) ? value['album'] : {},
      ['albumId', 'albumID', 'id', '_id'],
    );
    const albumName = firstString(value, ['albumName']) || firstString(
      isRecord(value['album']) ? value['album'] : {},
      ['albumName', 'name', 'title'],
    );
    const albumImageKey = firstString(value, ['albumImage', 'albumIamge', 'albumImageKey'])
      || firstString(isRecord(value['album']) ? value['album'] : {}, ['imageKey', 'r2Imagekey', 'r2ImageKey']);
    return [{
      id,
      artistId,
      name: name || (kind === 'song' ? 'Untitled track' : 'Unknown artist'),
      artistName,
      imageKey,
      kind,
      ...(albumId ? { albumId } : {}),
      ...(albumName ? { albumName } : {}),
      ...(albumImageKey ? { albumImageKey } : {}),
    }];
  });
  return { items, page, totalPages: totalPages(response) };
}

@Injectable({ providedIn: 'root' })
export class MusicApiService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mediaCache = inject(MediaCacheService);
  private readonly config = getAppConfig();
  private refreshFlight: Promise<string> | null = null;
  private refreshFlightKey: string | null = null;
  private sessionGeneration = 0;
  private session: SessionUser | null = this.loadSession();

  readonly user = signal<SessionUser | null>(this.session);
  readonly notice = signal('');

  isAdmin(): boolean {
    return this.session?.permissions.includes('admin:manage') ?? false;
  }

  absoluteUrl(path: string): string {
    return `${this.config.apiBaseUrl}${path}`;
  }

  async register(payload: { name: string; userName: string; email: string; password: string; dob: string }): Promise<void> {
    await this.request('POST', '/api/auth/register', { body: payload });
  }

  async verifyOtp(email: string, otp: string): Promise<void> {
    await this.request('POST', '/api/auth/otp-verify', { body: { email, otp } });
  }

  async login(emailOrUserName: string, password: string): Promise<void> {
    const response = await this.request<unknown>('POST', '/api/auth/log-in', {
      body: { emailOrUserName, password },
    });
    const token = pathValue(response, 'data', 'token');
    const accessToken = pathValue(token, 'acessToken');
    const userId = pathValue(token, 'userId');
    const refreshToken = pathValue(token, 'refreshToken');
    if (typeof accessToken !== 'string'
      || (typeof userId !== 'string' && typeof userId !== 'number')
      || typeof refreshToken !== 'string') {
      throw new Error('The login response is missing data.token.acessToken, data.token.userId, or data.token.refreshToken.');
    }

    const previousUserId = this.session?.id;
    if (previousUserId && previousUserId !== String(userId)) {
      void this.mediaCache.clearUser(previousUserId).catch(() => this.mediaCache.reportUnavailable());
    }
    this.sessionGeneration += 1;
    this.session = {
      id: String(userId),
      name: emailOrUserName,
      email: emailOrUserName,
      accessToken,
      refreshToken,
      permissions: AdminPermissionAdapter.permissionsFromLogin(response),
    };
    this.persistSession();
    this.user.set(this.session);
    this.notice.set('');
  }

  async requestPasswordReset(email: string): Promise<void> {
    const params = new HttpParams().set('email', email);
    await this.request('POST', '/api/auth/forget-password', { params });
  }

  async resetPassword(email: string, otpCode: string, password: string): Promise<void> {
    await this.request('POST', '/api/auth/reset-password', { body: { email, otpCode, password } });
  }

  async logout(): Promise<void> {
    try {
      if (this.session) {
        await this.request('POST', '/api/auth/log-out', { authenticated: true, retryUnauthorized: false });
      }
    } finally {
      this.clearSession();
    }
  }

  async initializeSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    let storedSession: string | null;
    try {
      storedSession = sessionStorage.getItem(SESSION_KEY);
    } catch {
      storedSession = null;
    }

    if (!this.session) {
      if (storedSession !== null) {
        this.expireSession();
      }
      return;
    }

    // Rotate refresh credentials only when the access token is close to expiry.
    // Opaque access tokens are validated by the API and refreshed after a 401.
    try {
      await this.refreshIfExpiring();
    } catch {
      // A temporary network/CORS/server failure must not erase the saved session.
    }
  }

  async ensureSessionReady(): Promise<boolean> {
    if (!this.session) return false;
    try {
      await this.refreshIfExpiring();
    } catch {
      // Keep the route/session during transient outages; protected APIs remain authoritative.
    }
    return this.session !== null;
  }

  async songs(page: number, size: number, searchText = ''): Promise<MediaPage> {
    const cacheUser = this.session?.id ?? 'anonymous';
    const cacheKey = `songs:${page}:${size}:${searchText.trim()}`;
    const cached = await this.readCachedPageEntry<MediaPage>(cacheUser, cacheKey);
    if (cached && Date.now() - cached.cachedAt < PAGE_CACHE_FRESH_MS) return cached.value;
    try {
      const response = await this.request<unknown>('GET', '/api/auth/media/list-song', {
        // Music Service's controller requires searchText even though the client collection omits it.
        params: new HttpParams().set('page', page).set('size', size).set('searchText', searchText.trim()),
      });
      const result = normalizeMedia(response, 'song', page);
      await this.cachePage(cacheUser, cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 0 && cached) return cached.value;
      throw error;
    }
  }

  async artists(page: number, size: number, searchText: string): Promise<MediaPage> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (searchText.trim()) {
      params = params.set('searchText', searchText.trim());
    }
    const cacheKey = `artists:${page}:${size}:${searchText.trim()}`;
    const cached = await this.readCachedPageEntry<MediaPage>('public', cacheKey);
    if (cached && Date.now() - cached.cachedAt < PAGE_CACHE_FRESH_MS) return cached.value;
    try {
      const response = await this.request<unknown>('GET', '/api/auth/media/artist', { params });
      const result = normalizeMedia(response, 'artist', page);
      await this.cachePage('public', cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 0 && cached) return cached.value;
      throw error;
    }
  }

  async createArtist(form: FormData): Promise<void> {
    await this.request('POST', '/api/auth/admin/create-artist', { body: form, authenticated: true });
    await this.invalidateCatalogCache();
  }

  async uploadSong(form: FormData): Promise<void> {
    await this.request('POST', '/api/auth/admin/upload-song', { body: form, authenticated: true });
    await this.invalidateCatalogCache();
  }

  async deleteSong(songId: string): Promise<void> {
    await this.request('DELETE', `/api/auth/admin/delete-song/${encodeURIComponent(songId)}`, { authenticated: true });
    await this.invalidateCatalogCache();
  }

  private async invalidateCatalogCache(): Promise<void> {
    try {
      await this.mediaCache.invalidateCatalog();
    } catch {
      this.mediaCache.reportUnavailable();
    }
  }


  async libraryFavorites(): Promise<MediaItem[]> {
    const userId = this.session?.id;
    if (!userId) throw new Error('Sign in to view your liked songs.');
    const key = 'library:favorites';
    const cached = await this.readCachedPageEntry<MediaItem[]>(userId, key);
    if (cached && Date.now() - cached.cachedAt < 2 * 60 * 1000) return cached.value;
    try {
      const response = await this.request<unknown>('GET', '/api/auth/library/favorites', { authenticated: true });
      const items = normalizeMedia(response, 'song', 0).items;
      await this.cachePage(userId, key, items);
      return items;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 0 && cached) return cached.value;
      throw error;
    }
  }

  async addLibraryFavorite(songId: string): Promise<void> {
    await this.request('POST', `/api/auth/library/favorites/${encodeURIComponent(songId)}`, { authenticated: true });
    await this.invalidateLibraryPage('library:favorites');
  }

  async removeLibraryFavorite(songId: string): Promise<void> {
    await this.request('DELETE', `/api/auth/library/favorites/${encodeURIComponent(songId)}`, { authenticated: true });
    await this.invalidateLibraryPage('library:favorites');
  }

  async libraryPlaylists(): Promise<unknown> {
    const userId = this.session?.id;
    if (!userId) throw new Error('Sign in to view your playlists.');
    const key = 'library:playlists';
    const cached = await this.readCachedPageEntry<unknown>(userId, key);
    if (cached && Date.now() - cached.cachedAt < 2 * 60 * 1000) return cached.value;
    try {
      const response = await this.request<unknown>('GET', '/api/auth/library/playlists', { authenticated: true });
      await this.cachePage(userId, key, response);
      return response;
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 0 && cached) return cached.value;
      throw error;
    }
  }

  private async invalidateLibraryPage(key: string): Promise<void> {
    if (!this.session) return;
    try {
      await this.mediaCache.deletePage(this.session.id, key);
    } catch {
      this.mediaCache.reportUnavailable();
    }
  }

  async createLibraryPlaylist(payload: { name: string; description: string }): Promise<unknown> {
    const result = await this.request<unknown>('POST', '/api/auth/library/playlists', { body: payload, authenticated: true });
    await this.invalidateLibraryPage('library:playlists');
    return result;
  }

  async getLibraryPlaylist(playlistId: number): Promise<unknown> {
    return this.request<unknown>('GET', `/api/auth/library/playlists/${playlistId}`, { authenticated: true });
  }

  async updateLibraryPlaylist(playlistId: number, payload: { name: string; description: string }): Promise<unknown> {
    const result = await this.request<unknown>('PUT', `/api/auth/library/playlists/${playlistId}`, { body: payload, authenticated: true });
    await this.invalidateLibraryPage('library:playlists');
    return result;
  }

  async deleteLibraryPlaylist(playlistId: number): Promise<void> {
    await this.request('DELETE', `/api/auth/library/playlists/${playlistId}`, { authenticated: true });
    await this.invalidateLibraryPage('library:playlists');
  }

  async addSongToLibraryPlaylist(playlistId: number, songId: string): Promise<unknown> {
    const result = await this.request<unknown>('POST', `/api/auth/library/playlists/${playlistId}/songs/${encodeURIComponent(songId)}`, { authenticated: true });
    await this.invalidateLibraryPage('library:playlists');
    return result;
  }

  async removeSongFromLibraryPlaylist(playlistId: number, songId: string): Promise<unknown> {
    const result = await this.request<unknown>('DELETE', `/api/auth/library/playlists/${playlistId}/songs/${encodeURIComponent(songId)}`, { authenticated: true });
    await this.invalidateLibraryPage('library:playlists');
    return result;
  }

  async reorderLibraryPlaylist(playlistId: number, songIds: string[]): Promise<unknown> {
    const result = await this.request<unknown>('PUT', `/api/auth/library/playlists/${playlistId}/songs`, { body: songIds, authenticated: true });
    await this.invalidateLibraryPage('library:playlists');
    return result;
  }

  async playbackSession(songId: string): Promise<PlaybackSession> {
    const response = await this.request<unknown>('POST', `/api/auth/song/${encodeURIComponent(songId)}/playback-token`, {
      authenticated: true,
    });
    const data = pathValue(response, 'data');
    const token = pathValue(data, 'token');
    const sessionId = pathValue(data, 'sessionId');
    const expiresAt = pathValue(data, 'expiresAt');
    const responseSongId = pathValue(data, 'songId');
    if (typeof token !== 'string' || typeof sessionId !== 'string'
      || typeof expiresAt !== 'string' || typeof responseSongId !== 'string') {
      throw new Error('The playback-session response must include data.token, sessionId, expiresAt, and songId.');
    }
    return { token, sessionId, expiresAt, songId: responseSongId };
  }

  async playbackStatus(songId: string, playbackToken: string): Promise<boolean> {
    const response = await this.request<unknown>('GET', `/api/auth/song/${encodeURIComponent(songId)}/playback-status`, {
      authenticated: true,
      playbackToken,
    });
    const active = pathValue(response, 'active') ?? pathValue(response, 'data', 'active');
    if (typeof active !== 'boolean') {
      throw new Error('The playback-status response must include an active boolean.');
    }
    return active;
  }

  watchPlaybackEvents(
    songId: string,
    playbackToken: string,
    onTakeover: () => void,
    onError: (message: string) => void,
  ): () => void {
    const controller = new AbortController();
    void this.consumePlaybackEvents(songId, playbackToken, controller, onTakeover)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          onError(this.errorMessage(error));
        }
      });
    return () => controller.abort();
  }

  async imageBlob(imageKey: string): Promise<Blob> {
    if (!this.session) {
      throw new Error('Sign in to view artist and song artwork.');
    }
    const userId = this.session.id;
    const cached = await this.readCachedImageEntry(userId, imageKey);
    if (cached && Date.now() - cached.cachedAt < IMAGE_CACHE_FRESH_MS) return cached.value;
    const path = `/api/auth/media/image?r2Imagekey=${encodeURIComponent(imageKey)}`;
    await this.refreshIfExpiring();
    const accessTokenUsed = this.session?.accessToken;
    try {
      const image = await firstValueFrom(this.http.get(this.absoluteUrl(path), {
        headers: this.requestHeaders({}, true),
        responseType: 'blob',
      }));
      await this.cacheImage(userId, imageKey, image);
      return image;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 0) {
        if (cached) return cached.value;
      }
      if (error instanceof HttpErrorResponse && error.status === 401) {
        if (!this.session?.accessToken || this.session.accessToken === accessTokenUsed) {
          await this.refreshAccessToken();
        }
        try {
          const image = await firstValueFrom(this.http.get(this.absoluteUrl(path), {
            headers: this.requestHeaders({}, true),
            responseType: 'blob',
          }));
          await this.cacheImage(userId, imageKey, image);
          return image;
        } catch (retryError) {
          if (retryError instanceof HttpErrorResponse && retryError.status === 0) {
            if (cached) return cached.value;
          }
          throw this.readableError(retryError);
        }
      }
      throw this.readableError(error);
    }
  }

  playbackHeaders(playbackToken: string): Record<string, string> {
    const headers: Record<string, string> = { 'playBack-token': playbackToken };
    if (this.session) {
      headers['Authorization'] = `Bearer ${this.session.accessToken}`;
      headers['X-User-Id'] = this.session.id;
    }
    return headers;
  }

  toUserMessage(error: unknown): string {
    return this.errorMessage(error);
  }

  private async request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const authenticated = options.authenticated ?? this.isProtectedPath(path);
    if (authenticated && options.retryUnauthorized !== false) {
      await this.refreshIfExpiring();
    }
    const accessTokenUsed = authenticated ? this.session?.accessToken : null;
    const headers = this.requestHeaders(options, authenticated);
    try {
      return await firstValueFrom(this.http.request<T>(method, this.absoluteUrl(path), {
        body: options.body,
        headers,
        params: options.params,
      }));
    } catch (error) {
      if (authenticated && options.retryUnauthorized !== false && error instanceof HttpErrorResponse && error.status === 401) {
        if (!this.session?.accessToken || this.session.accessToken === accessTokenUsed) {
          await this.refreshAccessToken();
        }
        return this.request<T>(method, path, { ...options, retryUnauthorized: false });
      }
      throw this.readableError(error);
    }
  }

  private requestHeaders(options: RequestOptions, authenticated: boolean): HttpHeaders {
    let headers = options.headers ?? new HttpHeaders();
    if (authenticated && this.session) {
      headers = headers.set('Authorization', `Bearer ${this.session.accessToken}`);
      headers = headers.set('X-User-Id', this.session.id);
    }
    if (options.playbackToken) {
      headers = headers.set('playBack-token', options.playbackToken);
    }
    return headers;
  }

  private isProtectedPath(path: string): boolean {
    // Artist discovery is public, but the song catalogue is protected by the Music Service.
    // Keep the auth decision centralized so requests include the bearer and user headers.
    return path.includes('/admin/')
      || path.includes('/song/')
      || path.includes('/media/list-song')
      || path.includes('/media/image')
      || path.includes('/library/');
  }

  async refreshPlaybackAuthorization(): Promise<void> {
    if (!this.session?.refreshToken) {
      this.expireSession();
      throw new Error('Your session has expired. Please sign in again.');
    }
    await this.refreshAccessToken();
  }

  private async refreshIfExpiring(requireVerifiableToken = false): Promise<void> {
    if (!this.session) {
      return;
    }
    const expiration = this.expirySeconds(this.session.accessToken);
    if ((expiration === null && requireVerifiableToken)
      || (expiration !== null && expiration * 1000 <= Date.now() + this.config.refreshBufferSeconds * 1000)) {
      await this.refreshAccessToken();
    }
  }

  private async refreshAccessToken(): Promise<string> {
    const currentSession = this.session;
    if (!currentSession?.refreshToken) {
      this.expireSession();
      throw new Error('Your session has expired. Please sign in again.');
    }
    const generation = this.sessionGeneration;
    const flightKey = `${generation}:${currentSession.id}:${currentSession.refreshToken}`;
    if (!this.refreshFlight || this.refreshFlightKey !== flightKey) {
      this.refreshFlightKey = flightKey;
      this.refreshFlight = this.performRefresh(currentSession, generation).finally(() => {
        if (this.refreshFlightKey === flightKey) {
          this.refreshFlight = null;
          this.refreshFlightKey = null;
        }
      });
    }
    return this.refreshFlight;
  }

  private async performRefresh(currentSession: SessionUser, generation: number): Promise<string> {
    try {
      const params = new HttpParams().set('refreshToken', currentSession.refreshToken);
      const response = await firstValueFrom(this.http.post<unknown>(
        this.absoluteUrl('/api/auth/refresh-token'),
        null,
        { params },
      ));
      // The current Spring Auth Service returns "newAccessToken".
      // Accept the historic misspelling too for compatibility with older deployments.
      const accessToken = pathValue(response, 'data', 'newAccessToken')
        ?? pathValue(response, 'data', 'newAcessToken');
      if (typeof accessToken !== 'string' || !accessToken) {
        throw new Error('The refresh response is missing data.newAccessToken.');
      }

      if (this.sessionGeneration !== generation
        || this.session?.id !== currentSession.id
        || this.session?.refreshToken !== currentSession.refreshToken) {
        throw new Error('The signed-in account changed during token refresh. Retry the request.');
      }
      this.session = { ...this.session, accessToken };
      this.persistSession();
      this.user.set(this.session);
      return accessToken;
    } catch (error) {
      // Only explicit 401/403 responses prove the refresh credential is rejected.
      // Network errors, CORS failures and 5xx responses are temporary.
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)
        && this.sessionGeneration === generation
        && this.session?.id === currentSession.id
        && this.session?.refreshToken === currentSession.refreshToken) {
        this.expireSession();
      }
      throw new Error(`Your session could not be refreshed. ${this.errorMessage(error)}`);
    }
  }

  private async consumePlaybackEvents(
    songId: string,
    playbackToken: string,
    controller: AbortController,
    onTakeover: () => void,
  ): Promise<void> {
    await this.refreshIfExpiring();
    const accessTokenUsed = this.session?.accessToken;
    const url = this.absoluteUrl(`/api/auth/song/${encodeURIComponent(songId)}/playback-events`);
    const request = (): Promise<Response> => fetch(url, {
      headers: {
        ...this.playbackHeaders(playbackToken),
        Accept: 'text/event-stream',
      },
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
    let response = await request();
    if (response.status === 401) {
      if (!this.session?.accessToken || this.session.accessToken === accessTokenUsed) {
        await this.refreshAccessToken();
      }
      response = await request();
    }
    if (!response.ok || !response.body) {
      throw new Error(`Playback event stream failed (${response.status}).`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (!controller.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) {
          return;
        }
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const eventName = frame.match(/^event:\s*(.+)$/m)?.[1];
          if (eventName === 'playback_taken_over') {
            onTakeover();
            controller.abort();
            return;
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private expirySeconds(token: string): number | null {
    try {
      const segment = token.split('.')[1];
      if (!segment || typeof atob === 'undefined') {
        return null;
      }
      const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
      const decoded = JSON.parse(atob(paddedBase64)) as { exp?: unknown };
      return typeof decoded.exp === 'number' ? decoded.exp : null;
    } catch {
      return null;
    }
  }

  private readableError(error: unknown): Error {
    return new ApiRequestError(
      this.errorMessage(error),
      error instanceof HttpErrorResponse ? error.status : null,
    );
  }

  private async readCachedPageEntry<T>(userId: string, key: string): Promise<{ value: T; cachedAt: number } | null> {
    try {
      return await this.mediaCache.getPageEntry<T>(userId, key);
    } catch {
      this.mediaCache.reportUnavailable();
      return null;
    }
  }

  private async readCachedPage<T>(userId: string, key: string): Promise<T | null> {
    return (await this.readCachedPageEntry<T>(userId, key))?.value ?? null;
  }

  private async readCachedImageEntry(userId: string, key: string): Promise<{ value: Blob; cachedAt: number } | null> {
    try {
      return await this.mediaCache.getImageEntry(userId, key);
    } catch {
      this.mediaCache.reportUnavailable();
      return null;
    }
  }

  private async cachePage(userId: string, key: string, value: unknown): Promise<void> {
    try {
      await this.mediaCache.setPage(userId, key, value);
    } catch {
      this.mediaCache.reportUnavailable();
    }
  }

  private async readCachedImage(userId: string, key: string): Promise<Blob | null> {
    try {
      return await this.mediaCache.getImage(userId, key);
    } catch {
      this.mediaCache.reportUnavailable();
      return null;
    }
  }

  private async cacheImage(userId: string, key: string, image: Blob): Promise<void> {
    try {
      await this.mediaCache.setImage(userId, key, image);
    } catch {
      this.mediaCache.reportUnavailable();
    }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error;
      if (body instanceof SyntaxError || (typeof body === 'string' && body.trimStart().startsWith('<'))) {
        return 'The API returned a non-JSON response. Check KSONG_API_BASE_URL and confirm the API is available.';
      }
      if (isRecord(body)) {
        for (const key of ['message', 'error', 'detail']) {
          if (typeof body[key] === 'string') {
            return body[key] as string;
          }
        }
      }
      if (error.status === 0) {
        return 'Could not reach the API. Check your connection, the backend CORS allowlist for this K-Song origin, and service availability.';
      }
      return `The service returned an error (${error.status}). Please try again.`;
    }
    if (error instanceof SyntaxError || (error instanceof Error && /Unexpected token '<'/.test(error.message))) {
      return 'The API returned a non-JSON response. Check KSONG_API_BASE_URL and confirm the API is available.';
    }
    if (error instanceof Error && /^(Failed to fetch|Load failed|NetworkError)/i.test(error.message)) {
      return 'Could not reach the API. Check your connection, the backend CORS allowlist for this K-Song origin, and service availability.';
    }
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }

  private loadSession(): SessionUser | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }
      const saved: unknown = JSON.parse(raw);
      if (!isRecord(saved) || typeof saved['id'] !== 'string'
        || typeof saved['accessToken'] !== 'string' || typeof saved['refreshToken'] !== 'string') {
        return null;
      }
      return {
        id: saved['id'],
        name: typeof saved['name'] === 'string' ? saved['name'] : 'listener',
        email: typeof saved['email'] === 'string' ? saved['email'] : '',
        accessToken: saved['accessToken'],
        refreshToken: saved['refreshToken'],
        permissions: Array.isArray(saved['permissions'])
          ? saved['permissions'].filter((permission): permission is string => typeof permission === 'string')
          : [],
      };
    } catch {
      return null;
    }
  }

  private persistSession(): void {
    if (isPlatformBrowser(this.platformId) && this.session) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    }
  }

  private clearSession(): void {
    const previousUserId = this.session?.id;
    if (previousUserId) {
      void this.mediaCache.clearUser(previousUserId).catch(() => this.mediaCache.reportUnavailable());
    }
    this.sessionGeneration += 1;
    this.session = null;
    this.user.set(null);
    if (isPlatformBrowser(this.platformId)) {
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        // Keep the in-memory session cleared when browser storage is unavailable.
      }
    }
  }

  private expireSession(): void {
    this.clearSession();
    this.notice.set('Your session expired. Please sign in again.');
    void this.router.navigate(['/login'], { queryParams: { reason: 'session-expired' } });
  }
}
