import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlaybackService } from '../../core/services/playback.service';
import { LibraryService, UserPlaylist } from '../../core/services/library.service';
import { MediaItem, MusicApiService } from '../../core/services/music-api.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';

@Component({
  selector: 'app-library-page',
  imports: [RouterLink, FormsModule, MediaImageComponent],
  template: `
    <section class="catalog-page">
      <header class="catalog-heading">
        <p class="eyebrow">A SPACE THAT'S YOURS</p>
        <h1>Your <em>Library.</em></h1>
        <p>Your favorites and playlists are saved to your account and available across devices.</p>
      </header>

      @if (!api.user()) {
        <div class="empty-state"><h2>Your library is waiting</h2><p>Sign in to save favorites and create playlists that sync across devices.</p><a class="button button-light" routerLink="/login">Sign in</a></div>
      } @else {
        <a class="library-liked-feature" routerLink="/liked">
          <span class="liked-art" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20.8 8.8c0 5.2-8.8 10.2-8.8 10.2S3.2 14 3.2 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.8 1.8Z" /></svg></span>
          <span class="liked-feature-copy"><small>YOUR COLLECTION</small><strong>Liked Songs</strong><span>{{ library.likedSongs().length }} songs saved to your account</span></span>
          <span class="shortcut-arrow" aria-hidden="true">↗</span>
        </a>

        <div class="section-heading library-section-heading"><div><p class="eyebrow">YOUR COLLECTIONS</p><h2>Playlists</h2></div></div>
        <form class="library-create-form" (ngSubmit)="create()" #createForm="ngForm">
          <label for="playlist-name">Playlist name</label>
          <input id="playlist-name" name="playlistName" [(ngModel)]="newName" maxlength="80" required placeholder="e.g. Khmer classics">
          <label for="playlist-description">Description</label>
          <input id="playlist-description" name="playlistDescription" [(ngModel)]="newDescription" maxlength="500" placeholder="A short description (optional)">
          <button class="button button-light" type="submit" [disabled]="createForm.invalid || saving"> {{ saving ? 'Creating…' : 'Create playlist' }} </button>
        </form>

        @if (error) { <div class="inline-alert error-alert" role="alert">{{ error }} <button class="text-button" type="button" (click)="load()">Try again</button></div> }
        @if (loading) {
          <div class="inline-alert info-alert" role="status">Loading your playlists…</div>
        } @else if (library.playlists().length) {
          <div class="demo-playlist-grid">
            @for (playlist of library.playlists(); track playlist.playlistId) {
              <article class="demo-playlist-card" [class.is-selected]="selected?.playlistId === playlist.playlistId">
                <button class="playlist-open" type="button" (click)="open(playlist)">
                  <span class="demo-playlist-art" aria-hidden="true">♫</span>
                  <p class="eyebrow">YOUR PLAYLIST</p><h3>{{ playlist.name }}</h3>
                  <p>{{ playlist.description || 'No description' }}</p>
                  <span class="demo-playlist-note">{{ playlist.songIds.length }} {{ playlist.songIds.length === 1 ? 'song' : 'songs' }}</span>
                </button>
                <button class="text-button" type="button" (click)="beginEdit(playlist)">Edit</button>
                <button class="text-button" type="button" (click)="removePlaylist(playlist)">Delete</button>
              </article>
            }
          </div>
        } @else {
          <div class="empty-state"><h3>No playlists yet</h3><p>Create your first playlist above. You can add songs using their song IDs from the catalog.</p></div>
        }

        @if (selected) {
          <section class="playlist-detail" aria-live="polite">
            <div class="section-heading"><div><p class="eyebrow">PLAYLIST DETAILS</p><h2>{{ selected.name }}</h2></div><button class="text-button" type="button" (click)="selected = null">Close</button></div>
            <p>{{ selected.description }}</p>
            <form class="library-create-form" (ngSubmit)="addSong()">
              <label for="song-search">Find a song in the catalog</label>
              <input id="song-search" name="songSearch" [(ngModel)]="songSearch" placeholder="Search song or artist">
              <label for="song-id">Choose song</label>
              <select id="song-id" name="songId" [(ngModel)]="songId" required>
                <option value="" disabled>Select a song</option>
                @for (song of filteredSongOptions; track song.id) {
                  <option [value]="song.id">{{ song.name }}{{ song.artistName ? ' — ' + song.artistName : '' }}</option>
                }
              </select>
              <button class="button button-light" type="submit" [disabled]="saving || !songId">Add song</button>
            </form>
            @if (selected.songs.length) {
              <ol class="playlist-song-ids">
                @for (track of selected.songs; track track.songId; let i = $index) {
                  <li class="playlist-track-row">
                    <button class="playlist-track-play" type="button" (click)="playTrack(i)" [attr.aria-label]="'Play ' + track.songName">
                      <app-media-image [imageKey]="track.songImage" [alt]="''" />
                      <span><strong>{{ track.songName }}</strong><small>{{ track.artistName || 'Artist unavailable' }}</small></span>
                    </button>
                    <span class="playlist-order-actions">
                      <button class="text-button" type="button" [disabled]="i === 0 || saving" (click)="move(i, -1)" aria-label="Move song up">↑</button>
                      <button class="text-button" type="button" [disabled]="i === selected!.songs.length - 1 || saving" (click)="move(i, 1)" aria-label="Move song down">↓</button>
                      <button class="text-button" type="button" [disabled]="saving" (click)="removeSong(track.songId)">Remove</button>
                    </span>
                  </li>
                }
              </ol>
            } @else { <p>This playlist is empty. Choose a song from the catalog above.</p> }
          </section>
        }

        @if (editing) {
          <section class="playlist-detail">
            <h2>Edit playlist</h2>
            <form class="library-create-form" (ngSubmit)="saveEdit()">
              <label for="edit-name">Name</label><input id="edit-name" name="editName" [(ngModel)]="editName" maxlength="80" required>
              <label for="edit-description">Description</label><input id="edit-description" name="editDescription" [(ngModel)]="editDescription" maxlength="500">
              <button class="button button-light" type="submit" [disabled]="saving || !editName.trim()">Save changes</button>
              <button class="text-button" type="button" (click)="editing = null">Cancel</button>
            </form>
          </section>
        }
      }
    </section>
  `,
})
export class LibraryPageComponent implements OnInit {
  readonly library = inject(LibraryService);
  readonly player = inject(PlaybackService);
  readonly api = inject(MusicApiService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  newName = '';
  newDescription = '';
  songId = '';
  songSearch = '';
  songCatalog: MediaItem[] = [];

  get filteredSongOptions(): MediaItem[] {
    const term = this.songSearch.trim().toLocaleLowerCase();
    return this.songCatalog.filter(song => !term || (song.name + ' ' + song.artistName).toLocaleLowerCase().includes(term));
  }
  loading = false;
  saving = false;
  error = '';
  selected: UserPlaylist | null = null;
  editing: UserPlaylist | null = null;
  editName = '';
  editDescription = '';

  ngOnInit(): void { if (this.api.user()) void this.load(); }

  async load(): Promise<void> {
    this.loading = true; this.error = '';
    try {
      const [, , catalog] = await Promise.all([this.library.loadFavorites(), this.library.loadPlaylists(), this.api.songs(0, 100, '')]);
      this.songCatalog = catalog.items;
      if (this.selected) this.selected = await this.library.getPlaylist(this.selected.playlistId);
    } catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.loading = false; this.changeDetector.markForCheck(); }
  }

