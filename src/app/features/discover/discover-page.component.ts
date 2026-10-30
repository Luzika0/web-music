import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MediaItem, MediaPage, MusicApiService } from '../../core/services/music-api.service';
import { LibraryService } from '../../core/services/library.service';
import { PlaybackService } from '../../core/services/playback.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';
import { textLanguage } from '../../shared/utils/text-language';
import { getAppConfig } from '../../core/config/app-config';

@Component({
  selector: 'app-discover-page',
  imports: [FormsModule, RouterLink, DecimalPipe, MediaImageComponent],
  template: `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">YOUR NEXT FAVORITE IS HERE</p>
        <h1>A little more <em>music.</em><br />A lot more you.</h1>
        <p class="hero-lead">Find the sounds that feel like your own. Fresh voices, familiar moods, all in one place.</p>
        <a class="button button-light hero-action" [routerLink]="api.user() ? '/search' : '/register'">{{ api.user() ? 'Explore music' : 'Find your sound' }} <span aria-hidden="true">↗</span></a>
      </div>
      <div class="hero-art" aria-hidden="true">
        <span class="orbit orbit-one"></span><span class="orbit orbit-two"></span>
        <span class="hero-disc"></span><span class="hero-spark">♫</span>
        <span class="hero-caption">SOUND<br />IN COLOR</span>
      </div>
      <span class="hero-index" aria-hidden="true">K-SONG / DISCOVERY</span>
    </section>

    <section class="section-block artists-section" aria-labelledby="artists-heading">
      <div class="section-heading">
        <div>
          <p class="eyebrow">MEET THE MAKERS</p>
          <h2 id="artists-heading">Artists to know</h2>
        </div>
        <form class="search-form" (ngSubmit)="searchArtists()" role="search">
          <label class="sr-only" for="artist-search">Search artists</label>
          <input id="artist-search" name="artistSearch" type="search" [(ngModel)]="artistSearch"
            placeholder="Search artists" autocomplete="off" />
          <button type="submit" class="button button-light" [attr.aria-busy]="artistsLoading">
            @if (artistsLoading) { <span class="button-loading-spinner" aria-hidden="true"></span> }
            <span>{{ artistsLoading ? 'Searching…' : 'Search' }}</span>
          </button>
        </form>
      </div>
      @if (artistsError) {
        <div class="inline-alert error-alert" role="alert">{{ artistsError }} <button type="button" class="text-button" (click)="loadArtists()">Try again</button></div>
      } @else if (artistsLoading && !artistsPage) {
        <div class="artist-grid" role="status" aria-label="Loading artists">
          @for (placeholder of placeholders; track placeholder) {
            <div class="artist-card skeleton-card"><div class="skeleton artist-skeleton"></div><div class="skeleton line-skeleton"></div></div>
          }
        </div>
      } @else if (artistsPage?.items?.length) {
        <div class="artist-grid">
          @for (artist of artistsPage?.items; track artist.id || $index) {
            <article class="artist-card">
              <a class="discover-artist-link" [routerLink]="['/artists']" [queryParams]="{ search: artist.name }" [attr.aria-label]="'Browse ' + artist.name">
              <div class="artist-art" [style.background]="colorFor(artist)" aria-hidden="true">
                <span>{{ initial(artist.name) }}</span>
                <app-media-image [imageKey]="artist.imageKey" [alt]="artist.name + ' artist portrait'" />
              </div>
              <div class="artist-info"><h3>{{ artist.name }}</h3><span>Artist · Explore music →</span></div>
              </a>
            </article>
          }
        </div>
        @if (artistsPage?.totalPages !== 1) {
          <div class="pagination">
            <button type="button" class="button button-quiet" (click)="changeArtistPage(-1)" [disabled]="artistPage === 0 || artistsLoading">← Previous</button>
            <span aria-live="polite" aria-atomic="true">Page {{ artistPage + 1 }}{{ artistsPage?.totalPages ? ' of ' + artistsPage?.totalPages : '' }}</span>
            <button type="button" class="button button-quiet" (click)="changeArtistPage(1)" [disabled]="artistsLoading || !canGoNext(artistsPage)">Next →</button>
          </div>
        }
      } @else if (!artistsLoading) {
        <div class="empty-state"><span class="empty-icon" aria-hidden="true">◌</span><h3>No artists found</h3><p>Try a different search, or check back when more artists arrive.</p></div>
      }
    </section>

    <section class="section-block songs-section" aria-labelledby="songs-heading">
      <div class="section-heading">
        <div><p class="eyebrow">PRESS PLAY, FEEL SOMETHING</p><h2 id="songs-heading">Songs for right now</h2></div>
        <span class="section-note">A good soundtrack starts here.</span>
      </div>
      @if (songsError) {
        <div class="inline-alert error-alert" role="alert">{{ songsError }} <button type="button" class="text-button" (click)="loadSongs()">Try again</button></div>
      } @else if (songsLoading && !songsPage) {
        <div class="song-list" role="status" aria-label="Loading songs">
          @for (placeholder of placeholders; track placeholder) {
            <div class="song-row"><span class="skeleton song-skeleton"></span><span class="skeleton line-skeleton"></span><span class="skeleton line-skeleton short-line"></span></div>
          }
        </div>
      } @else if (songsPage?.items?.length) {
        <div class="song-list">
          @for (song of songsPage?.items; track song.id || $index; let index = $index) {
            <article class="song-row">
              <button class="song-row-main" type="button" [attr.lang]="textLanguage(song.name, song.artistName)" [disabled]="!song.id"
                [class.is-current]="player.currentSong()?.id === song.id"
                [attr.aria-label]="song.id ? 'Play ' + song.name + (song.artistName ? ' by ' + song.artistName : '') : song.name + ' — playback unavailable'"
                (click)="player.play(song, songsPage?.items ?? [])">
                <span class="song-number">{{ (songPage * pageSize) + index + 1 | number:'2.0' }}</span>
                <span class="song-cover" [style.background]="colorFor(song)">
                <span aria-hidden="true">♫</span>
                <app-media-image [imageKey]="song.imageKey" [alt]="''" />
                <span class="play-overlay" aria-hidden="true">▶</span>
                </span>
                <span class="song-details">
                  <span class="song-title">{{ song.name }}</span>
                  <span>{{ song.artistName || 'Artist details unavailable' }}</span>
                  @if (!song.id) { <span class="song-unavailable">Playback unavailable</span> }
                </span>
              </button>
              <button class="like-button" type="button" [class.liked]="library.isLiked(song.id)" [disabled]="!song.id" [attr.aria-pressed]="library.isLiked(song.id)" [attr.aria-label]="library.isLiked(song.id) ? 'Remove ' + song.name + ' from Liked Songs' : 'Add ' + song.name + ' to Liked Songs'" (click)="library.toggleLike(song)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.8 1.8Z" /></svg></button>
              <button class="play-button" type="button" [disabled]="!song.id" [attr.aria-busy]="player.loading() && player.currentSong()?.id === song.id" (click)="player.play(song, songsPage?.items ?? [])" [attr.aria-label]="'Play ' + song.name">
                @if (player.loading() && player.currentSong()?.id === song.id) { <span class="play-button-loading-spinner" aria-hidden="true"></span> }
                @else { <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z" /></svg> }
              </button>
            </article>
          }
        </div>
        @if (songsPage?.totalPages !== 1) {
          <div class="pagination">
            <button type="button" class="button button-quiet" (click)="changeSongPage(-1)" [disabled]="songPage === 0 || songsLoading">← Previous</button>
            <span aria-live="polite" aria-atomic="true">Page {{ songPage + 1 }}{{ songsPage?.totalPages ? ' of ' + songsPage?.totalPages : '' }}</span>
            <button type="button" class="button button-quiet" (click)="changeSongPage(1)" [disabled]="songsLoading || !canGoNext(songsPage)">Next →</button>
          </div>
        }
      } @else if (!songsLoading) {
        <div class="empty-state"><span class="empty-icon" aria-hidden="true">♫</span><h3>No songs just yet</h3><p>There’s room for something wonderful. Check back soon.</p></div>
      }
      @if (player.error()) { <p class="inline-alert error-alert" role="status">{{ player.error() }}</p> }
    </section>
    <footer class="footer"><span class="footer-brand">k.</span><span>Good things sound better together.</span><span>© 2026 K-Song</span></footer>
  `,
})
export class DiscoverPageComponent implements OnInit {
  readonly api = inject(MusicApiService);
  readonly player = inject(PlaybackService);
  readonly library = inject(LibraryService);
  private readonly config = getAppConfig();
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly placeholders = [0, 1, 2, 3];
  readonly textLanguage = textLanguage;
  readonly pageSize = this.config.pageSize;
  artistsPage: MediaPage | null = null;
  songsPage: MediaPage | null = null;
  private readonly artistNames = new Map<string, string>();
  private artistRequestGeneration = 0;
  private songRequestGeneration = 0;
  private lastArtistRouteKey: string | null = null;
  private lastSongRouteKey: string | null = null;
  artistPage = 0;
  songPage = 0;
  artistSearch = '';
  artistsLoading = true;
  songsLoading = true;
  artistsError = '';
  songsError = '';

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.artistsLoading = false;
      this.songsLoading = false;
      return;
    }
    if (this.api.user()) void this.library.loadFavorites().catch(() => undefined);\n    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const artistPage = Number(params.get('artistPage') ?? 0);
      const songPage = Number(params.get('songPage') ?? 0);
      this.artistPage = Number.isInteger(artistPage) && artistPage >= 0 ? artistPage : 0;
      this.songPage = Number.isInteger(songPage) && songPage >= 0 ? songPage : 0;
      this.artistSearch = params.get('artist') ?? '';
      const artistRouteKey = `${this.artistPage}|${this.artistSearch.trim()}`;
      const songRouteKey = String(this.songPage);
      if (artistRouteKey !== this.lastArtistRouteKey) {
        this.lastArtistRouteKey = artistRouteKey;
        void this.loadArtists();
      }
      if (songRouteKey !== this.lastSongRouteKey) {
        this.lastSongRouteKey = songRouteKey;
        void this.loadSongs();
      }
    });
  }

  async loadArtists(): Promise<void> {
    const generation = ++this.artistRequestGeneration;
    const requestedPage = this.artistPage;
    const requestedSearch = this.artistSearch.trim();
    this.artistsLoading = true;
    this.artistsError = '';
    try {
      const result = await this.api.artists(requestedPage, this.pageSize, requestedSearch);
      if (generation !== this.artistRequestGeneration) return;
      this.artistsPage = result;
      for (const artist of result.items) {
        if (artist.id && artist.name) {
          this.artistNames.set(artist.id, artist.name);
        }
      }
      this.enrichSongArtists();
    } catch (error) {
      if (generation === this.artistRequestGeneration) this.artistsError = this.api.toUserMessage(error);
    } finally {
      if (generation === this.artistRequestGeneration) {
        this.artistsLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  async loadSongs(): Promise<void> {
    const generation = ++this.songRequestGeneration;
    const requestedPage = this.songPage;
    this.songsLoading = true;
    this.songsError = '';
    try {
      const result = await this.api.songs(requestedPage, this.pageSize);
      if (generation !== this.songRequestGeneration) return;
      this.songsPage = result;
      this.enrichSongArtists();
    } catch (error) {
      if (generation === this.songRequestGeneration) this.songsError = this.api.toUserMessage(error);
    } finally {
      if (generation === this.songRequestGeneration) {
        this.songsLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  searchArtists(): void {
    const term = this.artistSearch.trim();
    if (term === (this.route.snapshot.queryParamMap.get('artist') ?? '')
      && this.artistPage === 0) {
      void this.loadArtists();
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { artist: term || null, artistPage: null },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }

  changeArtistPage(delta: number): void {
    const nextPage = Math.max(0, this.artistPage + delta);
    if (nextPage === this.artistPage) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { artistPage: nextPage || null },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }

  changeSongPage(delta: number): void {
    const nextPage = Math.max(0, this.songPage + delta);
    if (nextPage === this.songPage) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { songPage: nextPage || null },
      queryParamsHandling: 'merge',
      replaceUrl: false,
    });
  }

  canGoNext(page: MediaPage | null): boolean {
    return !!page && (page.totalPages === null ? page.items.length === this.pageSize : page.page + 1 < page.totalPages);
  }

  initial(name: string): string {
    return name.trim().slice(0, 1).toUpperCase() || 'K';
  }

  colorFor(item: MediaItem): string {
    const palettes = [
      'linear-gradient(145deg, #f8b195, #b83b5e)',
      'linear-gradient(145deg, #6c5b7b, #355c7d)',
      'linear-gradient(145deg, #99b898, #2a5b84)',
      'linear-gradient(145deg, #f6d365, #fda085)',
      'linear-gradient(145deg, #a18cd1, #fbc2eb)',
    ];
    const seed = item.id || item.name;
    const index = [...seed].reduce((total, character) => total + character.charCodeAt(0), 0);
    return palettes[index % palettes.length];
  }

  private enrichSongArtists(): void {
    if (!this.songsPage) {
      return;
    }
    this.songsPage = {
      ...this.songsPage,
      items: this.songsPage.items.map((song) => ({
        ...song,
        artistName: song.artistName || this.artistNames.get(song.artistId) || '',
      })),
    };
  }
}
