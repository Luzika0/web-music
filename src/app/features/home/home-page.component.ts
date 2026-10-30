import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MediaItem, MusicApiService } from '../../core/services/music-api.service';
import { PlaybackService } from '../../core/services/playback.service';
import { LibraryService } from '../../core/services/library.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { getAppConfig } from '../../core/config/app-config';
import { textLanguage } from '../../shared/utils/text-language';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, MediaImageComponent, AppIconComponent],
  template: `
    <section class="home-hero">
      <div class="home-copy">
        <p class="eyebrow">YOUR DAY, IN A DIFFERENT KEY</p>
        <h1>Find the feeling.<br /><em>Follow the sound.</em></h1>
        <p>Meet new artists, rediscover a mood, and make the soundtrack yours.</p>
        <div class="home-actions">
          <a class="button button-light" routerLink="/search"><app-icon name="external" /><span>Explore music</span></a>
          <a class="button button-quiet" routerLink="/artists"><app-icon name="artists" /><span>Meet the artists</span></a>
        </div>
      </div>
      <div class="home-record" aria-hidden="true"><span>k.</span></div>
      <span class="home-kicker">K-SONG / LISTEN YOUR WAY</span>
    </section>

    <section class="section-block home-shortcuts" aria-label="Your shortcuts">
      <a class="shortcut-card liked-shortcut" routerLink="/liked">
        <span class="shortcut-icon" aria-hidden="true"><app-icon name="heart" /></span>
        <span><strong>Liked Songs</strong><small>{{ library.likedSongs().length }} saved on this device</small></span>
        <span class="shortcut-arrow" aria-hidden="true"><app-icon name="external" /></span>
      </a>
      <a class="shortcut-card" routerLink="/library">
        <span class="shortcut-icon library-icon" aria-hidden="true"><app-icon name="library" /></span>
        <span><strong>Your Library</strong><small>Collections and saved music</small></span>
        <span class="shortcut-arrow" aria-hidden="true"><app-icon name="external" /></span>
      </a>
    </section>

    <section class="section-block" aria-labelledby="home-songs-heading">
      <div class="section-heading">
        <div><p class="eyebrow">A PLACE TO START</p><h2 id="home-songs-heading">Fresh from the catalog</h2></div>
        <a class="section-link" routerLink="/search">Find more <app-icon name="next" /></a>
      </div>
      @if (loading) {
        <div class="home-song-grid" role="status" aria-label="Loading music">
          @for (placeholder of placeholders; track placeholder) { <div class="home-song-card"><span class="skeleton home-cover-skeleton"></span><span class="skeleton line-skeleton"></span></div> }
        </div>
      } @else if (error) {
        <div class="inline-alert error-alert" role="alert">{{ error }} <button class="text-button" type="button" (click)="retry()" [disabled]="loading">Try again</button> <a class="text-button" routerLink="/search">Browse Search</a></div>
      } @else if (songs.length) {
        <div class="home-song-grid">
          @for (song of songs; track song.id || $index) {
            <article class="home-song-card">
              <button class="home-cover" type="button" [style.background]="colorFor(song)" [disabled]="!song.id" [attr.aria-label]="'Play ' + song.name" (click)="player.play(song, songs)">
                <app-icon name="music" /><app-media-image [imageKey]="song.imageKey" [alt]="''" /><span class="home-cover-play" aria-hidden="true">▶</span>
              </button>
              <div class="home-song-meta" [attr.lang]="textLanguage(song.name, song.artistName)"><strong>{{ song.name }}</strong><span>{{ song.artistName || 'Artist details unavailable' }}</span></div>
              <button class="like-button" type="button" [disabled]="!song.id" [class.liked]="library.isLiked(song.id)" [attr.aria-label]="library.isLiked(song.id) ? 'Remove ' + song.name + ' from Liked Songs' : 'Add ' + song.name + ' to Liked Songs'" [attr.aria-pressed]="library.isLiked(song.id)" (click)="library.toggleLike(song)"><app-icon name="heart" /></button>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state"><span class="empty-icon" aria-hidden="true"><app-icon name="music" size="30" /></span><h3>The catalog is taking a quiet moment</h3><p>Browse artists or try again when the service is available.</p><a class="button button-quiet" routerLink="/artists">Browse artists</a></div>
      }
    </section>

    <section class="section-block home-artists" aria-labelledby="home-artists-heading">
      <div class="section-heading">
        <div><p class="eyebrow">MADE BY PEOPLE, FELT BY EVERYONE</p><h2 id="home-artists-heading">Artists to know</h2></div>
        <a class="section-link" routerLink="/artists">All artists <app-icon name="next" /></a>
      </div>
      @if (artistsError) { <div class="inline-alert error-alert" role="alert">{{ artistsError }} <button class="text-button" type="button" (click)="retry()" [disabled]="loading">Try again</button></div> }
      <div class="home-artist-grid">
        @for (artist of artists; track artist.id || $index) {
          <a class="home-artist-card" routerLink="/artists" [queryParams]="{ search: artist.name }">
            <span class="home-artist-art" [style.background]="colorFor(artist)"><span>{{ initial(artist.name) }}</span><app-media-image [imageKey]="artist.imageKey" [alt]="artist.name + ' artist portrait'" /></span>
            <strong [attr.lang]="textLanguage(artist.name)">{{ artist.name }}</strong><small>Artist</small>
          </a>
        } @empty {
          <div class="inline-alert info-alert">Discover the full artist directory and search for a sound you love.</div>
        }
      </div>
    </section>
  `,
})
export class HomePageComponent implements OnInit {
  readonly player = inject(PlaybackService);
  readonly library = inject(LibraryService);
  readonly textLanguage = textLanguage;
  private readonly api = inject(MusicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private requestGeneration = 0;
  private readonly pageSize = getAppConfig().pageSize;
  readonly placeholders = [0, 1, 2, 3];
  songs: MediaItem[] = [];
  artists: MediaItem[] = [];
  loading = true;
  error = '';
  artistsError = '';

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) void this.load();
    else this.loading = false;
  }

  retry(): void {
    if (!this.loading) void this.load();
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

  private async load(): Promise<void> {
    const generation = ++this.requestGeneration;
    this.loading = true;
    this.error = '';
    this.artistsError = '';
    try {
      const [songs, artists] = await Promise.allSettled([
        this.api.songs(0, 4),
        this.api.artists(0, 4, ''),
      ]);
      if (generation !== this.requestGeneration) return;
      this.songs = songs.status === 'fulfilled' ? songs.value.items : [];
      this.artists = artists.status === 'fulfilled' ? artists.value.items : [];
      this.error = songs.status === 'rejected' ? this.api.toUserMessage(songs.reason) : '';
      this.artistsError = artists.status === 'rejected' ? this.api.toUserMessage(artists.reason) : '';
    } finally {
      if (generation === this.requestGeneration) {
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    }
  }
}
