import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { MusicApiService } from '../../core/services/music-api.service';

@Component({
  selector: 'app-media-image',
  standalone: true,
  template: `
    @if (source) {
      <img [src]="source" [alt]="alt" loading="lazy" decoding="async" />
    }
  `,
})
export class MediaImageComponent implements OnChanges, OnDestroy {
  @Input() imageKey = '';
  @Input() alt = '';
  source = '';

  private readonly api = inject(MusicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private version = 0;

  ngOnChanges(): void {
    const version = ++this.version;
    this.revokeSource();
    if (!isPlatformBrowser(this.platformId) || !this.imageKey || !this.api.user()) {
      return;
    }

    void this.api.imageBlob(this.imageKey).then((image) => {
      if (version !== this.version) {
        return;
      }
      this.source = URL.createObjectURL(image);
      this.changeDetector.markForCheck();
    }).catch(() => {
      if (version === this.version) {
        this.source = '';
        this.changeDetector.markForCheck();
      }
    });
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
  }
}
