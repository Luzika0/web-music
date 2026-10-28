import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { App } from './app';
import { MusicApiService } from './core/services/music-api.service';
import { getAppConfig } from './core/config/app-config';
import { DiscoverPageComponent } from './features/discover/discover-page.component';
import { AdminPageComponent } from './features/admin/admin-page.component';
import { AuthPageComponent } from './features/auth/auth-page.component';
import { LibraryService } from './core/services/library.service';
import { MediaItem } from './core/services/music-api.service';
import { PlaybackService } from './core/services/playback.service';
import { MediaCacheService } from './core/services/media-cache.service';
import { textLanguage } from './shared/utils/text-language';
import { MediaImageComponent } from './shared/components/media-image.component';

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
    const navigationToggle = (fixture.nativeElement as HTMLElement).querySelector('.sidebar-toggle') as HTMLButtonElement;
    expect(navigationToggle.getAttribute('aria-expanded')).toBe('true');
    navigationToggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarCollapsed).toBe(true);
    expect(navigationToggle.getAttribute('aria-expanded')).toBe('false');
    const reopenToggle = (fixture.nativeElement as HTMLElement).querySelector('.sidebar-reopen') as HTMLButtonElement;
    expect(reopenToggle.getAttribute('aria-expanded')).toBe('false');
    reopenToggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarCollapsed).toBe(false);
    expect(reopenToggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('switches and remembers the selected color theme', () => {
    const storedTheme = window.localStorage.getItem('ksong.theme.v1');
    const originalTheme = document.documentElement.dataset['theme'];
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const themeButton = (fixture.nativeElement as HTMLElement).querySelector('.theme-toggle') as HTMLButtonElement;
    themeButton.click();
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).toBe(fixture.componentInstance.theme);
    expect(window.localStorage.getItem('ksong.theme.v1')).toBe(fixture.componentInstance.theme);
    expect(themeButton?.classList.contains('theme-light')).toBe(fixture.componentInstance.theme === 'light');
    expect(themeButton?.querySelectorAll('.theme-icon-stage svg')).toHaveLength(2);
    fixture.destroy();
    if (storedTheme === null) window.localStorage.removeItem('ksong.theme.v1');
    else window.localStorage.setItem('ksong.theme.v1', storedTheme);
    if (originalTheme === undefined) delete document.documentElement.dataset['theme'];
    else document.documentElement.dataset['theme'] = originalTheme;
  });
});

describe('MediaImageComponent', () => {
  it('shows animated artwork while the async image request is pending', async () => {
    await TestBed.configureTestingModule({
      imports: [MediaImageComponent],
      providers: [{
        provide: MusicApiService,
        useValue: {
          user: () => ({ id: 'listener' }),
          imageBlob: () => new Promise<Blob>(() => undefined),
        },
      }],
    }).compileComponents();

    const fixture = TestBed.createComponent(MediaImageComponent);
    fixture.componentRef.setInput('imageKey', 'cover-key');
    fixture.detectChanges();

    const artwork = (fixture.nativeElement as HTMLElement).querySelector('.artwork-frame');
    expect(artwork?.getAttribute('aria-busy')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).querySelector('.artwork-shimmer')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.artwork-record')).not.toBeNull();
    fixture.destroy();
  });
});

describe('AuthPageComponent', () => {
  it('renders only one loading indicator while submitting a login form', async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideRouter([]),
        { provide: MusicApiService, useValue: {} },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.componentInstance.submitting = true;
    fixture.detectChanges();

    const submitButton = (fixture.nativeElement as HTMLElement).querySelector('.auth-panel form .button-wide');
    expect(submitButton?.querySelectorAll('.button-loading-spinner')).toHaveLength(1);
    expect(submitButton?.textContent).toContain('Signing you in');
    fixture.destroy();
  });
});

