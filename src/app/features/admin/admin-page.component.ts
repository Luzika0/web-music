import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MediaItem, MusicApiService } from '../../core/services/music-api.service';
import { MediaImageComponent } from '../../shared/components/media-image.component';

@Component({
  selector: 'app-admin-page',
  imports: [FormsModule, MediaImageComponent],
  template: `
    <section class="admin-page">
      <div class="admin-heading">
        <p class="eyebrow admin-heading-kicker"><span class="admin-heading-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" /></svg></span>K-SONG CREATOR STUDIO</p>
        <h1>Make room for <em>new sounds.</em></h1>
        <p>Bring artists and their music to the K-Song community.</p>
      </div>
      <section class="admin-card admin-song-catalog" aria-labelledby="admin-song-catalog-title">
        <div class="admin-card-title">
          <span class="admin-card-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" /></svg></span>
          <div><p class="eyebrow">LIVE CATALOG</p><h2 id="admin-song-catalog-title">Manage uploaded songs</h2></div>
          <button class="button button-quiet" type="button" (click)="loadSongs()" [disabled]="songsLoading">Refresh</button>
        </div>
        <div class="admin-song-search">
          <input aria-label="Search songs" name="songSearch" [(ngModel)]="songSearch" placeholder="Search song or artist" (keydown.enter)="$event.preventDefault(); searchSongs()" />
          <button class="button button-quiet" type="button" (click)="searchSongs()" [disabled]="songsLoading">Search</button>
        </div>
        @if (songLookupError) {
          <p class="artist-lookup-error" role="alert">{{ songLookupError }} <button class="text-button" type="button" (click)="loadSongs()">Try again</button></p>
        } @else if (songsLoading && !songOptions.length) {
          <p class="artist-lookup-status" role="status">Loading song records…</p>
        } @else if (songOptions.length) {
          <div class="admin-song-list">
            @for (song of songOptions; track song.id) {
              <article class="admin-song-row">
                <span class="admin-song-art">
                  @if (song.imageKey) { <app-media-image [imageKey]="song.imageKey" [alt]="''" /> }
                  @else { <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" /></svg> }
                </span>
                <span class="admin-song-copy"><strong>{{ song.name }}</strong><small>{{ song.artistName || 'Artist details unavailable' }}</small><small class="record-id">{{ song.id }}</small></span>
                <button class="button button-danger admin-song-delete" type="button" (click)="deleteCatalogSong(song)" [disabled]="busy" [attr.aria-label]="'Delete ' + song.name">Delete</button>
              </article>
            }
          </div>
          @if (songsPageCount > 1) {
            <div class="artist-picker-pagination">
              <button type="button" class="button button-quiet" (click)="changeSongPage(-1)" [disabled]="songPage === 0 || songsLoading">Previous</button>
              <span>Page {{ songPage + 1 }} of {{ songsPageCount }}</span>
              <button type="button" class="button button-quiet" (click)="changeSongPage(1)" [disabled]="songPage >= songsPageCount - 1 || songsLoading">Next</button>
            </div>
          }
        } @else {
          <p class="artist-lookup-status">No songs found in the catalog.</p>
        }
      </section>
      <section class="admin-record-overview" aria-label="Live record details">
        <article class="admin-record-card">
          <div class="admin-record-heading">
            <span class="admin-record-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.7M17 14a6 6 0 0 1 4.5 5.8" /></svg>
            </span>
            <div><p class="eyebrow">ARTIST + ALBUM</p><h2>Record details</h2></div>
            <span class="admin-record-state" [class.is-ready]="artistName.trim() && albumName.trim()">{{ artistName.trim() && albumName.trim() ? 'Ready' : 'Draft' }}</span>
          </div>
          <div class="admin-record-previews">
            <div class="admin-art-preview">
              @if (artistImagePreview) {
                <img [src]="artistImagePreview" [alt]="artistName ? artistName + ' artist artwork preview' : 'Artist artwork preview'" />
              } @else {
                <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.7M17 14a6 6 0 0 1 4.5 5.8" /></svg>
              }
              <span>Artist image</span>
            </div>
            <div class="admin-art-preview album-art-preview">
              @if (albumImagePreview) {
                <img [src]="albumImagePreview" [alt]="albumName ? albumName + ' album artwork preview' : 'Album artwork preview'" />
              } @else {
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" /></svg>
              }
              <span>Album image</span>
            </div>
          </div>
          <dl class="admin-record-meta">
            <div><dt>Artist</dt><dd>{{ artistName.trim() || 'Enter an artist name' }}</dd></div>
            <div><dt>Album</dt><dd>{{ albumName.trim() || 'Enter an album name' }}</dd></div>
            <div><dt>Artist ID</dt><dd class="record-id">Returned by service after creation</dd></div>
          </dl>
        </article>

        <article class="admin-record-card">
          <div class="admin-record-heading">
            <span class="admin-record-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" /></svg>
            </span>
            <div><p class="eyebrow">SONG + DELETE TARGET</p><h2>Track details</h2></div>
            <span class="admin-record-state" [class.is-ready]="songName.trim() && artistId.trim() && songImage">{{ songName.trim() && artistId.trim() && songImage ? 'Ready' : 'Draft' }}</span>
          </div>
          <div class="admin-record-previews">
            <div class="admin-art-preview song-art-preview">
              @if (songImagePreview) {
                <img [src]="songImagePreview" [alt]="songName ? songName + ' artwork preview' : 'Song artwork preview'" />
              } @else {
                <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" /></svg>
              }
              <span>Song image</span>
            </div>
            <div class="admin-record-meta song-record-meta">
              <div><dt>Song</dt><dd>{{ songName.trim() || 'Enter a song name' }}</dd></div>
              <div><dt>Artist ID</dt><dd class="record-id">{{ artistId.trim() || 'Add the service artist ID' }}</dd></div>
              <div><dt>Audio file</dt><dd>{{ songFile?.name || 'Choose an audio file' }}</dd></div>
            </div>
          </div>
          <div class="admin-delete-target">
            <span class="delete-target-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg></span>
            <span><small>Song ID to delete</small><strong class="record-id">{{ songIdToDelete.trim() || 'Enter an ID below to review target' }}</strong></span>
          </div>
        </article>
      </section>
      <div class="admin-grid">
        <div class="admin-card-column">
          <section class="admin-card">
          <div class="admin-card-title">
            <span class="admin-card-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.7M17 14a6 6 0 0 1 4.5 5.8" /></svg></span>
            <div><p class="eyebrow">NEW VOICE</p><h2>Create an artist</h2></div>
            <span class="card-number">01</span>
          </div>
          <p class="admin-card-intro">Create an artist profile and its first album artwork.</p>
          <form class="form-stack" (ngSubmit)="createArtist()" #artistForm="ngForm">
            <label for="artist-name">Artist name</label>
            <input id="artist-name" name="artistName" [(ngModel)]="artistName" placeholder="e.g. The Midnight Echo" autocomplete="off" required />
            <label for="album-name">Album name</label>
            <input id="album-name" name="albumName" [(ngModel)]="albumName" placeholder="e.g. Afterglow" autocomplete="off" required />
            <label class="admin-file-label" for="artist-image"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>Artist image</label>
            <input id="artist-image" name="artistImage" type="file" accept="image/*" (change)="setArtistImage($event)" required />
            @if (artistImage) { <span class="admin-file-selected"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>{{ artistImage.name }}</span> }
            <label class="admin-file-label" for="album-image"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>Album cover</label>
            <input id="album-image" name="albumImage" type="file" accept="image/*" (change)="setAlbumImage($event)" required />
            @if (albumImage) { <span class="admin-file-selected"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>{{ albumImage.name }}</span> }
            <button class="button button-light button-wide" type="submit" [disabled]="artistForm.invalid || !artistImage || !albumImage || busy" [attr.aria-busy]="busy === 'artist'">
              @if (busy === 'artist') { <span class="admin-button-spinner" aria-hidden="true"></span> }
              @else { <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14" /></svg> }
              <span>{{ busy === 'artist' ? 'Creating artist…' : 'Create artist' }}</span>
            </button>
          </form>
          </section>

          <section class="admin-card delete-card">
            <div class="admin-card-title">
              <span class="admin-card-title-icon is-danger" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg></span>
              <div><p class="eyebrow">MAKE A CHANGE</p><h2>Remove a song</h2></div>
              <span class="card-number">03</span>
            </div>
            <p class="card-description">This permanently removes the selected song. Confirm the ID before continuing.</p>
            <form class="form-stack" (ngSubmit)="deleteSong()" #deleteForm="ngForm">
              <label for="delete-song-id">Song ID</label>
              <input id="delete-song-id" name="songId" [(ngModel)]="songIdToDelete" placeholder="Paste the exact song ID" autocomplete="off" required />
              <button class="button button-danger button-wide" type="submit" [disabled]="deleteForm.invalid || busy" [attr.aria-busy]="busy === 'delete'">
                @if (busy === 'delete') { <span class="admin-button-spinner" aria-hidden="true"></span> }
                @else { <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg> }
                <span>{{ busy === 'delete' ? 'Removing song…' : 'Delete song' }}</span>
              </button>
            </form>
          </section>
        </div>

        <section class="admin-card upload-card">
          <div class="admin-card-title">
            <span class="admin-card-title-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" /></svg></span>
            <div><p class="eyebrow">ADD TO THE MIX</p><h2>Upload a song</h2></div>
            <span class="card-number">02</span>
          </div>
          <p class="admin-card-intro">Choose the artist, add track details, and upload the audio.</p>
          <form class="form-stack" (ngSubmit)="uploadSong()" #songForm="ngForm">
            <div class="artist-picker">
              <div class="artist-picker-heading">
                <div>
                  <label for="artist-lookup">Find an existing artist</label>
                  <p class="field-hint">Selecting a result fills in the artist ID.</p>
                </div>
                <button class="button button-quiet artist-refresh" type="button" (click)="loadArtists()" [disabled]="artistsLoading" [attr.aria-busy]="artistsLoading">
                  @if (artistsLoading) { <span class="admin-button-spinner" aria-hidden="true"></span> }
                  @else { <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 7v5h-5M4 17v-5h5m8.5-6A7 7 0 0 0 5 9m14 6a7 7 0 0 1-12.5 3" /></svg> }
                  <span>{{ artistsLoading ? 'Loading' : 'Refresh list' }}</span>
                </button>
              </div>
              <div class="artist-picker-search">
                <input id="artist-lookup" name="artistSearch" [(ngModel)]="artistSearch" placeholder="Search artist name" autocomplete="off"
                  (keydown.enter)="$event.preventDefault(); searchArtists()" />
                <button class="button button-quiet" type="button" (click)="searchArtists()" [disabled]="artistsLoading" aria-label="Search artists">
                  <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
                  <span>Find artist</span>
                </button>
              </div>
              @if (artistLookupError) {
                <p class="artist-lookup-error" role="alert">{{ artistLookupError }}</p>
              } @else if (artistsLoading && !artistOptions.length) {
                <p class="artist-lookup-status" role="status">Loading artist records…</p>
              } @else if (artistOptions.length) {
                <div class="artist-option-list" aria-label="Artist search results">
                  @for (artist of artistOptions; track artist.id || $index) {
                    <button class="artist-option" type="button" [class.is-selected]="artist.id === artistId"
                      (click)="selectArtist(artist)" [attr.aria-pressed]="artist.id === artistId" [disabled]="artistsLoading">
                      <span class="artist-option-art">
                        @if (artist.imageKey) {
                          <app-media-image [imageKey]="artist.imageKey" [alt]="''" />
                        } @else {
                          <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /></svg>
                        }
                      </span>
                      <span class="artist-option-copy">
                        <strong>{{ artist.name }}</strong>
                        <small class="record-id">Artist ID · {{ artist.id }}</small>
                        <small>{{ artist.albumName ? 'Album · ' + artist.albumName : 'Album name · Not provided by service' }}</small>
                        <small class="record-id">Album ID · {{ artist.albumId || 'Not provided by service' }}</small>
                      </span>
                      <svg class="artist-option-check" aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
                    </button>
                  }
                </div>
                @if (artistsPageCount > 1) {
                  <div class="artist-picker-pagination">
                    <button type="button" class="button button-quiet" (click)="changeArtistPage(-1)" [disabled]="artistPage === 0 || artistsLoading" aria-label="Previous artist results">
                      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg><span>Previous</span>
                    </button>
                    <span>Page {{ artistPage + 1 }} of {{ artistsPageCount }}</span>
                    <button type="button" class="button button-quiet" (click)="changeArtistPage(1)" [disabled]="artistPage >= artistsPageCount - 1 || artistsLoading" aria-label="Next artist results">
                      <span>Next</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                  </div>
                }
              } @else {
                <p class="artist-lookup-status">No artist records found. Try another name, or enter an ID manually below.</p>
              }
            </div>
            <label for="song-artist-id">Artist ID <span class="admin-label-hint">Required</span></label>
            <input id="song-artist-id" name="artistId" [(ngModel)]="artistId" placeholder="Select an artist or enter its ID" autocomplete="off" required />
            <div class="selected-artist-summary" [class.is-selected]="selectedArtist">
              <span class="record-id">Artist ID</span>
              <strong>{{ selectedArtist?.id || artistId.trim() || 'Select an artist or enter its ID' }}</strong>
              @if (selectedArtist) {
                <span>{{ selectedArtist.name }} · Album: {{ selectedArtist.albumName || 'Not provided by service' }}</span>
                <small class="record-id">Album ID · {{ selectedArtist.albumId || 'Not provided by service' }}</small>
              } @else if (artistId.trim()) {
                <span>Manual ID · artist details are not loaded</span>
              }
            </div>
            <label for="song-name">Song name</label>
            <input id="song-name" name="songName" [(ngModel)]="songName" placeholder="Enter the track title" autocomplete="off" required />
            <label for="song-type">Song type</label>
            <select id="song-type" name="songType" [(ngModel)]="songType" required>
              <option value="" disabled>Select a genre</option>
              @for (type of songTypes; track type) {
                <option [value]="type">{{ type.replace('_', ' ') }}</option>
              }
            </select>
            <label class="admin-file-label" for="song-file"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z" /></svg>Audio file</label>
            <input id="song-file" name="songFile" type="file" accept="audio/*" (change)="setSongFile($event)" required />
            @if (songFile) { <span class="admin-file-selected"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>{{ songFile.name }}</span> }
            <label class="admin-file-label" for="song-image"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>Song cover</label>
            <input id="song-image" name="songImage" type="file" accept="image/*" (change)="setSongImage($event)" required />
            @if (songImage) { <span class="admin-file-selected"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>{{ songImage.name }}</span> }
            <button class="button button-light button-wide" type="submit" [disabled]="songForm.invalid || !songFile || !songImage || busy" [attr.aria-busy]="busy === 'song'">
              @if (busy === 'song') { <span class="admin-button-spinner" aria-hidden="true"></span> }
              @else { <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 16V4m-5 5 5-5 5 5M5 14v5h14v-5" /></svg> }
              <span>{{ busy === 'song' ? 'Uploading song…' : 'Upload song' }}</span>
            </button>
          </form>
        </section>

      </div>
      @if (error) { <div class="inline-alert error-alert" role="alert">{{ error }}</div> }
      @if (success) { <div class="inline-alert success-alert" role="status">{{ success }}</div> }
    </section>
  `,
})
export class AdminPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(MusicApiService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changeDetector = inject(ChangeDetectorRef);
  artistName = '';
  albumName = '';
  artistId = '';
  artistSearch = '';
  songSearch = '';
  songOptions: MediaItem[] = [];
  songsLoading = false;
  songLookupError = '';
  songPage = 0;
  songsPageCount = 1;
  private songRequestGeneration = 0;
  songName = '';
  songType = '';
  readonly songTypes = ['ROCK', 'CLASSICAL', 'POP', 'JAZZ', 'HIP_HOP', 'COUNTRY', 'OTHER'];
  songIdToDelete = '';
  artistImage: File | null = null;
  albumImage: File | null = null;
  songFile: File | null = null;
  songImage: File | null = null;
  artistImagePreview = '';
  albumImagePreview = '';
  songImagePreview = '';
  busy: '' | 'artist' | 'song' | 'delete' = '';
  error = '';
  success = '';
  artistOptions: MediaItem[] = [];
  private selectedArtistRecord: MediaItem | null = null;
  artistsLoading = false;
  artistLookupError = '';
  artistPage = 0;
  artistsPageCount = 1;
  private artistRequestGeneration = 0;
  private destroyed = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      void this.loadArtists();
      void this.loadSongs();
    }
  }

  setArtistImage(event: Event): void {
    this.artistImage = this.fileFrom(event);
    this.artistImagePreview = this.replacePreview(this.artistImagePreview, this.artistImage);
  }
  setAlbumImage(event: Event): void {
    this.albumImage = this.fileFrom(event);
    this.albumImagePreview = this.replacePreview(this.albumImagePreview, this.albumImage);
  }
  setSongFile(event: Event): void { this.songFile = this.fileFrom(event); }
  setSongImage(event: Event): void {
    this.songImage = this.fileFrom(event);
    this.songImagePreview = this.replacePreview(this.songImagePreview, this.songImage);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.artistRequestGeneration += 1;
    this.songRequestGeneration += 1;
    this.revokePreview(this.artistImagePreview);
    this.revokePreview(this.albumImagePreview);
    this.revokePreview(this.songImagePreview);
  }

  get selectedArtist(): MediaItem | null {
    return this.artistOptions.find((artist) => artist.id === this.artistId)
      ?? (this.selectedArtistRecord?.id === this.artistId ? this.selectedArtistRecord : null);
  }

  async loadArtists(page = 0, searchText = this.artistSearch): Promise<void> {
    const generation = ++this.artistRequestGeneration;
    this.artistsLoading = true;
    this.artistLookupError = '';
    try {
      const result = await this.api.artists(page, 10, searchText);
      if (this.destroyed || generation !== this.artistRequestGeneration) return;
      this.artistOptions = result.items.filter((artist) => !!artist.id);
      this.artistPage = result.page;
      this.artistsPageCount = result.totalPages ?? (result.items.length === 10 ? page + 2 : page + 1);
      const selectedArtist = this.artistOptions.find((artist) => artist.id === this.artistId);
      if (selectedArtist) this.selectedArtistRecord = selectedArtist;
    } catch (error) {
      if (this.destroyed || generation !== this.artistRequestGeneration) return;
      this.artistLookupError = this.api.toUserMessage(error);
    } finally {
      if (!this.destroyed && generation === this.artistRequestGeneration) {
        this.artistsLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  async loadSongs(page = 0, searchText = this.songSearch): Promise<void> {
    const generation = ++this.songRequestGeneration;
    this.songsLoading = true;
    this.songLookupError = '';
    try {
      const result = await this.api.songs(page, 10, searchText);
      if (this.destroyed || generation !== this.songRequestGeneration) return;
      this.songOptions = result.items.filter(song => !!song.id);
      this.songPage = result.page;
      this.songsPageCount = result.totalPages ?? (result.items.length === 10 ? page + 2 : page + 1);
    } catch (error) {
      if (this.destroyed || generation !== this.songRequestGeneration) return;
      this.songLookupError = this.api.toUserMessage(error);
    } finally {
      if (!this.destroyed && generation === this.songRequestGeneration) {
        this.songsLoading = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  searchSongs(): void { void this.loadSongs(0, this.songSearch.trim()); }

  changeSongPage(delta: number): void {
    const nextPage = this.songPage + delta;
    if (nextPage >= 0 && nextPage < this.songsPageCount) void this.loadSongs(nextPage, this.songSearch.trim());
  }

  async deleteCatalogSong(song: MediaItem): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !window.confirm(`Permanently delete "${song.name}"?`)) return;
    await this.perform('delete', 'Song deleted successfully.', () => this.api.deleteSong(song.id));
  }

  searchArtists(): void {
    void this.loadArtists(0, this.artistSearch.trim());
  }

  changeArtistPage(delta: number): void {
    const nextPage = this.artistPage + delta;
    if (nextPage >= 0 && nextPage < this.artistsPageCount) {
      void this.loadArtists(nextPage, this.artistSearch.trim());
    }
  }

  selectArtist(artist: MediaItem): void {
    this.artistId = artist.id;
    this.selectedArtistRecord = artist;
  }

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

  private replacePreview(previous: string, file: File | null): string {
    this.revokePreview(previous);
    return file ? URL.createObjectURL(file) : '';
  }

  private revokePreview(preview: string): void {
    if (preview) URL.revokeObjectURL(preview);
  }

  private async perform(operation: 'artist' | 'song' | 'delete', successMessage: string, action: () => Promise<void>): Promise<void> {
    this.busy = operation;
    this.error = '';
    this.success = '';
    try {
      await action();
      this.success = successMessage;
      if (operation === 'song' || operation === 'delete') {
        await this.loadSongs(0, this.songSearch.trim());
      }
      if (operation === 'artist') {
        this.artistSearch = this.artistName;
        await this.loadArtists(0, this.artistSearch);
        const createdArtist = this.artistOptions.find((artist) =>
          artist.name.trim().toLocaleLowerCase() === this.artistName.trim().toLocaleLowerCase());
        if (createdArtist) {
          this.selectArtist(createdArtist);
          this.success = 'Artist created and selected. Confirm the artist and album IDs before uploading.';
        } else {
          this.success = 'Artist created. Search for its name above to retrieve its artist ID.';
        }
      }
    } catch (error) {
      this.error = this.api.toUserMessage(error);
    } finally {
      this.busy = '';
      this.changeDetector.markForCheck();
    }
  }
}
