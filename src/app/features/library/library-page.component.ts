import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlaybackService } from '../../core/services/playback.service';
import { LibraryService } from '../../core/services/library.service';

@Component({
  selector: 'app-library-page',
  imports: [RouterLink],
  template: `
    <section class="catalog-page">
      <header class="catalog-heading">
        <p class="eyebrow">A SPACE THAT'S YOURS</p>
        <h1>Your <em>Library.</em></h1>
        <p>Saved songs live on this device. Playlist examples below are demo content until a library API is available.</p>
      </header>
      <div class="inline-alert info-alert" role="note">Local demo library · Your likes are saved in this browser only and are not synced to your account.</div>
      <a class="library-liked-feature" routerLink="/liked">
        <span class="liked-art" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.8 1.8Z" /></svg></span>
        <span class="liked-feature-copy"><small>YOUR COLLECTION</small><strong>Liked Songs</strong><span>{{ library.likedSongs().length }} songs saved on this device</span></span>
        <span class="shortcut-arrow" aria-hidden="true">↗</span>
      </a>
      <div class="section-heading library-section-heading"><div><p class="eyebrow">SAMPLE COLLECTIONS</p><h2>Mixes for your mood</h2></div><span class="demo-badge">DEMO</span></div>
      <div class="demo-playlist-grid">
        @for (playlist of playlists; track playlist.name) {
          <article class="demo-playlist-card" [style.--playlist-color]="playlist.color">
            <span class="demo-playlist-art" aria-hidden="true">{{ playlist.symbol }}</span>
            <p class="eyebrow">K-SONG MIX · DEMO</p><h3>{{ playlist.name }}</h3><p>{{ playlist.description }}</p>
            <span class="demo-playlist-note">Sample collection · No songs are connected</span>
          </article>
        }
      </div>
    </section>
  `,
})
export class LibraryPageComponent {
  readonly library = inject(LibraryService);
  readonly player = inject(PlaybackService);
  readonly playlists = [
    { name: 'Soft Focus', description: 'A little room to breathe.', symbol: '◌', color: '#674d88' },
    { name: 'After Hours', description: 'For the city after dark.', symbol: '☾', color: '#a65b63' },
    { name: 'New Day', description: 'Find your first good thing.', symbol: '☼', color: '#a17842' },
  ];
}
