import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryService } from '../../core/services/library.service';

@Component({
  selector: 'app-library-page',
  imports: [RouterLink],
  template: `
    <section class="catalog-page">
      <header class="catalog-heading">
        <p class="eyebrow">YOUR ACCOUNT COLLECTION</p>
        <h1>Your <em>Library.</em></h1>
        <p>Your liked songs and playlists are saved to your account and available across your devices.</p>
      </header>

      <a class="library-liked-feature" routerLink="/liked">
        <span class="liked-art" aria-hidden="true">♥</span>
        <span class="liked-feature-copy"><small>YOUR COLLECTION</small><strong>Liked Songs</strong><span>{{ library.likedSongs().length }} saved songs</span></span>
        <span class="shortcut-arrow" aria-hidden="true">↗</span>
      </a>

      @if (library.error()) {
        <div class="inline-alert error-alert" role="alert">{{ library.error() }}</div>
      }
      <div class="section-heading library-section-heading">
        <div><p class="eyebrow">YOUR PLAYLISTS</p><h2>Made by you</h2></div>
        <button class="button button-light" type="button" (click)="showCreate.update(value => !value)">
          {{ showCreate() ? 'Cancel' : 'Create playlist' }}
        </button>
      </div>

      @if (showCreate()) {
        <form class="library-create-form" (submit)="create($event)">
          <label for="playlist-name">Playlist name</label>
          <input id="playlist-name" name="name" maxlength="80" required [value]="name()" (input)="name.set($any($event.target).value)" placeholder="Give your playlist a name">
          <label for="playlist-description">Description (optional)</label>
          <input id="playlist-description" name="description" maxlength="500" [value]="description()" (input)="description.set($any($event.target).value)" placeholder="What is this playlist for?">
          <button class="button button-light" type="submit" [disabled]="saving() || !name().trim()">{{ saving() ? 'Creating…' : 'Save playlist' }}</button>
        </form>
      }

      @if (library.loading()) {
        <p class="empty-state" role="status">Loading your library…</p>
      } @else if (library.playlists().length) {
        <div class="demo-playlist-grid">
          @for (playlist of library.playlists(); track playlist.id) {
            <article class="demo-playlist-card">
              <span class="demo-playlist-art" aria-hidden="true">♫</span>
              <p class="eyebrow">YOUR PLAYLIST</p>
              <h3>{{ playlist.name }}</h3>
              <p>{{ playlist.description || 'No description' }}</p>
              <span class="demo-playlist-note">{{ playlist.songIds.length }} songs</span>
              <button class="button button-quiet" type="button" (click)="remove(playlist.id)">Delete playlist</button>
            </article>
          }
        </div>
      } @else {
        <div class="empty-state">
          <span class="empty-icon" aria-hidden="true">♫</span>
          <h2>Your playlists start here</h2>
          <p>Create a playlist and add songs from your music collection.</p>
          <button class="button button-light" type="button" (click)="showCreate.set(true)">Create your first playlist</button>
        </div>
      }
    </section>
  `,
})
export class LibraryPageComponent {
  readonly library = inject(LibraryService);
  readonly showCreate = signal(false);
  readonly name = signal('');
  readonly description = signal('');
  readonly saving = signal(false);

  async create(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.name().trim() || this.saving()) return;
    this.saving.set(true);
    try {
      await this.library.createPlaylist(this.name().trim(), this.description().trim());
      this.name.set('');
      this.description.set('');
      this.showCreate.set(false);
    } catch (error) {
      this.library.error.set(error instanceof Error ? error.message : 'Could not create playlist.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.library.deletePlaylist(id);
    } catch (error) {
      this.library.error.set(error instanceof Error ? error.message : 'Could not delete playlist.');
    }
  }
}
