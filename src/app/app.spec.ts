import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
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
import { requireAuthenticatedSession } from './core/guards/authenticated.guard';
import { SearchPageComponent } from './features/search/search-page.component';
import { of } from 'rxjs';

const SESSION_STORAGE_KEY = 'ksong.session.v1';
const validAccessToken = () =>
  `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;

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

  it('redirects to login after a successful password reset', async () => {
    const api = {
      resetPassword: vi.fn().mockResolvedValue(undefined),
      toUserMessage: vi.fn((error: unknown) => String(error)),
    };
    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideRouter([]),
        { provide: MusicApiService, useValue: api },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.componentInstance.mode = 'reset-password';
    fixture.componentInstance.email = 'listener@example.com';
    fixture.componentInstance.otp = '123456';
    fixture.componentInstance.password = 'new-password-123';

    await fixture.componentInstance.submit();

    expect(api.resetPassword).toHaveBeenCalledWith('listener@example.com', '123456', 'new-password-123');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { passwordReset: '1' },
      replaceUrl: true,
    });
    expect(fixture.componentInstance.password).toBe('');
    expect(fixture.componentInstance.otp).toBe('');
    fixture.destroy();
  });

  it('preserves a safe return destination through registration and verification', async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              url: [{ path: 'register' }],
              queryParamMap: convertToParamMap({
                next: '/discover?artistPage=2',
                signInToPlay: '1',
                email: 'listener@example.com',
              }),
            },
          },
        },
        { provide: MusicApiService, useValue: {} },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AuthPageComponent);
    const component = fixture.componentInstance;
    expect(component.returnQueryParams).toEqual({
      next: '/discover?artistPage=2',
      signInToPlay: '1',
    });
    expect(component.verifyQueryParams).toEqual({
      next: '/discover?artistPage=2',
      signInToPlay: '1',
      email: 'listener@example.com',
    });
    expect(component.verifiedLoginQueryParams).toEqual({
      next: '/discover?artistPage=2',
      signInToPlay: '1',
      verified: '1',
    });
    fixture.destroy();
  });

  it('rejects an external login return destination', async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              url: [{ path: 'login' }],
              queryParamMap: convertToParamMap({ next: '//attacker.example/path' }),
            },
          },
        },
        { provide: MusicApiService, useValue: {} },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AuthPageComponent);
    expect(fixture.componentInstance.safeNext).toBeNull();
    fixture.destroy();
  });

  it('shows a password-reset success message on the login page', async () => {
    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideRouter([]),
        { provide: MusicApiService, useValue: {} },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.componentInstance.mode = 'login';
    fixture.componentInstance.success = 'Your password has been reset successfully. Sign in with your new password.';
    fixture.detectChanges();

    const success = (fixture.nativeElement as HTMLElement).querySelector('.success-alert');
    expect(success?.textContent).toContain('password has been reset successfully');
    fixture.destroy();
  });

  it('sends an admin to the creator studio after login', async () => {
    const api = {
      login: vi.fn().mockResolvedValue(undefined),
      isAdmin: vi.fn().mockReturnValue(true),
    };
    await TestBed.configureTestingModule({
      imports: [AuthPageComponent],
      providers: [
        provideRouter([]),
        { provide: MusicApiService, useValue: api },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AuthPageComponent);
    fixture.componentInstance.identity = 'admin';
    fixture.componentInstance.password = 'secret';

    await fixture.componentInstance.submit();

    expect(api.login).toHaveBeenCalledWith('admin', 'secret');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
    fixture.destroy();
  });
});

describe('SearchPageComponent SSR behavior', () => {
  it('does not start catalog HTTP requests while rendering a search URL on the server', async () => {
    const api = {
      songs: vi.fn(),
      artists: vi.fn(),
      toUserMessage: vi.fn((error: unknown) => String(error)),
    };
    const params = convertToParamMap({ q: 'night drive' });
    await TestBed.configureTestingModule({
      imports: [SearchPageComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: params },
            queryParamMap: of(params),
          },
        },
        { provide: MusicApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SearchPageComponent);
    fixture.componentInstance.ngOnInit();

    expect(fixture.componentInstance.query).toBe('night drive');
    expect(api.songs).not.toHaveBeenCalled();
    expect(api.artists).not.toHaveBeenCalled();
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

describe('MediaCacheService', () => {
  it('disables persistent caching when storage is unavailable', () => {
    TestBed.configureTestingModule({
      providers: [MediaCacheService],
    });
    const mediaCache = TestBed.inject(MediaCacheService);

    mediaCache.reportUnavailable();
    expect(mediaCache.persistent()).toBe(false);
  });
});

describe('authenticated route access', () => {
  let api: MusicApiService;
  let router: Router;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MusicApiService);
    router = TestBed.inject(Router);
    http = TestBed.inject(HttpTestingController);
  });

  it('redirects signed-out users to login with their requested page', async () => {
    const result = await requireAuthenticatedSession(api, router, '/now-playing');

    expect(result).not.toBe(true);
    if (result !== true) {
      expect(router.serializeUrl(result)).toBe('/login?next=%2Fnow-playing');
    }
  });

  it('redirects to login when the backend rejects an expired session refresh', async () => {
    const expiredAccess = `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`;
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: expiredAccess, userId: 'user-1', refreshToken: 'expired-refresh-token' } },
    });
    await login;

    const guardedRoute = requireAuthenticatedSession(api, router, '/now-playing');
    http.expectOne('/api/auth/refresh-token').flush(
      { message: 'Refresh token expired' },
      { status: 401, statusText: 'Unauthorized' },
    );
    const result = await guardedRoute;

    expect(result).not.toBe(true);
    if (result !== true) {
      expect(router.serializeUrl(result)).toBe('/login?next=%2Fnow-playing');
    }
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
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    vi.clearAllMocks();
    mediaCache.getPage.mockResolvedValue(null);
    mediaCache.getImage.mockResolvedValue(null);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MediaCacheService, useValue: mediaCache },
      ],
    });
    api = TestBed.inject(MusicApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  });

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

  it('refreshes an expired access token using the Auth Service newAccessToken response field', async () => {
    const expiredAccess = `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`;
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: expiredAccess, userId: 123, refreshToken: 'refresh-valid' } },
    });
    await login;

    const guardedRequest = api.songs(0, 8);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const refresh = http.expectOne((request) =>
      request.url === '/api/auth/refresh-token'
      && request.params.get('refreshToken') === 'refresh-valid');
    expect(refresh.request.method).toBe('POST');
    refresh.flush({ statusCode: 200, message: 'SUCCESS', data: { newAccessToken: 'fresh-access-token' } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const songs = http.expectOne('/api/auth/media/list-song?page=0&size=8&searchText=');
    expect(songs.request.headers.get('Authorization')).toBe('Bearer fresh-access-token');
    expect(api.user()?.accessToken).toBe('fresh-access-token');
    expect(JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) ?? '{}').accessToken).toBe('fresh-access-token');
    songs.flush({ data: { content: [], totalPage: 0 } });
    await expect(guardedRequest).resolves.toMatchObject({ items: [], page: 0 });
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

  it('never treats an artist ID as a playable song ID', async () => {
    const songs = api.songs(0, 8);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/media/list-song?page=0&size=8&searchText=');
    request.flush({
      data: {
        content: [{ artistId: 'artist-42', songName: 'Missing song identifier' }],
        totalPage: 1,
      },
    });

    const result = await songs;
    expect(result.items[0]).toMatchObject({
      id: '',
      artistId: 'artist-42',
      name: 'Missing song identifier',
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
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: validAccessToken(), userId: 'user-1', refreshToken: 'refresh' } },
    });
    await login;

    const session = api.playbackSession('song-2');
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectNone('/api/auth/refresh-token');
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
    const accessToken = validAccessToken();
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: accessToken, userId: 123, refreshToken: 'refresh' } },
    });
    await login;

    const imageRequest = api.imageBlob('music/songImage/1/cover.jpg');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const request = http.expectOne('/api/auth/media/image?r2Imagekey=music%2FsongImage%2F1%2Fcover.jpg');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
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
      data: { token: { acessToken: validAccessToken(), userId: 123, refreshToken: 'refresh' } },
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
    http.expectNone('/api/auth/refresh-token');
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
    refresh.flush({ data: { newAcessToken: validAccessToken() } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const playbackRequests = http.match((request) =>
      request.url.includes('/api/auth/song/track-1/playback-'));
    expect(playbackRequests).toHaveLength(2);
    for (const request of playbackRequests) {
      expect(request.request.headers.get('Authorization')).toMatch(/^Bearer .+/);
      expect(request.request.headers.get('X-User-Id')).toBe('user-1');
      expect(request.request.headers.get('playBack-token')).toBe('playback-secret');
      request.flush({ active: true });
    }
    await Promise.all([status, statusAgain]);
  });

  it('refreshes and retries an authenticated request after a 401 once', async () => {
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: validAccessToken(), userId: 'user-1', refreshToken: 'refresh' } },
    });
    await login;

    const status = api.playbackStatus('track-2', 'playback-secret');
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectNone('/api/auth/refresh-token');
    http.expectOne('/api/auth/song/track-2/playback-status').flush(
      { message: 'Expired' },
      { status: 401, statusText: 'Unauthorized' },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne((request) =>
      request.url === '/api/auth/refresh-token' && request.params.get('refreshToken') === 'refresh')
      .flush({ data: { newAcessToken: validAccessToken() } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    const retry = http.expectOne('/api/auth/song/track-2/playback-status');
    expect(retry.request.headers.get('Authorization')).toMatch(/^Bearer .+/);
    retry.flush({ active: true });
    await status;
  });

  it('clears the stored session when playback token validation fails', async () => {
    const login = api.login('listener', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: validAccessToken(), userId: 'user-1', refreshToken: 'refresh' } },
    });
    await login;

    const status = api.playbackStatus('track-3', 'playback-secret');
    const refresh = http.expectOne((request) =>
      request.url === '/api/auth/refresh-token' && request.params.get('refreshToken') === 'refresh');
    refresh.flush(
      { message: 'Refresh token expired' },
      { status: 401, statusText: 'Unauthorized' },
    );

    await expect(status).rejects.toThrow('Your session could not be refreshed.');
    expect(api.user()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('does not apply an old account refresh to a newly signed-in account', async () => {
    const expiredAccess = `header.${btoa(JSON.stringify({ exp: 1 }))}.signature`;
    const firstLogin = api.login('first-user', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: expiredAccess, userId: 'user-1', refreshToken: 'refresh-1' } },
    });
    await firstLogin;

    const pendingRequest = api.playbackStatus('song-1', 'playback-token');
    const refresh = http.expectOne((request) =>
      request.url === '/api/auth/refresh-token' && request.params.get('refreshToken') === 'refresh-1');

    const secondAccess = validAccessToken();
    const secondLogin = api.login('second-user', 'secret');
    http.expectOne('/api/auth/log-in').flush({
      data: { token: { acessToken: secondAccess, userId: 'user-2', refreshToken: 'refresh-2' } },
    });
    await secondLogin;

    refresh.flush({ data: { newAcessToken: 'old-account-access' } });
    await expect(pendingRequest).rejects.toThrow('account changed during token refresh');
    expect(api.user()?.id).toBe('user-2');
    expect(api.user()?.accessToken).toBe(secondAccess);
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

describe('MusicApiService session initialization', () => {
  const sessionKey = SESSION_STORAGE_KEY;
  const storedSession = {
    id: 'user-1',
    name: 'listener',
    email: 'listener@example.com',
    accessToken: 'stale-access',
    refreshToken: 'refresh-token',
    permissions: [],
  };
  let api: MusicApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.removeItem(sessionKey);
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem(sessionKey);
  });

  it('does not rotate an opaque access token on startup', async () => {
    sessionStorage.setItem(sessionKey, JSON.stringify(storedSession));
    api = TestBed.inject(MusicApiService);
    http = TestBed.inject(HttpTestingController);

    await api.initializeSession();
    http.expectNone('/api/auth/refresh-token');
    expect(api.user()?.accessToken).toBe('stale-access');
  });

  it('logs out when the saved session has no refresh token', async () => {
    const { refreshToken: _refreshToken, ...sessionWithoutRefreshToken } = storedSession;
    sessionStorage.setItem(sessionKey, JSON.stringify(sessionWithoutRefreshToken));
    api = TestBed.inject(MusicApiService);
    http = TestBed.inject(HttpTestingController);

    await api.initializeSession();

    expect(api.user()).toBeNull();
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it('logs out when the refresh token is rejected', async () => {
    const expiredSession = { ...storedSession, accessToken: `header.${btoa(JSON.stringify({ exp: 1 }))}.signature` };
    sessionStorage.setItem(sessionKey, JSON.stringify(expiredSession));
    api = TestBed.inject(MusicApiService);
    http = TestBed.inject(HttpTestingController);

    const initialization = api.initializeSession();
    http.expectOne((request) => request.url === '/api/auth/refresh-token').flush(
      { message: 'Refresh token expired' },
      { status: 401, statusText: 'Unauthorized' },
    );

    await initialization;
    expect(api.user()).toBeNull();
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it('preserves the session when refresh has a network error', async () => {
    const expiredSession = { ...storedSession, accessToken: `header.${btoa(JSON.stringify({ exp: 1 }))}.signature` };
    sessionStorage.setItem(sessionKey, JSON.stringify(expiredSession));
    api = TestBed.inject(MusicApiService);
    http = TestBed.inject(HttpTestingController);

    const initialization = api.initializeSession();
    http.expectOne((request) => request.url === '/api/auth/refresh-token').error(new ProgressEvent('error'));

    await initialization;
    expect(api.user()?.id).toBe('user-1');
    expect(sessionStorage.getItem(sessionKey)).not.toBeNull();
  });
});

describe('LibraryService', () => {
  let library: LibraryService;
  const api = {
    user: signal({ id: 'user-1' }),
    favoriteSongs: vi.fn(async () => [] as MediaItem[]),
    playlists: vi.fn(async () => []),
    songs: vi.fn(async () => ({ items: [], page: 0, totalPages: 0 })),
    addFavorite: vi.fn(async () => {}),
    removeFavorite: vi.fn(async () => {}),
    createPlaylist: vi.fn(async (payload: { name: string; description?: string }) => ({
      id: 'playlist-1', name: payload.name, description: payload.description ?? '', songIds: [],
    })),
    updatePlaylist: vi.fn(async (id: string, payload: { name: string; description?: string }) => ({
      id, name: payload.name, description: payload.description ?? '', songIds: [],
    })),
    deletePlaylist: vi.fn(async () => {}),
    addSongToPlaylist: vi.fn(async () => {}),
    removeSongFromPlaylist: vi.fn(async () => {}),
    toUserMessage: vi.fn((error: unknown) => String(error)),
  };

  beforeEach(async () => {
    api.favoriteSongs.mockClear();
    api.playlists.mockClear();
    api.songs.mockClear();
    api.addFavorite.mockClear();
    api.removeFavorite.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: MusicApiService, useValue: api }],
    });
    library = TestBed.inject(LibraryService);
    await vi.waitFor(() => expect(api.favoriteSongs).toHaveBeenCalled());
  });

  it('syncs favorite additions and removals with the account API', async () => {
    const song: MediaItem = {
      id: 'song-1', artistId: 'artist-1', name: 'Evening song',
      artistName: 'K-Song artist', imageKey: '', kind: 'song',
    };
    library.toggleLike(song);
    expect(library.isLiked(song.id)).toBe(true);
    await vi.waitFor(() => expect(api.addFavorite).toHaveBeenCalledWith(song.id));

    library.removeLikedSong(song.id);
    expect(library.isLiked(song.id)).toBe(false);
    await vi.waitFor(() => expect(api.removeFavorite).toHaveBeenCalledWith(song.id));
  });

  it('creates and deletes account playlists through the API', async () => {
    await library.createPlaylist('Road Trip', 'Driving music');
    expect(api.createPlaylist).toHaveBeenCalledWith({ name: 'Road Trip', description: 'Driving music' });
    expect(library.playlists()[0]?.id).toBe('playlist-1');

    await library.deletePlaylist('playlist-1');
    expect(api.deletePlaylist).toHaveBeenCalledWith('playlist-1');
    expect(library.playlists()).toEqual([]);
  });
});

describe('PlaybackService authentication before playback', () => {
  it('redirects signed-out users to login without creating a playback session', async () => {
    const api = {
      user: vi.fn(() => null),
      playbackSession: vi.fn(),
      playbackStatus: vi.fn(),
      watchPlaybackEvents: vi.fn(),
      absoluteUrl: vi.fn((path: string) => path),
      toUserMessage: vi.fn((error: unknown) => String(error)),
    };
    const router = {
      url: '/discover',
      navigate: vi.fn(async () => true),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: MusicApiService, useValue: api },
      ],
    });
    const playback = TestBed.inject(PlaybackService);
    const song: MediaItem = {
      id: 'song-guest', artistId: 'artist-1', name: 'Guest track',
      artistName: 'Artist', imageKey: '', kind: 'song',
    };

    await playback.play(song, [song]);

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { next: '/discover', signInToPlay: '1' },
    });
    expect(api.playbackSession).not.toHaveBeenCalled();
    expect(playback.currentSong()).toBeNull();
    expect(playback.queue()).toEqual([]);
  });

  it('does not resume a guest track after the sign-in request is cancelled', async () => {
    let signedIn = false;
    const api = {
      user: vi.fn(() => signedIn ? ({ id: 'user-1' }) : null),
      playbackSession: vi.fn(),
      playbackStatus: vi.fn(),
      watchPlaybackEvents: vi.fn(() => () => {}),
      absoluteUrl: vi.fn((path: string) => path),
      toUserMessage: vi.fn((error: unknown) => String(error)),
    };
    const router = { url: '/discover', navigate: vi.fn(async () => true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: MusicApiService, useValue: api },
      ],
    });
    const playback = TestBed.inject(PlaybackService);
    const song: MediaItem = {
      id: 'song-cancelled', artistId: 'artist-1', name: 'Cancelled track',
      artistName: 'Artist', imageKey: '', kind: 'song',
    };

    await playback.play(song);
    playback.cancelPendingPlayback();
    signedIn = true;
    await playback.resumePendingPlayback();

    expect(api.playbackSession).not.toHaveBeenCalled();
    expect(playback.currentSong()).toBeNull();
  });

  it('resumes a pending track only after a user has signed in', async () => {
    let signedIn = false;
    const api = {
      user: vi.fn(() => signedIn ? ({ id: 'user-1' }) : null),
      playbackSession: vi.fn(async (songId: string) => ({
        token: `token-${songId}`, sessionId: 'session-1',
        expiresAt: '2099-01-01T00:00:00Z', songId,
      })),
      playbackStatus: vi.fn(async () => true),
      watchPlaybackEvents: vi.fn(() => () => {}),
      absoluteUrl: vi.fn((path: string) => path),
      toUserMessage: vi.fn((error: unknown) => String(error)),
    };
    const router = { url: '/discover', navigate: vi.fn(async () => true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: MusicApiService, useValue: api },
      ],
    });
    const playback = TestBed.inject(PlaybackService);
    const song: MediaItem = {
      id: 'song-after-login', artistId: 'artist-1', name: 'After login',
      artistName: 'Artist', imageKey: '', kind: 'song',
    };

    await playback.play(song);
    expect(api.playbackSession).not.toHaveBeenCalled();
    signedIn = true;
    await playback.resumePendingPlayback();

    expect(api.playbackSession).toHaveBeenCalledWith(song.id);
    expect(playback.currentSong()?.id).toBe(song.id);
    expect(playback.manifestUrl()).toContain('/song/song-after-login/hls/index.m3u8');
    playback.stop();
  });
});

describe('PlaybackService queue', () => {
  it('plays tracks in sequence and supports previous and next selection', async () => {
    const api = {
      user: vi.fn(() => ({ id: 'user-1' })),
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
    expect(playback.currentSong()).toBeNull();
    expect(playback.queue()).toEqual([]);
    expect(playback.queueIndex()).toBe(-1);
  });
});

describe('PlaybackService HLS authorization recovery', () => {
  it('renews one expired playback session and stops retrying after a second unauthorized stream', async () => {
    let sessionNumber = 0;
    const api = {
      user: vi.fn(() => ({ id: 'user-1' })),
      playbackSession: vi.fn(async (songId: string) => {
        sessionNumber += 1;
        return {
          token: `playback-token-${sessionNumber}`,
          sessionId: `session-${sessionNumber}`,
          expiresAt: '2099-01-01T00:00:00Z',
          songId,
        };
      }),
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
    const song: MediaItem = {
      id: 'song-expiring', artistId: 'artist-1', name: 'Expiring stream',
      artistName: 'Artist', imageKey: '', kind: 'song',
    };

    await playback.play(song);
    expect(playback.token()).toBe('playback-token-1');

    await Promise.all([
      playback.renewCurrentPlayback(),
      playback.renewCurrentPlayback(),
    ]);
    expect(api.playbackSession).toHaveBeenCalledTimes(2);
    expect(playback.token()).toBe('playback-token-2');
    expect(playback.currentSong()?.id).toBe(song.id);

    await playback.renewCurrentPlayback();
    expect(api.playbackSession).toHaveBeenCalledTimes(2);
    expect(playback.error()).toContain('could not be renewed');
    playback.stop();
  });
});

describe('PlaybackService latest request state', () => {
  it('does not let an older playback request clear the newer request loading state', async () => {
    const makeSession = (songId: string) => ({
      token: `token-${songId}`,
      sessionId: `session-${songId}`,
      expiresAt: '2099-01-01T00:00:00Z',
      songId,
    });
    let resolveFirst!: (value: ReturnType<typeof makeSession>) => void;
    let resolveSecond!: (value: ReturnType<typeof makeSession>) => void;
    const firstSession = new Promise<ReturnType<typeof makeSession>>((resolve) => resolveFirst = resolve);
    const secondSession = new Promise<ReturnType<typeof makeSession>>((resolve) => resolveSecond = resolve);
    const api = {
      user: vi.fn(() => ({ id: 'user-1' })),
      playbackSession: vi.fn()
        .mockImplementationOnce(() => firstSession)
        .mockImplementationOnce(() => secondSession),
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
    const first = { id: 'song-1', artistId: 'artist-1', name: 'First', artistName: 'Artist', imageKey: '', kind: 'song' as const };
    const second = { id: 'song-2', artistId: 'artist-2', name: 'Second', artistName: 'Artist', imageKey: '', kind: 'song' as const };

    const firstRequest = playback.play(first);
    const secondRequest = playback.play(second);
    resolveFirst(makeSession(first.id));
    await firstRequest;
    expect(playback.currentSong()?.id).toBe(second.id);
    expect(playback.loading()).toBe(true);

    resolveSecond(makeSession(second.id));
    await secondRequest;
    expect(playback.loading()).toBe(false);
    expect(playback.currentSong()?.id).toBe(second.id);
  });
});

describe('textLanguage', () => {
  it('uses Khmer language metadata only when Khmer script is present', () => {
    expect(textLanguage('សួស្តី')).toBe('km');
    expect(textLanguage('K-Song')).toBeNull();
    expect(textLanguage('Hello សួស្តី')).toBe('km');
  });
});
