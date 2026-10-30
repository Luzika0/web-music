import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryService } from '../../core/services/library.service';
import { PlaybackService } from '../../core/services/playback.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';
import { AppIconComponent } from '../../shared/components/app-icon.component';
import { textLanguage } from '../../shared/utils/text-language';

@Component({
  selector: 'app-now-playing-page',
  imports: [RouterLink, MediaImageComponent, AppIconComponent],
  template: `
    <section class="now-playing-page" aria-labelledby="now-playing-title">
      <header class="now-playing-header">
        <a class="button button-quiet" routerLink="/discover" aria-label="Back to Discover">
          <app-icon name="previous" />
          <span>Discover</span>
        </a>
        <p class="eyebrow">K-SONG · NOW PLAYING</p>
        <span class="now-playing-live" [class.is-playing]="player.isPlaying()" [class.is-loading]="player.loading()">
          <span class="now-playing-status-mark" aria-hidden="true">
            @if (player.isPlaying()) {
              <i></i><i></i><i></i>
            } @else {
              <i></i>
            }
          </span>
          {{ player.loading() ? 'Preparing' : player.isPlaying() ? 'Playing' : 'Paused' }}
        </span>
      </header>

      @if (player.currentSong(); as song) {
        <div class="now-playing-content">
          <div class="now-playing-art-wrap" [class.is-playing]="player.isPlaying()">
            <div class="now-playing-glow" [style.background]="player.coverColor()"></div>
            <div class="now-playing-art" [style.background]="player.coverColor()">
              <app-icon name="music" />
              <app-media-image [imageKey]="song.imageKey" [alt]="song.name + ' cover art'" />
            </div>
            <div class="now-playing-orbit orbit-a"></div>
            <div class="now-playing-orbit orbit-b"></div>
          </div>

          <div class="now-playing-info">
            <h1 id="now-playing-title" [attr.lang]="textLanguage(song.name)">{{ song.name }}</h1>
            <div class="now-playing-track-meta">
              <p class="now-playing-artist" [attr.lang]="textLanguage(song.artistName)">{{ song.artistName || 'K-Song artist' }}</p>
              <button
                class="now-playing-like"
                type="button"
                [class.liked]="library.isLiked(song.id)"
                [disabled]="!song.id"
                [attr.aria-pressed]="library.isLiked(song.id)"
                [attr.aria-label]="library.isLiked(song.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'"
                [title]="library.isLiked(song.id) ? 'Remove from Liked Songs' : 'Add to Liked Songs'"
                (click)="library.toggleLike(song)"
              >
                <app-icon name="heart" />
              </button>
            </div>
            @if (player.error()) {
              <p class="now-playing-message error-alert" role="alert">{{ player.error() }}</p>
            } @else if (player.loading()) {
              <p class="now-playing-message" role="status">Preparing your stream…</p>
            }

            <div class="now-playing-progress">
              <input
                type="range"
                min="0"
                [max]="player.duration() || 0"
                [value]="player.currentTime()"
                [disabled]="!player.duration()"
                [attr.aria-label]="'Track position: ' + formatTime(player.currentTime()) + ' of ' + formatTime(player.duration())"
                (input)="seek($event)"
              />
              <div><span>{{ formatTime(player.currentTime()) }}</span><span>{{ formatTime(player.duration()) }}</span></div>
            </div>

            <div class="now-playing-controls">
              <button class="now-playing-mode" type="button" [class.is-active]="player.isShuffled()" (click)="player.toggleShuffle()" [attr.aria-pressed]="player.isShuffled()" [attr.aria-label]="player.isShuffled() ? 'Disable shuffle' : 'Enable shuffle'" title="Shuffle">
                <app-icon name="shuffle" />
              </button>
              <button
                class="now-playing-skip"
                type="button"
                [disabled]="(player.queueIndex() <= 0 && player.currentTime() <= 3) || player.loading()"
                (click)="player.playPrevious()"
                [attr.aria-label]="player.currentTime() > 3 ? 'Restart current song' : 'Play previous song'"
                [title]="player.currentTime() > 3 ? 'Restart current song' : 'Play previous song'"
              >
                <app-icon name="skipBack" />
              </button>
              <button class="now-playing-toggle" type="button" [disabled]="player.loading() || !player.manifestUrl()" (click)="player.togglePlayback()"
                [attr.aria-label]="player.isPlaying() ? 'Pause playback' : 'Resume playback'">
                @if (player.loading()) {
                  <span class="now-playing-spinner" aria-hidden="true"></span>
                } @else if (player.isPlaying()) {
                  <app-icon name="pause" />
                } @else {
                  <app-icon name="play" />
                }
              </button>
              <button
                class="now-playing-skip"
                type="button"
                [disabled]="player.queueIndex() < 0 || (player.queueIndex() >= player.queue().length - 1 && player.repeatMode() !== 'all') || player.loading()"
                (click)="player.playNext()"
                aria-label="Play next song"
                title="Play next song"
              >
                <app-icon name="skipForward" />
              </button>
              <button class="now-playing-mode" type="button" [class.is-active]="player.repeatMode() !== 'off'" (click)="player.cycleRepeat()" [attr.aria-pressed]="player.repeatMode() !== 'off'" [attr.aria-label]="'Repeat: ' + player.repeatMode()" [title]="'Repeat: ' + player.repeatMode()">
                <app-icon name="repeat" />
                @if (player.repeatMode() === 'one') { <span aria-hidden="true">1</span> }
              </button>
            </div>
          </div>
        </div>

        <section class="play-queue-card" aria-labelledby="queue-title">
          <div class="play-queue-heading">
            <div>
              <p class="eyebrow">QUEUE</p>
              <h2 id="queue-title">Up next <span>{{ player.queue().length }}</span></h2>
            </div>
          </div>
          @if (player.queue().length) {
            <ol class="play-queue-list">
              @for (queuedSong of player.queue(); track queuedSong.id; let index = $index) {
                <li>
                  <button type="button" class="play-queue-item"
                    [class.is-current]="player.queueIndex() === index"
                    [disabled]="player.loading() && player.queueIndex() === index"
                    [attr.aria-current]="player.queueIndex() === index ? 'true' : null"
                    [attr.aria-label]="(player.queueIndex() === index ? 'Now playing: ' : 'Play ') + queuedSong.name"
                    (click)="player.play(queuedSong, player.queue())">
                    <span class="play-queue-index" aria-hidden="true">
                      @if (player.queueIndex() === index && player.isPlaying()) {
                        <span class="queue-equalizer"><i></i><i></i><i></i></span>
                      } @else if (player.queueIndex() === index) {
                        <span class="queue-pause-mark"><app-icon name="pause" /></span>
                      } @else {
                        {{ index + 1 }}
                      }
                    </span>
                    <span class="play-queue-cover" [style.background]="colorFor(queuedSong.id)">
                      <app-icon name="music" />
                      <app-media-image [imageKey]="queuedSong.imageKey" [alt]="''" />
                    </span>
                    <span class="play-queue-copy" [attr.lang]="textLanguage(queuedSong.name, queuedSong.artistName)">
                      <strong>{{ queuedSong.name }}</strong>
                      <small>{{ queuedSong.artistName || 'K-Song artist' }}</small>
                    </span>
                    <span class="play-queue-state">
                      @if (player.queueIndex() === index) { Now playing } @else if (index < player.queueIndex()) { Played } @else { Up next }
                    </span>
                    <app-icon name="play" class="play-queue-play" />
                  </button>
                </li>
              }
            </ol>
          } @else {
            <p class="queue-empty">Choose a song from Discover or Search to build your listening lineup.</p>
          }
        </section>
      } @else {
        <div class="now-playing-empty">
          <span class="now-playing-empty-icon" aria-hidden="true"><app-icon name="music" size="32" /></span>
          <p class="eyebrow">YOUR LISTENING ROOM</p>
          <h1 id="now-playing-title">Choose a song to begin.</h1>
          <p>Pick a track from Discover, Search, or your Liked Songs and it will appear here.</p>
          <a class="button button-light" routerLink="/discover">Explore music</a>
        </div>
      }
    </section>
  `,
})
export class NowPlayingPageComponent {
  readonly player = inject(PlaybackService);
  readonly library = inject(LibraryService);
  readonly textLanguage = textLanguage;

  seek(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.player.seekTo(Number(input.value));
    }
  }

  formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const total = Math.floor(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  colorFor(id: string): string {
    const palette = [
      'linear-gradient(145deg, #f8b195, #b83b5e)',
      'linear-gradient(145deg, #6c5b7b, #355c7d)',
      'linear-gradient(145deg, #99b898, #2a5b84)',
      'linear-gradient(145deg, #f6d365, #fda085)',
      'linear-gradient(145deg, #a18cd1, #fbc2eb)',
    ];
    const index = [...id].reduce((total, character) => total + character.charCodeAt(0), 0);
    return palette[index % palette.length];
  }
}
