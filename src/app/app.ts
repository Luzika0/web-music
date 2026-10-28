import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, PLATFORM_ID, ViewChild, effect, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MusicApiService } from './core/services/music-api.service';
import { getAppConfig } from './core/config/app-config';
import { PlaybackService } from './core/services/playback.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements AfterViewInit, OnDestroy {
  readonly api = inject(MusicApiService);
  readonly player = inject(PlaybackService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private hls: { destroy(): void } | null = null;
  private playbackGeneration = 0;
  private playerReady = false;
  busy = false;
  isPlaying = false;

  @ViewChild('audioElement') private audioElement?: ElementRef<HTMLAudioElement>;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const config = getAppConfig();
      document.documentElement.style.setProperty('--background-color', config.backgroundColor);
      document.documentElement.style.setProperty('--accent-color', config.accentColor);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', config.backgroundColor);
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
    }
  }

  ngAfterViewInit(): void {
    this.playerReady = true;
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

  private async attachStream(url: string, playbackToken: string): Promise<void> {
    const generation = ++this.playbackGeneration;
    const audio = this.audioElement?.nativeElement;
    if (!audio || !isPlatformBrowser(this.platformId)) {
      return;
    }
    this.hls?.destroy();
    this.hls = null;

    try {
      const HlsModule = await import('hls.js');
      if (generation !== this.playbackGeneration) {
        return;
      }
      const Hls = HlsModule.default;
      if (Hls.isSupported()) {
        const instance = new Hls({
          xhrSetup: (xhr) => {
            for (const [name, value] of Object.entries(this.api.playbackHeaders(playbackToken))) {
              xhr.setRequestHeader(name, value);
            }
          },
        });
        instance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (generation === this.playbackGeneration) {
            void audio.play().catch(() => {
              this.player.setError('Stream ready. Press play in the controls to start listening.');
            });
          }
        });
        instance.on(Hls.Events.ERROR, (_event, data) => {
          if (generation === this.playbackGeneration && data.fatal) {
            this.player.setError('The stream could not be loaded. Check your connection and try the track again.');
          }
        });
        instance.loadSource(url);
        instance.attachMedia(audio);
        this.hls = instance;
      } else {
        this.player.setError('This browser cannot send the required secure playback headers for HLS. Try a browser with HLS.js support.');
      }
    } catch {
      this.player.setError('Could not initialize the audio player. Try another browser.');
    }
  }
}
