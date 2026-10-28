import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { MusicApiService } from '../../core/services/music-api.service';

@Component({
  selector: 'app-media-image',
  standalone: true,
  template: `
    <span class="artwork-frame" [class.is-loading]="loading" [class.has-image]="imageReady" [class.has-error]="failed" [attr.aria-busy]="loading">
      <span class="artwork-placeholder" aria-hidden="true">
        <span class="artwork-record"><svg viewBox="0 0 24 24"><path d="M12 3v12.2a3.3 3.3 0 1 1-2-3V7l10-2v8.2a3.3 3.3 0 1 1-2-3V3z" /></svg></span>
        <span class="artwork-equalizer"><i></i><i></i><i></i><i></i></span>
        @if (loading) {
          <span class="artwork-shimmer"></span>
        }
      </span>
      @if (source) {
        <img [src]="source" [alt]="alt" loading="lazy" decoding="async" (load)="onImageLoad()" (error)="onImageError()" />
      }
    </span>
  `,
  styles: [`
    :host { position: absolute; inset: 0; display: block; overflow: hidden; pointer-events: none; }
    .artwork-frame, .artwork-placeholder { position: absolute; inset: 0; overflow: hidden; }
    .artwork-placeholder {
      display: grid;
      place-items: center;
      background:
        radial-gradient(ellipse at 75% 22%, rgba(128, 111, 255, .4), transparent 48%),
        radial-gradient(ellipse at 22% 78%, rgba(71, 207, 176, .32), transparent 50%),
        linear-gradient(145deg, #121443, #25235e 55%, #10112e);
    }
    .artwork-record {
      display: grid;
      width: 48%;
      aspect-ratio: 1;
      place-items: center;
      border: 1px solid rgba(255,255,255,.28);
      border-radius: 50%;
      background: repeating-radial-gradient(circle, rgba(255,255,255,.08) 0 1px, transparent 2px 6px), radial-gradient(circle at 35% 30%, #7772ce, #35336f 58%, #17163f);
      box-shadow: 0 12px 32px rgba(0,0,0,.32), inset 0 0 0 5px rgba(10,10,42,.35);
      animation: artwork-float 3.2s ease-in-out infinite;
    }
    .artwork-record svg { width: 28%; height: 28%; fill: #f2f2f7; filter: drop-shadow(0 2px 8px rgba(0,0,0,.3)); }
    .artwork-equalizer { position: absolute; right: 12%; bottom: 12%; display: flex; height: 18%; align-items: end; gap: 3px; opacity: .8; }
    .artwork-equalizer i { width: 3px; height: 38%; border-radius: 3px; background: #d9e8ff; animation: artwork-wave .8s ease-in-out infinite alternate; }
    .artwork-equalizer i:nth-child(2) { height: 82%; animation-delay: .18s; }
    .artwork-equalizer i:nth-child(3) { height: 58%; animation-delay: .35s; }
    .artwork-equalizer i:nth-child(4) { height: 100%; animation-delay: .1s; }
    .artwork-shimmer { position: absolute; inset: -35%; background: linear-gradient(110deg, transparent 40%, rgba(255,255,255,.12) 50%, transparent 60%); animation: artwork-shine 1.8s ease-in-out infinite; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 360ms ease; }
    .has-image img { opacity: 1; }
    .has-image .artwork-placeholder { opacity: 0; transition: opacity 360ms ease; }
    .has-error .artwork-record { animation: none; }
    @keyframes artwork-shine { to { transform: translateX(55%); } }
    @keyframes artwork-wave { to { height: 24%; } }
    @keyframes artwork-float { 50% { transform: translateY(-4px) rotate(5deg); } }
    @media (prefers-reduced-motion: reduce) {
      .artwork-record, .artwork-equalizer i, .artwork-shimmer { animation: none; }
      img, .has-image .artwork-placeholder { transition: none; }
    }
  `],
})
export class MediaImageComponent implements OnChanges, OnDestroy {
  @Input() imageKey = '';
  @Input() alt = '';
  source = '';
  loading = false;
  imageReady = false;
  failed = false;

  private readonly api = inject(MusicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private version = 0;

  ngOnChanges(): void {
    const version = ++this.version;
    this.revokeSource();
    this.imageReady = false;
    this.failed = false;
    this.loading = isPlatformBrowser(this.platformId) && Boolean(this.imageKey && this.api.user());
    if (!this.loading) {
      return;
    }

    void this.api.imageBlob(this.imageKey).then((image) => {
      if (version !== this.version) {
        return;
      }
      this.source = URL.createObjectURL(image);
      this.loading = false;
      this.changeDetector.markForCheck();
    }).catch(() => {
      if (version === this.version) {
        this.source = '';
        this.loading = false;
        this.failed = true;
        this.changeDetector.markForCheck();
      }
    });
  }

  onImageLoad(): void {
    this.imageReady = true;
    this.changeDetector.markForCheck();
  }

  onImageError(): void {
    this.revokeSource();
    this.failed = true;
    this.imageReady = false;
    this.changeDetector.markForCheck();
  }

  ngOnDestroy(): void {
    this.version += 1;
    this.revokeSource();
  }

  private revokeSource(): void {
    if (this.source && isPlatformBrowser(this.platformId)) {
      URL.revokeObjectURL(this.source);
    }
    this.source = '';
    this.imageReady = false;
  }
}