describe('AdminPageComponent', () => {
  it('lets an admin select a loaded artist and review its IDs', async () => {
    const artist = {
      id: 'artist-42',
      artistId: 'artist-42',
      name: 'Quiet Band',
      artistName: 'Quiet Band',
      imageKey: '',
      kind: 'artist' as const,
      albumId: 'album-9',
      albumName: 'Blue Hour',
    };
    const artists = vi.fn()
      .mockResolvedValueOnce({ items: [artist], page: 0, totalPages: 2 })
      .mockResolvedValueOnce({ items: [], page: 1, totalPages: 2 });
    await TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [
        provideRouter([]),
        { provide: MusicApiService, useValue: { artists, toUserMessage: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.admin-card-column .delete-card')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.admin-grid > .upload-card')).not.toBeNull();
    const option = (fixture.nativeElement as HTMLElement).querySelector('.artist-option') as HTMLButtonElement;
    expect(option.textContent).toContain('Artist ID · artist-42');
    expect(option.textContent).toContain('Album ID · album-9');
    option.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.artistId).toBe('artist-42');
    expect((fixture.nativeElement as HTMLElement).querySelector('.selected-artist-summary')?.textContent).toContain('Blue Hour');
    fixture.componentInstance.changeArtistPage(1);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(artists).toHaveBeenLastCalledWith(1, 10, '');
    expect((fixture.nativeElement as HTMLElement).querySelector('.selected-artist-summary')?.textContent).toContain('Album ID · album-9');
    fixture.destroy();
  });

  it('shows artist lookup failures and allows retry', async () => {
    const artists = vi.fn()
      .mockRejectedValueOnce(new Error('Artist service unavailable'))
      .mockResolvedValueOnce({ items: [], page: 0, totalPages: 0 });
    await TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [
        provideRouter([]),
        { provide: MusicApiService, useValue: { artists, toUserMessage: (error: Error) => error.message } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Artist service unavailable');

    fixture.componentInstance.loadArtists();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(artists).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
    fixture.destroy();
  });
});

describe('MusicApiService', () => {
  let api: MusicApiService;
  let http: HttpTestingController;
  const mediaCache = {
    getPage: vi.fn(async (_userId: string, _key: string): Promise<unknown> => null),
    setPage: vi.fn(async () => undefined),
    getImage: vi.fn(async (_userId: string, _key: string): Promise<Blob | null> => null),
    setImage: vi.fn(async () => undefined),
    clearUser: vi.fn(async () => undefined),
    reportUnavailable: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mediaCache.getPage.mockResolvedValue(null);
    mediaCache.getImage.mockResolvedValue(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MediaCacheService, useValue: mediaCache },
      ],
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
        content: [{
          artistId: 'artist-1',
          artistName: 'Quiet Band',
          r2Imagekey: 'image-key',
          album: { id: 'album-1', name: 'Blue Hour', imageKey: 'album-image' },
        }],
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
        albumId: 'album-1',
        albumName: 'Blue Hour',
        albumImageKey: 'album-image',
      }],
      page: 2,
      totalPages: 4,
    });
  });

  it('uses a cached artist page only when the API is unreachable', async () => {
    const cachedPage = { items: [], page: 0, totalPages: 0 };
    mediaCache.getPage.mockResolvedValue(cachedPage);
    const artists = api.artists(0, 8, '');
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/auth/media/artist?page=0&size=8').error(new ProgressEvent('error'));
    await expect(artists).resolves.toEqual(cachedPage);
    expect(mediaCache.getPage).toHaveBeenCalledWith('public', 'artists:0:8:');
  });

  describe('runtime configuration', () => {
    it('uses configured discovery and refresh settings and falls back for invalid values', () => {
      const originalConfig = window.__KSONG_CONFIG__;
      window.__KSONG_CONFIG__ = {};
      expect(getAppConfig()).toMatchObject({
        backgroundColor: '#000040',
        accentColor: '#ebebed',
      });

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

  it('passes a search term to the existing song catalogue query', async () => {
    const songs = api.songs(0, 8, 'night drive');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/media/list-song?page=0&size=8&searchText=night%20drive');
    request.flush({ data: { content: [], totalPage: 0 } });
    await expect(songs).resolves.toMatchObject({ items: [], page: 0 });
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
    const request = http.expectOne('/api/auth/song/song-2/playback-token');
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

  it('uses cached private artwork only when the authenticated API is unreachable', async () => {
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: 'access', userId: 123, refreshToken: 'refresh' } },
    });
    await login;

    const cachedImage = new Blob(['cached artwork'], { type: 'image/jpeg' });
    mediaCache.getImage.mockResolvedValue(cachedImage);
    const imageRequest = api.imageBlob('music/songImage/1/cover.jpg');
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/auth/media/image?r2Imagekey=music%2FsongImage%2F1%2Fcover.jpg')
      .error(new ProgressEvent('error'));
    await expect(imageRequest).resolves.toBe(cachedImage);
  });

  it('does not use cached private artwork when the API denies authorization', async () => {
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: 'access', userId: 123, refreshToken: 'refresh' } },
    });
    await login;

    mediaCache.getImage.mockResolvedValue(new Blob(['cached artwork'], { type: 'image/jpeg' }));
    const imageRequest = api.imageBlob('music/songImage/1/cover.jpg');
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne('/api/auth/media/image?r2Imagekey=music%2FsongImage%2F1%2Fcover.jpg')
      .error(new ProgressEvent('error'), { status: 403, statusText: 'Forbidden' });
    await expect(imageRequest).rejects.toThrow();
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

  it('enables admin from data.token.permission and sends authenticated admin operations', async () => {
    const login = api.login('authorized-listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: {
        token: {
          permission: 'ADMIN',
          acessToken: 'access',
          userId: 'user-2',
          refreshToken: 'refresh',
        },
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

describe('LibraryService', () => {
  let library: LibraryService;

  beforeEach(() => {
    localStorage.removeItem('ksong.library.v1');
    TestBed.configureTestingModule({});
    library = TestBed.inject(LibraryService);
  });

  afterEach(() => localStorage.removeItem('ksong.library.v1'));

  it('persists liked catalog songs locally and removes them again', () => {
    const song: MediaItem = {
      id: 'song-1',
      artistId: 'artist-1',
      name: 'Evening song',
      artistName: 'K-Song artist',
      imageKey: '',
      kind: 'song',
    };

    library.toggleLike(song);
    expect(library.isLiked(song.id)).toBe(true);
    expect(JSON.parse(localStorage.getItem('ksong.library.v1') ?? '[]')).toEqual([song]);

    library.removeLikedSong(song.id);
    expect(library.isLiked(song.id)).toBe(false);
    expect(library.likedSongs()).toEqual([]);
  });
});

describe('PlaybackService queue', () => {
  it('plays tracks in sequence and supports previous and next selection', async () => {
    const api = {
      playbackSession: vi.fn(async (songId: string) => ({
        token: `token-${songId}`,
        sessionId: `session-${songId}`,
        expiresAt: '2099-01-01T00:00:00Z',
        songId,
      })),
      playbackStatus: vi.fn(async () => true),
      watchPlaybackEvents: vi.fn(() => () => {}),
      absoluteUrl: vi.fn((path: string) => path),
      toUserMessage: vi.fn((error: unknown) => String(error)),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn(async () => true) } },
        { provide: MusicApiService, useValue: api },
      ],
    });
    const playback = TestBed.inject(PlaybackService);
    const first: MediaItem = {
      id: 'song-1', artistId: 'artist-1', name: 'First', artistName: 'Artist', imageKey: '', kind: 'song',
    };
    const second: MediaItem = {
      id: 'song-2', artistId: 'artist-2', name: 'Second', artistName: 'Artist', imageKey: '', kind: 'song',
    };

    await playback.play(first, [first, second]);
    expect(playback.queue().map((song) => song.id)).toEqual(['song-1', 'song-2']);
    expect(playback.queueIndex()).toBe(0);
    const audio = { currentTime: 8, duration: 120, paused: false } as HTMLAudioElement;
    playback.bindAudioElement(audio);
    playback.updateProgress(8, 120);
    playback.playPrevious();
    expect(audio.currentTime).toBe(0);
    expect(api.playbackSession).toHaveBeenCalledTimes(1);

    playback.playNext();
    await vi.waitFor(() => expect(playback.currentSong()?.id).toBe('song-2'));
    expect(playback.queueIndex()).toBe(1);

    playback.playPrevious();
    await vi.waitFor(() => expect(playback.currentSong()?.id).toBe('song-1'));
    expect(playback.queueIndex()).toBe(0);
    expect(api.playbackSession).toHaveBeenCalledTimes(3);

    playback.stop();
  });
});

describe('textLanguage', () => {
  it('uses Khmer language metadata only when Khmer script is present', () => {
    expect(textLanguage('សួស្តី')).toBe('km');
    expect(textLanguage('K-Song')).toBeNull();
    expect(textLanguage('Hello សួស្តី')).toBe('km');
  });
});
