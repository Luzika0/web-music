import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MusicApiService } from '../../core/services/music-api.service';

@Component({
  selector: 'app-admin-page',
  imports: [FormsModule],
  template: `
    <section class="admin-page">
      <div class="admin-heading">
        <p class="eyebrow">K-SONG CREATOR STUDIO</p>
        <h1>Make room for <em>new sounds.</em></h1>
        <p>Bring artists and their music to the K-Song community.</p>
      </div>
      <div class="inline-alert info-alert" role="note">
        Song IDs are not reliably available from the public listing contract. To remove a track, enter its backend song ID below. No admin listing endpoint is assumed.
      </div>
      <div class="admin-grid">
        <section class="admin-card">
          <span class="card-number">01</span><p class="eyebrow">NEW VOICE</p><h2>Create an artist</h2>
          <form class="form-stack" (ngSubmit)="createArtist()" #artistForm="ngForm">
            <label for="artist-name">Artist name</label>
            <input id="artist-name" name="artistName" [(ngModel)]="artistName" required />
            <label for="album-name">Album name</label>
            <input id="album-name" name="albumName" [(ngModel)]="albumName" required />
            <label for="artist-image">Artist image</label>
            <input id="artist-image" name="artistImage" type="file" accept="image/*" (change)="setArtistImage($event)" required />
            <label for="album-image">Album image</label>
            <input id="album-image" name="albumImage" type="file" accept="image/*" (change)="setAlbumImage($event)" required />
            <button class="button button-light button-wide" type="submit" [disabled]="artistForm.invalid || !artistImage || !albumImage || busy" [attr.aria-busy]="busy === 'artist'">
              {{ busy === 'artist' ? 'Creating artist…' : 'Create artist' }}
            </button>
          </form>
        </section>

        <section class="admin-card">
          <span class="card-number">02</span><p class="eyebrow">ADD TO THE MIX</p><h2>Upload a song</h2>
          <form class="form-stack" (ngSubmit)="uploadSong()" #songForm="ngForm">
            <label for="song-artist-id">Artist ID</label>
            <input id="song-artist-id" name="artistId" [(ngModel)]="artistId" required />
            <p class="field-hint">Use the artist ID returned by your service after creation.</p>
            <label for="song-name">Song name</label>
            <input id="song-name" name="songName" [(ngModel)]="songName" required />
            <label for="song-type">Song type</label>
            <select id="song-type" name="songType" [(ngModel)]="songType" required>
              <option value="" disabled>Select a genre</option>
              @for (type of songTypes; track type) {
                <option [value]="type">{{ type.replace('_', ' ') }}</option>
              }
            </select>
            <label for="song-file">Audio file</label>
            <input id="song-file" name="songFile" type="file" accept="audio/*" (change)="setSongFile($event)" required />
            <label for="song-image">Song image</label>
            <input id="song-image" name="songImage" type="file" accept="image/*" (change)="setSongImage($event)" required />
            <button class="button button-light button-wide" type="submit" [disabled]="songForm.invalid || !songFile || !songImage || busy" [attr.aria-busy]="busy === 'song'">
              {{ busy === 'song' ? 'Uploading song…' : 'Upload song' }}
            </button>
          </form>
        </section>

        <section class="admin-card delete-card">
          <span class="card-number">03</span><p class="eyebrow">MAKE A CHANGE</p><h2>Remove a song</h2>
          <p class="card-description">This permanently removes the selected song. Confirm the ID before continuing.</p>
          <form class="form-stack" (ngSubmit)="deleteSong()" #deleteForm="ngForm">
            <label for="delete-song-id">Song ID</label>
            <input id="delete-song-id" name="songId" [(ngModel)]="songIdToDelete" required />
            <button class="button button-danger button-wide" type="submit" [disabled]="deleteForm.invalid || busy" [attr.aria-busy]="busy === 'delete'">
              {{ busy === 'delete' ? 'Removing song…' : 'Delete song' }}
            </button>
          </form>
        </section>
      </div>
      @if (error) { <div class="inline-alert error-alert" role="alert">{{ error }}</div> }
      @if (success) { <div class="inline-alert success-alert" role="status">{{ success }}</div> }
    </section>
  `,
})
export class AdminPageComponent {
  private readonly api = inject(MusicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  artistName = '';
  albumName = '';
  artistId = '';
  songName = '';
  songType = '';
  readonly songTypes = ['ROCK', 'CLASSICAL', 'POP', 'JAZZ', 'HIP_HOP', 'COUNTRY', 'OTHER'];
  songIdToDelete = '';
  artistImage: File | null = null;
  albumImage: File | null = null;
  songFile: File | null = null;
  songImage: File | null = null;
  busy: '' | 'artist' | 'song' | 'delete' = '';
  error = '';
  success = '';

  setArtistImage(event: Event): void { this.artistImage = this.fileFrom(event); }
  setAlbumImage(event: Event): void { this.albumImage = this.fileFrom(event); }
  setSongFile(event: Event): void { this.songFile = this.fileFrom(event); }
  setSongImage(event: Event): void { this.songImage = this.fileFrom(event); }

  async createArtist(): Promise<void> {
    if (!this.artistImage || !this.albumImage) { return; }
    const form = new FormData();
    form.append('artistName', this.artistName);
    form.append('albumName', this.albumName);
    form.append('artistImage', this.artistImage);
    form.append('albumIamge', this.albumImage);
    await this.perform('artist', 'Artist created successfully.', () => this.api.createArtist(form));
  }

  async uploadSong(): Promise<void> {
    if (!this.songFile || !this.songImage) { return; }
    const form = new FormData();
    form.append('artistId', this.artistId);
    form.append('songName', this.songName);
    form.append('songType', this.songType);
    form.append('file', this.songFile);
    form.append('songImage', this.songImage);
    await this.perform('song', 'Song uploaded successfully.', () => this.api.uploadSong(form));
  }

  async deleteSong(): Promise<void> {
    if (!this.songIdToDelete.trim()) { return; }
    if (!isPlatformBrowser(this.platformId) || !window.confirm(`Permanently delete song ${this.songIdToDelete}?`)) {
      return;
    }
    await this.perform('delete', 'Song deleted successfully.', () => this.api.deleteSong(this.songIdToDelete.trim()));
  }

  private fileFrom(event: Event): File | null {
    return (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  private async perform(operation: 'artist' | 'song' | 'delete', successMessage: string, action: () => Promise<void>): Promise<void> {
    this.busy = operation;
    this.error = '';
    this.success = '';
    try {
      await action();
      this.success = successMessage;
    } catch (error) {
      this.error = this.api.toUserMessage(error);
    } finally {
      this.busy = '';
      this.changeDetector.markForCheck();
    }
  }
}
