import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MediaItem, MusicApiService } from '../../core/services/music-api.service';
import { PlaybackService } from '../../core/services/playback.service';
import { LibraryService } from '../../core/services/library.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';
import { getAppConfig } from '../../core/config/app-config';
import { textLanguage } from '../../shared/utils/text-language';

@Component({
  selector: 'app-search-page',
  imports: [FormsModule, RouterLink, MediaImageComponent],
  template: `
    <section class="catalog-page">
      <header class="catalog-heading">
        <p class="eyebrow">FOLLOW A SOUND, FIND A WORLD</p>
        <h1>Search <em>music.</em></h1>
        <p>Look up artists and tracks from the K-Song catalog.</p>
      </header>
      <form class="catalog-search" role="search" (ngSubmit)="search()">
        <label class="sr-only" for="catalog-query">Search songs and artists</label>
        <span class="catalog-search-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg></span>
        <input id="catalog-query" name="query" type="search" [(ngModel)]="query" placeholder="What are you in the mood for?" autocomplete="off" />
        <button class="button button-light" type="submit" [disabled]="loading || !query.trim()" [attr.aria-busy]="loading">
          @if (loading) { <span class="button-loading-spinner" aria-hidden="true"></span> }
          <span>{{ loading ? 'Searching…' : 'Search' }}</span>
        </button>
        @if (query) { <button class="button button-quiet search-clear-button" type="button" (click)="clearSearch()" [disabled]="loading">Clear</button> }
      </form>

      @if (error) {
        <div class="inline-alert error-alert" role="alert">{{ error }} <button class="text-button" type="button" (click)="retrySearch()">Try again</button></div>
      } @else if (!hasSearched) {
        <div class="search-welcome"><span class="search-welcome-icon" aria-hidden="true">♫</span><h2>Start with a name, a song, or a feeling.</h2><p>Search uses the current K-Song music catalog. Results depend on what the backend currently provides.</p></div>
      } @else if (loading) {
        <div class="inline-alert info-alert" role="status">Finding a few good matches…</div>
      } @else if (!songs.length && !artists.length) {
        <div class="empty-state"><span class="empty-icon" aria-hidden="true">⌕</span><h2>No matches yet</h2><p>Try a shorter search or a different spelling.</p></div>
      } @else {
        @if (songs.length) {
          <section class="search-results-section" aria-labelledby="search-songs-heading">
            <div class="section-heading"><div><p class="eyebrow">TRACKS</p><h2 id="search-songs-heading">Songs</h2></div><span class="section-note">{{ songs.length }} shown</span></div>
            <div class="song-list">
              @for (song of songs; track song.id || $index) {
                <article class="song-row">
                  <button class="song-cover" type="button" [style.background]="colorFor(song)" [disabled]="!song.id || player.loading()" [attr.aria-label]="'Play ' + song.name" (click)="player.play(song, songs)">
                    <span aria-hidden="true">♫</span><app-media-image [imageKey]="song.imageKey" [alt]="''" /><span class="play-overlay" aria-hidden="true">▶</span>
                  </button>
                  <div class="song-details" [attr.lang]="textLanguage(song.name, song.artistName)"><h3>{{ song.name }}</h3><span>{{ song.artistName || 'Artist details unavailable' }}</span></div>
                  <button class="like-button" type="button" [disabled]="!song.id" [class.liked]="library.isLiked(song.id)" [attr.aria-pressed]="library.isLiked(song.id)" [attr.aria-label]="library.isLiked(song.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'" (click)="library.toggleLike(song)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.8 1.8Z" /></svg></button>
                  <button class="play-button" type="button" [disabled]="!song.id || player.loading()" (click)="player.play(song, songs)" [attr.aria-label]="'Play ' + song.name"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z" /></svg></button>
                </article>
              }
            </div>
          </section>
        }
        @if (artists.length) {
          <section class="search-results-section" aria-labelledby="search-artists-heading">
            <div class="section-heading"><div><p class="eyebrow">CREATORS</p><h2 id="search-artists-heading">Artists</h2></div><span class="section-note">{{ artists.length }} shown</span></div>
            <div class="artist-grid">
              @for (artist of artists; track artist.id || $index) {
                <article class="artist-card">
                  <a class="search-artist-link" [routerLink]="['/artists']" [queryParams]="{ search: artist.name }" [attr.aria-label]="'Find music by ' + artist.name">
                  <div class="artist-art" [style.background]="colorFor(artist)"><span>{{ initial(artist.name) }}</span><app-media-image [imageKey]="artist.imageKey" [alt]="artist.name + ' artist portrait'" /></div>
                  <div class="artist-info" [attr.lang]="textLanguage(artist.name)"><h3>{{ artist.name }}</h3><span>Artist · Find music →</span></div>
                  </a>
                </article>
              }
            </div>
          </section>
        }
      }
      @if (partialError) { <div class="inline-alert info-alert" role="status">{{ partialError }}</div> }
    </section>
  `,
})
export class SearchPageComponent implements OnInit {
  readonly player = inject(PlaybackService);
  readonly library = inject(LibraryService);
  readonly textLanguage = textLanguage;
  private readonly api = inject(MusicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pageSize = getAppConfig().pageSize;
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  query = '';
  songs: MediaItem[] = [];
  artists: MediaItem[] = [];
  loading = false;
  hasSearched = false;
  error = '';
  partialError = '';
  private searchGeneration = 0;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.query = params.get('q') ?? '';
      const term = this.query.trim();
      if (term) void this.runSearch(term);
      else {
        this.searchGeneration += 1;
        this.songs = [];
        this.artists = [];
        this.loading = false;
        this.hasSearched = false;
        this.error = '';
        this.partialError = '';
      }
    });
  }

  search(): void {
    const term = this.query.trim();
    if (!term) {
      this.clearSearch();
      return;
    }
    if (term === (this.route.snapshot.queryParamMap.get('q') ?? '')) {
      void this.runSearch(term);
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: term },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }

  retrySearch(): void {
    const term = this.query.trim();
    if (term && !this.loading) void this.runSearch(term);
  }

  clearSearch(): void {
    this.query = '';
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }

  private async runSearch(term: string): Promise<void> {
    const generation = ++this.searchGeneration;
    this.loading = true;
    this.hasSearched = true;
    this.error = '';
    this.partialError = '';
    try {
      const [songs, artists] = await Promise.allSettled([
        this.api.songs(0, this.pageSize, term),
        this.api.artists(0, this.pageSize, term),
      ]);
      if (generation !== this.searchGeneration) return;
      this.songs = songs.status === 'fulfilled' ? songs.value.items : [];
      this.artists = artists.status === 'fulfilled' ? artists.value.items : [];
      if (songs.status === 'rejected' && artists.status === 'rejected') {
        this.error = this.api.toUserMessage(songs.reason);
      } else if (songs.status === 'rejected' || artists.status === 'rejected') {
        this.partialError = 'Some catalog results could not be loaded. The available results are shown below.';
      }
    } finally {
      if (generation === this.searchGeneration) {
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  colorFor(item: MediaItem): string {
    const colors = ['#7b477d', '#a25748', '#35717a', '#9c7542', '#4b5793'];
    const seed = item.id || item.name;
    return colors[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  }

  initial(name: string): string {
    return name.trim().slice(0, 1).toUpperCase() || 'K';
  }
}
