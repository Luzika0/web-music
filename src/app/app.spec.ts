import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { MusicApiService } from './core/services/music-api.service';
import { getAppConfig } from './core/config/app-config';
import { DiscoverPageComponent } from './features/discover/discover-page.component';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  describe('DiscoverPage', () => {
    it('uses the configured page size for media requests', () => {
      const originalConfig = window.__KSONG_CONFIG__;
      window.__KSONG_CONFIG__ = { pageSize: 24 };
      TestBed.configureTestingModule({
        imports: [DiscoverPageComponent],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      });

      const fixture = TestBed.createComponent(DiscoverPageComponent);
      expect(fixture.componentInstance.pageSize).toBe(24);
      window.__KSONG_CONFIG__ = originalConfig;
    });
  });

  it('creates the K-Song application shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.brand')?.textContent).toContain('K-Song');
  });
});

describe('MusicApiService', () => {
  let api: MusicApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MusicApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the documented login token spellings', async () => {
    const login = api.login('listener', 'secret');
    const request = http.expectOne('/api/auth/log-in');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ emailOrUserName: 'listener', password: 'secret' });
    request.flush({ data: { token: { acessToken: 'access', userId: 123, refreshToken: 'refresh' } } });

    await login;
    expect(api.user()?.id).toBe('123');
    expect(api.user()?.accessToken).toBe('access');
  });

  it('sends bearer and user identity headers when loading the protected song catalogue', async () => {
    const login = api.login('listener', 'secret');
    const loginRequest = http.expectOne('/api/auth/log-in');
    loginRequest.flush({
      data: { token: { acessToken: 'access-token', userId: 123, refreshToken: 'refresh-token' } },
    });
    await login;

    const songs = api.songs(0, 8);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/media/list-song?page=0&size=8&searchText=');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(request.request.headers.get('X-User-Id')).toBe('123');
    request.flush({ data: { content: [], totalPage: 0 } });
    await expect(songs).resolves.toMatchObject({ items: [], page: 0 });
  });

  it('normalizes artist pages and sends the optional search query', async () => {
    const artists = api.artists(2, 10, 'quiet band');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/media/artist?page=2&size=10&searchText=quiet%20band');
    expect(request.request.method).toBe('GET');
    request.flush({
      data: {
        content: [{ artistId: 'artist-1', artistName: 'Quiet Band', r2Imagekey: 'image-key' }],
        totalPage: 4,
      },
    });

    await expect(artists).resolves.toEqual({
      items: [{
        id: 'artist-1',
        artistId: 'artist-1',
        name: 'Quiet Band',
        artistName: 'Quiet Band',
        imageKey: 'image-key',
        kind: 'artist',
      }],
      page: 2,
      totalPages: 4,
    });
  });

  describe('runtime configuration', () => {
    it('uses configured discovery and refresh settings and falls back for invalid values', () => {
      const originalConfig = window.__KSONG_CONFIG__;
      window.__KSONG_CONFIG__ = {
        apiBaseUrl: 'https://api.example.test/',
        pageSize: 20,
        refreshBufferSeconds: 120,
      };
      expect(getAppConfig()).toMatchObject({
        apiBaseUrl: 'https://api.example.test',
        pageSize: 20,
        refreshBufferSeconds: 120,
      });

      window.__KSONG_CONFIG__ = { pageSize: 0, refreshBufferSeconds: 3601 };
      expect(getAppConfig()).toMatchObject({ pageSize: 8, refreshBufferSeconds: 60 });
      window.__KSONG_CONFIG__ = originalConfig;
    });
  });

  it('sends the song-list query required by Music Service and reads its entity page', async () => {
    const songs = api.songs(0, 8);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/media/list-song?page=0&size=8&searchText=');
    expect(request.request.method).toBe('GET');
    request.flush({
      data: {
        content: [{
          songId: 'song-1',
          artistId: 7,
          songName: 'First track',
          songImage: 'music/songImage/1/cover.jpg',
          songType: 'POP',
        }],
        totalPage: 3,
      },
    });

    await expect(songs).resolves.toEqual({
      items: [{
        id: 'song-1',
        artistId: '7',
        name: 'First track',
        artistName: '',
        imageKey: 'music/songImage/1/cover.jpg',
        kind: 'song',
      }],
      page: 0,
      totalPages: 3,
    });
  });

  it('explains CORS and connectivity failures without a misleading JSON error', async () => {
    expect(api.toUserMessage(new TypeError('Failed to fetch'))).toContain('backend CORS allowlist');
    const artists = api.artists(0, 8, '');
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/auth/media/artist?page=0&size=8').error(new ProgressEvent('error'));
    await expect(artists).rejects.toThrow(
      'Could not reach the API. Check your connection, the backend CORS allowlist for this K-Song origin, and service availability.',
    );
  });

  it('uses the current music-service playback-session response contract', async () => {
    const session = api.playbackSession('song-2');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/song/song-2/playback-session');
    expect(request.request.method).toBe('POST');
    request.flush({
      statusCode: 200,
      message: 'SUCESS',
      data: { token: 'playback-secret', sessionId: 'session-1', expiresAt: '2026-10-28:23:00:00', songId: 'song-2' },
    });
    await expect(session).resolves.toEqual({
      token: 'playback-secret',
      sessionId: 'session-1',
      expiresAt: '2026-10-28:23:00:00',
      songId: 'song-2',
    });
  });

  it('fetches private artwork with the authenticated user headers', async () => {
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: 'access', userId: 123, refreshToken: 'refresh' } },
    });
    await login;

    const imageRequest = api.imageBlob('music/songImage/1/cover.jpg');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/media/image?r2Imagekey=music%2FsongImage%2F1%2Fcover.jpg');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access');
    expect(request.request.headers.get('X-User-Id')).toBe('123');
    request.flush(new Blob(['image'], { type: 'image/jpeg' }));
    await expect(imageRequest).resolves.toBeInstanceOf(Blob);
  });

  it('stops playback when the music service sends the takeover SSE event', async () => {
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: 'access', userId: 123, refreshToken: 'refresh' } },
    });
    await login;

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'event: playback_taken_over\ndata: {"active":false,"reason":"SESSION_REPLACED"}\n\n',
        ));
        controller.close();
      },
    });
    const fetchStub = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchStub);
    let takeoverCount = 0;
    let error = '';

    const stop = api.watchPlaybackEvents(
      'song-1',
      'playback-secret',
      () => takeoverCount++,
      (message) => error = message,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    stop();
    vi.unstubAllGlobals();

    expect(takeoverCount).toBe(1);
    expect(error).toBe('');
    expect(fetchStub).toHaveBeenCalledWith(
      '/api/auth/song/song-1/playback-events',
      expect.objectContaining({ credentials: 'omit', cache: 'no-store' }),
    );
  });

  it('shares one proactive refresh across concurrent playback status requests', async () => {
    const expiredJwt = `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`;
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: expiredJwt, userId: 'user-1', refreshToken: 'refresh' } },
    });
    await login;

    const status = api.playbackStatus('track-1', 'playback-secret');
    const statusAgain = api.playbackStatus('track-1', 'playback-secret');
    const refresh = http.expectOne((request) =>
      request.url === '/api/auth/refresh-token' && request.params.get('refreshToken') === 'refresh');
    expect(refresh.request.method).toBe('POST');
    refresh.flush({ data: { newAcessToken: 'fresh-access' } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const playbackRequests = http.match((request) =>
      request.url.includes('/api/auth/song/track-1/playback-'));
    expect(playbackRequests).toHaveLength(2);
    for (const request of playbackRequests) {
      expect(request.request.headers.get('Authorization')).toBe('Bearer fresh-access');
      expect(request.request.headers.get('X-User-Id')).toBe('user-1');
      expect(request.request.headers.get('playBack-token')).toBe('playback-secret');
      request.flush({ active: true });
    }
    await Promise.all([status, statusAgain]);
  });

  it('refreshes and retries an authenticated request after a 401 once', async () => {
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: 'expired-access', userId: 'user-1', refreshToken: 'refresh' } },
    });
    await login;

    const status = api.playbackStatus('track-2', 'playback-secret');
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/auth/song/track-2/playback-status').flush(
      { message: 'Expired' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne((request) =>
      request.url === '/api/auth/refresh-token' && request.params.get('refreshToken') === 'refresh')
      .flush({ data: { newAcessToken: 'fresh-access' } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const retry = http.expectOne('/api/auth/song/track-2/playback-status');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-access');
    retry.flush({ active: true });
    await status;
  });

  it('sends authenticated multipart uploads and deletes without an invented body', async () => {
    const login = api.login('authorized-listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: {
        token: { acessToken: 'access', userId: 'user-2', refreshToken: 'refresh' },
        permissions: ['ADMIN'],
      },
    });
    await login;
    expect(api.isAdmin()).toBe(true);

    const form = new FormData();
    form.append('artistName', 'Example artist');
    const create = api.createArtist(form);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const upload = http.expectOne('/api/auth/admin/create-artist');
    expect(upload.request.method).toBe('POST');
    expect(upload.request.body).toBe(form);
    expect(upload.request.headers.get('X-User-Id')).toBe('user-2');
    expect(upload.request.headers.has('Content-Type')).toBe(false);
    upload.flush({});
    await create;

    const remove = api.deleteSong('song-42');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const deletion = http.expectOne('/api/auth/admin/delete-song/song-42');
    expect(deletion.request.method).toBe('DELETE');
    expect(deletion.request.body).toBeNull();
    expect(deletion.request.headers.get('X-User-Id')).toBe('user-2');
    deletion.flush({});
    await remove;
  });
});
