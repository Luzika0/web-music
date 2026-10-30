import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlaybackService } from '../../core/services/playback.service';
import { LibraryService } from '../../core/services/library.service';
import { MusicApiService, MediaItem } from '../../core/services/music-api.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';
import { textLanguage } from '../../shared/utils/text-language';

@Component({
  selector: 'app-liked-songs-page',
  imports: [RouterLink, MediaImageComponent],
  template: `
    <section class="liked-page">
      <header class="liked-hero">
        <span class="liked-art liked-page-art" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.8 1.8Z" /></svg></span>
        <div><p class="eyebrow">YOUR ACCOUNT COLLECTION</p><h1>Liked Songs</h1><p>{{ library.likedSongs().length }} saved {{ library.likedSongs().length === 1 ? 'song' : 'songs' }}</p></div>
      </header>
      @if (!api.user()) {
        <div class="empty-state"><h2>Sign in to see your favorites</h2><p>Your liked songs are saved to your account and sync across devices.</p><a class="button button-light" routerLink="/login">Sign in</a></div>
      } @else if (loading) {
        <div class="song-list" role="status" aria-label="Loading liked songs"><div class="inline-alert info-alert">Loading your favorites…</div></div>
      } @else if (error) {
        <div class="inline-alert error-alert" role="alert">{{ error }} <button class="text-button" type="button" (click)="load()">Try again</button></div>
      } @else if (library.likedSongs().length) {
        <div class="song-list liked-song-list">
          @for (song of library.likedSongs(); track song.id) {
            <article class="song-row">
              <button class="song-cover" type="button" [style.background]="colorFor(song)" [attr.aria-label]="'Play ' + song.name" (click)="player.play(song, library.likedSongs())">
                <span aria-hidden="true">♫</span><app-media-image [imageKey]="song.imageKey" [alt]="''" /><span class="play-overlay" aria-hidden="true">▶</span>
              </button>
              <div class="song-details" [attr.lang]="textLanguage(song.name, song.artistName)"><h2>{{ song.name }}</h2><span>{{ song.artistName || 'Artist details unavailable' }}</span></div>
              <button class="like-button liked" type="button" aria-label="Remove from Liked Songs" [disabled]="busySongId === song.id" (click)="remove(song.id)"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.8 1.8Z" /></svg></button>
              <button class="play-button" type="button" [attr.aria-label]="'Play ' + song.name" (click)="player.play(song, library.likedSongs())"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z" /></svg></button>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state"><span class="empty-icon" aria-hidden="true">♥</span><h2>Your favorites will live here</h2><p>Find a song you love and tap its heart to save it to your account.</p><a class="button button-light" routerLink="/discover">Discover music</a></div>
      }
    </section>
  `,
})
export class LikedSongsPageComponent implements OnInit {
  readonly library = inject(LibraryService);
  readonly player = inject(PlaybackService);
  readonly api = inject(MusicApiService);
  readonly textLanguage = textLanguage;
  private readonly changeDetector = inject(ChangeDetectorRef);
  loading = false;
  error = '';
  busySongId = '';

  ngOnInit(): void { if (this.api.user()) void this.load(); }

  async load(): Promise<void> {
    this.loading = true;
    this.error = '';
    try { await this.library.loadFavorites(); }
    catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }

  async remove(songId: string): Promise<void> {
    this.busySongId = songId;
    this.error = '';
    try { await this.library.removeLikedSong(songId); }
    catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.busySongId = ''; this.changeDetector.markForCheck(); }
  }

  colorFor(song: MediaItem): string {
    const colors = ['#7b477d', '#a25748', '#35717a', '#9c7542', '#4b5793'];
    const seed = song.id || song.name;
    return colors[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  }
}
