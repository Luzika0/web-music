import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlaybackService } from '../../core/services/playback.service';
import { LibraryService } from '../../core/services/library.service';
import { MediaItem } from '../../core/services/music-api.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { textLanguage } from '../../shared/utils/text-language';

@Component({
  selector: 'app-liked-songs-page',
  imports: [RouterLink, MediaImageComponent, AppIconComponent],
  template: `
    <section class="liked-page">
      <header class="liked-hero">
        <span class="liked-art liked-page-art" aria-hidden="true"><app-icon name="heart" /></span>
        <div><p class="eyebrow">YOUR PERSONAL COLLECTION · THIS DEVICE</p><h1>Liked Songs</h1><p>{{ library.likedSongs().length }} saved {{ library.likedSongs().length === 1 ? 'song' : 'songs' }}</p></div>
      </header>
      <div class="inline-alert info-alert" role="note">This is a local demo collection. Songs are saved in this browser and are not synced to an account.</div>
      @if (library.likedSongs().length) {
        <div class="song-list liked-song-list">
          @for (song of library.likedSongs(); track song.id) {
            <article class="song-row">
              <button class="song-cover" type="button" [style.background]="colorFor(song)" [attr.aria-label]="'Play ' + song.name" (click)="player.play(song, library.likedSongs())">
                <app-icon name="music" /><app-media-image [imageKey]="song.imageKey" [alt]="''" /><span class="play-overlay" aria-hidden="true"><app-icon name="play" /></span>
              </button>
              <div class="song-details" [attr.lang]="textLanguage(song.name, song.artistName)"><h2>{{ song.name }}</h2><span>{{ song.artistName || 'Artist details unavailable' }}</span></div>
              <button class="like-button liked" type="button" aria-label="Remove from Liked Songs" (click)="library.removeLikedSong(song.id)"><app-icon name="heart" /></button>
              <button class="play-button" type="button" [attr.aria-label]="'Play ' + song.name" (click)="player.play(song, library.likedSongs())"><app-icon name="play" /></button>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state"><span class="empty-icon" aria-hidden="true"><app-icon name="heart" size="30" /></span><h2>Your favorites will live here</h2><p>Find a song you love and tap its heart to save it to this device.</p><a class="button button-light" routerLink="/search">Search songs</a></div>
      }
    </section>
  `,
})
export class LikedSongsPageComponent {
  readonly library = inject(LibraryService);
  readonly player = inject(PlaybackService);
  readonly textLanguage = textLanguage;

  colorFor(song: MediaItem): string {
    const colors = ['#7b477d', '#a25748', '#35717a', '#9c7542', '#4b5793'];
    const seed = song.id || song.name;
    return colors[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length];
  }
}