  async create(): Promise<void> {
    this.saving = true; this.error = '';
    try {
      const playlist = await this.library.createPlaylist(this.newName, this.newDescription);
      this.newName = ''; this.newDescription = ''; this.selected = playlist;
    } catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.saving = false; this.changeDetector.markForCheck(); }
  }

  async open(playlist: UserPlaylist): Promise<void> {
    this.error = '';
    try { this.selected = await this.library.getPlaylist(playlist.playlistId); }
    catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.changeDetector.markForCheck(); }
  }

  beginEdit(playlist: UserPlaylist): void {
    this.editing = playlist; this.editName = playlist.name; this.editDescription = playlist.description;
  }

  async saveEdit(): Promise<void> {
    if (!this.editing) return;
    this.saving = true; this.error = '';
    try {
      const id = this.editing.playlistId;
      await this.library.updatePlaylist(id, this.editName, this.editDescription);
      if (this.selected?.playlistId === id) this.selected = await this.library.getPlaylist(id);
      this.editing = null;
    } catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.saving = false; this.changeDetector.markForCheck(); }
  }

  async removePlaylist(playlist: UserPlaylist): Promise<void> {
    if (!globalThis.confirm('Delete playlist "' + playlist.name + '"? This cannot be undone.')) return;
    this.saving = true; this.error = '';
    try {
      await this.library.deletePlaylist(playlist.playlistId);
      if (this.selected?.playlistId === playlist.playlistId) this.selected = null;
      if (this.editing?.playlistId === playlist.playlistId) this.editing = null;
    } catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.saving = false; this.changeDetector.markForCheck(); }
  }

  async addSong(): Promise<void> {
    if (!this.selected || !this.songId.trim()) return;
    this.saving = true; this.error = '';
    try {
      this.selected = await this.library.addSong(this.selected.playlistId, this.songId.trim());
      this.songId = ''; this.songSearch = '';
    } catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.saving = false; this.changeDetector.markForCheck(); }
  }

  playTrack(index: number): void {
    if (!this.selected) return;
    const queue: MediaItem[] = this.selected.songs.map(track => ({
      id: track.songId, artistId: track.artistId, name: track.songName,
      artistName: track.artistName, imageKey: track.songImage, kind: 'song',
    }));
    const song = queue[index];
    if (song) this.player.play(song, queue);
  }

  async removeSong(songId: string): Promise<void> {
    if (!this.selected) return;
    this.saving = true; this.error = '';
    try { this.selected = await this.library.removeSong(this.selected.playlistId, songId); }
    catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.saving = false; this.changeDetector.markForCheck(); }
  }

  async move(index: number, delta: number): Promise<void> {
    if (!this.selected) return;
    const ids = [...this.selected.songIds];
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.saving = true; this.error = '';
    try { this.selected = await this.library.reorderSongs(this.selected.playlistId, ids); }
    catch (error) { this.error = this.api.toUserMessage(error); }
    finally { this.saving = false; this.changeDetector.markForCheck(); }
  }
}
