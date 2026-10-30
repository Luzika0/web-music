import { Component, computed, inject, signal } from '@angular/core';
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
      @if (library.error()) { <div class="inline-alert error-alert" role="alert">{{ library.error() }}</div> }
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
              <button class="demo-playlist-art" type="button" (click)="openPlaylist(playlist.id)" [attr.aria-label]="'Open ' + playlist.name">♫</button>
              <p class="eyebrow">YOUR PLAYLIST</p>
              <h3>{{ playlist.name }}</h3>
              <p>{{ playlist.description || 'No description' }}</p>
              <span class="demo-playlist-note">{{ playlist.songIds.length }} songs</span>
              <div class="playlist-card-actions">
                <button class="button button-quiet" type="button" (click)="beginEdit(playlist.id, playlist.name, playlist.description)">Edit</button>
                <button class="button button-quiet" type="button" (click)="remove(playlist.id)">Delete</button>
              </div>
              @if (editingId() === playlist.id) {
                <form (submit)="saveEdit($event, playlist.id)">
                  <label [for]="'edit-name-' + playlist.id">Playlist name</label>
                  <input [id]="'edit-name-' + playlist.id" required maxlength="80" [value]="editName()" (input)="editName.set($any($event.target).value)">
                  <label [for]="'edit-description-' + playlist.id">Description</label>
                  <input [id]="'edit-description-' + playlist.id" maxlength="500" [value]="editDescription()" (input)="editDescription.set($any($event.target).value)">
                  <button class="button button-light" type="submit">Save changes</button>
                </form>
              }
            </article>
          }
        </div>
        @if (selectedPlaylist()) {
          <section class="playlist-detail">
            <div class="section-heading"><div><p class="eyebrow">PLAYLIST CONTENTS</p><h2>{{ selectedPlaylist()!.name }}</h2></div><button class="button button-quiet" type="button" (click)="selectedId.set(null)">Close</button></div>
            @if (selectedPlaylist()!.songIds.length) {
              @for (songId of selectedPlaylist()!.songIds; track songId; let i = $index) {
                <div class="song-row">
                  <span>{{ songName(songId) }}</span>
                  <div class="playlist-card-actions">
                    <button class="button button-quiet" type="button" [disabled]="i === 0" (click)="moveSong(selectedPlaylist()!.id, i, -1)" aria-label="Move song up">↑</button>
                    <button class="button button-quiet" type="button" [disabled]="i === selectedPlaylist()!.songIds.length - 1" (click)="moveSong(selectedPlaylist()!.id, i, 1)" aria-label="Move song down">↓</button>
                    <button class="button button-quiet" type="button" (click)="removeSong(selectedPlaylist()!.id, songId)">Remove</button>
                  </div>
                </div>
              }
            } @else { <p>This playlist is empty. Add songs below.</p> }
            <h3>Add a song</h3>
            @for (song of library.songOptions(); track song.id) {
              @if (!selectedPlaylist()!.songIds.includes(song.id)) {
                <div class="song-row">
                  <span>{{ song.name }} · {{ song.artistName || 'Artist' }}</span>
                  <button class="button button-quiet" type="button" (click)="addSong(selectedPlaylist()!.id, song.id)">Add</button>
                </div>
              }
            }
          </section>
        }
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
  readonly selectedId = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly editName = signal('');
  readonly editDescription = signal('');
  readonly selectedPlaylist = computed(() => this.library.playlists().find(item => item.id === this.selectedId()) ?? null);

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

  async openPlaylist(id: string): Promise<void> {
    this.selectedId.set(id);
    try { await this.library.loadPlaylist(id); }
    catch (error) { this.library.error.set(error instanceof Error ? error.message : 'Could not load playlist.'); }
  }

  beginEdit(id: string, name: string, description: string): void {
    this.editingId.set(id);
    this.editName.set(name);
    this.editDescription.set(description);
  }

  async saveEdit(event: Event, id: string): Promise<void> {
    event.preventDefault();
    try {
      await this.library.updatePlaylist(id, this.editName().trim(), this.editDescription().trim());
      this.editingId.set(null);
    } catch (error) {
      this.library.error.set(error instanceof Error ? error.message : 'Could not update playlist.');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.library.deletePlaylist(id);
      if (this.selectedId() === id) this.selectedId.set(null);
    } catch (error) {
      this.library.error.set(error instanceof Error ? error.message : 'Could not delete playlist.');
    }
  }

  async addSong(playlistId: string, songId: string): Promise<void> {
    try { await this.library.addSongToPlaylist(playlistId, songId); }
    catch (error) { this.library.error.set(error instanceof Error ? error.message : 'Could not add song.'); }
  }

  async removeSong(playlistId: string, songId: string): Promise<void> {
    try { await this.library.removeSongFromPlaylist(playlistId, songId); }
    catch (error) { this.library.error.set(error instanceof Error ? error.message : 'Could not remove song.'); }
  }

  async moveSong(playlistId: string, index: number, delta: number): Promise<void> {
    const playlist = this.selectedPlaylist();
    if (!playlist) return;
    const next = [...playlist.songIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try { await this.library.reorderPlaylist(playlistId, next); }
    catch (error) { this.library.error.set(error instanceof Error ? error.message : 'Could not reorder songs.'); }
  }

  songName(id: string): string {
    const song = this.library.songOptions().find(item => item.id === id);
    return song ? `${song.name} · ${song.artistName || 'Artist'}` : id;
  }
}
