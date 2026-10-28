import { isPlatformBrowser } from '@angular/common';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MediaItem, MediaPage, MusicApiService } from '../../core/services/music-api.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';
import { getAppConfig } from '../../core/config/app-config';
import { textLanguage } from '../../shared/utils/text-language';

@Component({
  selector: 'app-artists-page',
  imports: [FormsModule, RouterLink, MediaImageComponent],
  template: `
    <section class="catalog-page">
      <header class="catalog-heading">
        <p class="eyebrow">THE PEOPLE BEHIND THE SOUND</p>
        <h1>Artists <em>to know.</em></h1>
        <p>Browse the K-Song artist catalog and find your next favorite voice.</p>
      </header>
      <form class="catalog-search" role="search" (ngSubmit)="search()">
        <label class="sr-only" for="artist-directory-search">Search artists</label>
        <span class="catalog-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg></span>
        <input id="artist-directory-search" name="artistSearch" type="search" [(ngModel)]="searchText" placeholder="Search artist names" autocomplete="off" />
        <button class="button button-light" type="submit" [disabled]="loading" [attr.aria-busy]="loading">{{ loading ? 'Searching…' : 'Search' }}</button>
      </form>
      @if (error) {
        <div class="inline-alert error-alert" role="alert">{{ error }} <button type="button" class="text-button" (click)="load()">Try again</button></div>
      } @else if (loading && !page) {
        <div class="artist-grid" aria-label="Loading artists">
          @for (placeholder of placeholders; track placeholder) { <div class="artist-card"><span class="skeleton artist-skeleton"></span><span class="skeleton line-skeleton"></span></div> }
        </div>
      } @else if (page?.items?.length) {
        <div class="artist-directory-grid">
          @for (artist of page?.items; track artist.id || $index) {
            <article class="directory-artist">
              <div class="directory-artist-art" [style.background]="colorFor(artist)"><span>{{ initial(artist.name) }}</span><app-media-image [imageKey]="artist.imageKey" [alt]="artist.name + ' artist portrait'" /></div>
              <div class="directory-artist-copy"><p class="eyebrow">K-SONG ARTIST</p><h2 [attr.lang]="textLanguage(artist.name)">{{ artist.name }}</h2><p>Discover their music in the catalog.</p><a class="button button-quiet" [routerLink]="['/search']" [queryParams]="{ q: artist.name }">Find their music <span aria-hidden="true">→</span></a></div>
            </article>
          }
        </div>
        @if (page?.totalPages !== 1) {
          <div class="pagination">
            <button type="button" class="button button-quiet" (click)="changePage(-1)" [disabled]="pageNumber === 0 || loading">← Previous</button>
            <span>Page {{ pageNumber + 1 }}{{ page?.totalPages ? ' of ' + page?.totalPages : '' }}</span>
            <button type="button" class="button button-quiet" (click)="changePage(1)" [disabled]="loading || !canGoNext()">Next →</button>
          </div>
        }
      } @else if (!loading) {
        <div class="empty-state"><span class="empty-icon" aria-hidden="true">♫</span><h2>No artists found</h2><p>There are no artists in this page yet. Check back later.</p><a class="button button-light" routerLink="/search">Search the catalog</a></div>
      }
    </section>
  `,
})
export class ArtistsPageComponent implements OnInit {
  private readonly api = inject(MusicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly pageSize = getAppConfig().pageSize;
  readonly textLanguage = textLanguage;
  readonly placeholders = [0, 1, 2, 3, 4, 5];
  page: MediaPage | null = null;
  pageNumber = 0;
  searchText = '';
  loading = true;
  error = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading = false;
      return;
    }
    this.route.queryParamMap.subscribe((params) => {
      this.searchText = params.get('search') ?? '';
      this.pageNumber = 0;
      void this.load();
    });
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      this.page = await this.api.artists(this.pageNumber, this.pageSize, this.searchText);
    } catch (error) {
      this.error = this.api.toUserMessage(error);
    } finally {
      this.loading = false;
    }
  }

  search(): void {
    this.pageNumber = 0;
    void this.load();
  }

  changePage(delta: number): void {
    this.pageNumber = Math.max(0, this.pageNumber + delta);
    void this.load();
  }

  canGoNext(): boolean {
    return !!this.page && (this.page.totalPages === null
      ? this.page.items.length === this.pageSize
      : this.page.page + 1 < this.page.totalPages);
  }

  initial(name: string): string { return name.trim().slice(0, 1).toUpperCase() || 'K'; }

  colorFor(item: MediaItem): string {
    const colors = ['#7b477d', '#a25748', '#35717a', '#9c7542', '#4b5793'];
    const seed = item.id || item.name;
    return colors[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  }
}
