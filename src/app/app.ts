import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MusicApiService } from './core/services/music-api.service';
import { getAppConfig } from './core/config/app-config';
import { PlaybackService } from './core/services/playback.service';
import { LibraryService } from './core/services/library.service';
import { textLanguage } from './shared/utils/text-language';
import { MediaImageComponent } from './shared/components/media-image.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MediaImageComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit, OnDestroy {
  readonly api = inject(MusicApiService);
  readonly player = inject(PlaybackService);
  readonly library = inject(LibraryService);
  readonly textLanguage = textLanguage;
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private hls: { destroy(): void } | null = null;
  private playbackGeneration = 0;
  private playerReady = false;
  busy = false;
  sidebarCollapsed = false;
  theme: 'dark' | 'light' = 'dark';

  @ViewChild('audioElement') private audioElement?: ElementRef<HTMLAudioElement>;

  get isNowPlaying(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/now-playing';
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const config = getAppConfig();
      try {
        this.theme = window.localStorage.getItem('ksong.theme.v1') === 'light' ? 'light' : 'dark';
      } catch {
        this.theme = 'dark';
      }
      this.applyTheme();
      document.documentElement.style.setProperty('--configured-background-color', config.backgroundColor);
      document.documentElement.style.setProperty('--configured-accent-color', config.accentColor);
      effect(() => {
        const manifestUrl = this.player.manifestUrl();
        const token = this.player.token();
        if (this.playerReady && manifestUrl && token) {
          void this.attachStream(manifestUrl, token);
        } else if (this.playerReady && !manifestUrl) {
          this.playbackGeneration += 1;
          this.hls?.destroy();
          this.hls = null;
          if (this.audioElement) {
            this.audioElement.nativeElement.pause();
            this.audioElement.nativeElement.removeAttribute('src');
            this.audioElement.nativeElement.load();
          }
        }
      });
      effect(() => {
        if (!this.api.user() && this.player.currentSong()) {
          this.player.stop();
        }
      });
    }
  }

  toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark';
    if (isPlatformBrowser(this.platformId)) {
      try {
        window.localStorage.setItem('ksong.theme.v1', this.theme);
      } catch {
        // Keep the theme switch usable when browser storage is unavailable.
      }
      this.applyTheme();
    }
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  ngAfterViewInit(): void {
    this.playerReady = true;
    if (this.audioElement) {
      this.player.bindAudioElement(this.audioElement.nativeElement);
    }
    const manifestUrl = this.player.manifestUrl();
    const token = this.player.token();
    if (manifestUrl && token) {
      void this.attachStream(manifestUrl, token);
    }
  }

  ngOnDestroy(): void {
    this.hls?.destroy();
  }

  async logout(): Promise<void> {
    this.busy = true;
    try {
      await this.api.logout();
      this.player.stop();
      await this.router.navigate(['/']);
    } catch (error) {
      this.api.notice.set(this.api.toUserMessage(error));
    } finally {
      this.busy = false;
      this.changeDetector.markForCheck();
    }
  }

  seekPlayback(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.player.seekTo(Number(input.value));
    }
  }

  onVolumeChange(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.player.setVolume(Number(input.value) / 100);
    }
  }

  handleTrackEnded(): void {
    this.player.setPlaying(false);
    this.player.playNext(true);
  }

  progressPercent(): number {
    const duration = this.player.duration();
    return duration > 0 ? Math.min(100, Math.max(0, (this.player.currentTime() / duration) * 100)) : 0;
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  private async attachStream(url: string, playbackToken: string): Promise<void> {
    const generation = ++this.playbackGeneration;
    const audio = this.audioElement?.nativeElement;
    if (!audio || !isPlatformBrowser(this.platformId)) {
      return;
    }
    this.hls?.destroy();
    this.hls = null;

    try {
      await this.api.ensureSessionReady();
      if (generation !== this.playbackGeneration) {
        return;
      }
      const HlsModule = await import('hls.js');
      if (generation !== this.playbackGeneration) {
        return;
      }
      const Hls = HlsModule.default;
      if (Hls.isSupported()) {
        let retriedUnauthorized = false;
        const instance = new Hls({
          xhrSetup: (xhr) => {
            for (const [name, value] of Object.entries(this.api.playbackHeaders(playbackToken))) {
              xhr.setRequestHeader(name, value);
            }
          },
        });
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (generation === this.playbackGeneration) {
            audio.volume = this.player.volume();
            audio.muted = this.player.isMuted();
            void audio.play().catch(() => {
              this.player.setError('Stream ready. Press play in the controls to start listening.');
            });
          }
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (generation === this.playbackGeneration && data.fatal) {
            if (data.response?.code === 401 && !retriedUnauthorized) {
              retriedUnauthorized = true;
              void this.api.refreshPlaybackAuthorization()
                .then(() => {
                  if (generation === this.playbackGeneration) {
                    instance.startLoad();
                  }
                })
                .catch((error: unknown) => {
                  this.player.setError(this.api.toUserMessage(error));
                });
            } else {
              this.player.setError('The stream could not be loaded. Check your connection and try the track again.');
            }
          }
        });
        instance.loadSource(url);
        instance.attachMedia(audio);
        this.hls = instance;
      } else {
        this.player.setError('This browser cannot send the required secure playback headers for HLS. Try a browser with HLS.js support.');
      }
    } catch (error) {
      this.player.setError(this.api.toUserMessage(error));
    }
  }

  private applyTheme(): void {
    document.documentElement.dataset['theme'] = this.theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      'content',
      this.theme === 'dark' ? getAppConfig().backgroundColor : '#ebebed',
    );
  }
}
