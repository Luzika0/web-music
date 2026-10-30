import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import initSqlJs, { type Database } from 'sql.js';

const DATABASE_NAME = 'ksong-media-cache';
const DATABASE_VERSION = 1;
const DATABASE_STORE = 'sqlite';
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_CACHE_BYTES = 48 * 1024 * 1024;
const MAX_CACHED_PAGE_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const PAGE_CACHE_FRESH_MS = 10 * 60 * 1000;
export const IMAGE_CACHE_FRESH_MS = 30 * 24 * 60 * 60 * 1000;

export interface CacheEntry<T> { value: T; cachedAt: number; }

@Injectable({ providedIn: 'root' })
export class MediaCacheService {
  readonly persistent = signal(false);

  private readonly platformId = inject(PLATFORM_ID);
  private databasePromise: Promise<Database> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistPromise: Promise<void> | null = null;
  private resolvePersist: (() => void) | null = null;
  private persistDatabase: Database | null = null;
  private persistVersion = 0;
  private savedVersion = 0;
  private persisting = false;

  async getPageEntry<T>(userId: string, key: string): Promise<CacheEntry<T> | null> {
    const database = await this.database();
    const statement = database.prepare(
      'SELECT payload, cached_at FROM media_pages WHERE user_id = ? AND cache_key = ? AND cached_at >= ?',
      [userId, key, Date.now() - MAX_CACHED_PAGE_AGE_MS],
    );
    try {
      if (!statement.step()) return null;
      const row = statement.getAsObject();
      const payload = row['payload'];
      const cachedAt = row['cached_at'];
      if (typeof payload !== 'string' || typeof cachedAt !== 'number') return null;
      return { value: JSON.parse(payload) as T, cachedAt };
    } finally {
      statement.free();
    }
  }

  async getPage<T>(userId: string, key: string): Promise<T | null> {
    return (await this.getPageEntry<T>(userId, key))?.value ?? null;
  }

  async deletePage(userId: string, key: string): Promise<void> {
    const database = await this.database();
    database.run('DELETE FROM media_pages WHERE user_id = ? AND cache_key = ?', [userId, key]);
    await this.persist(database);
  }

  async setPage(userId: string, key: string, value: unknown): Promise<void> {
    const database = await this.database();
    database.run(
      `INSERT INTO media_pages (user_id, cache_key, payload, cached_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, cache_key) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
      [userId, key, JSON.stringify(value), Date.now()],
    );
    database.run('DELETE FROM media_pages WHERE cached_at < ?', [Date.now() - MAX_CACHED_PAGE_AGE_MS]);
    await this.persist(database);
  }

  async getImageEntry(userId: string, imageKey: string): Promise<CacheEntry<Blob> | null> {
    const database = await this.database();
    const statement = database.prepare(
      'SELECT mime_type, image_data, cached_at FROM cached_images WHERE user_id = ? AND image_key = ?',
      [userId, imageKey],
    );
    try {
      if (!statement.step()) return null;
      const row = statement.getAsObject();
      const data = row['image_data'];
      const cachedAt = row['cached_at'];
      if (!(data instanceof Uint8Array) || typeof cachedAt !== 'number') return null;
      const bytes = new Uint8Array(data.byteLength);
      bytes.set(data);
      return {
        value: new Blob([bytes.buffer], {
          type: typeof row['mime_type'] === 'string' ? row['mime_type'] : 'application/octet-stream',
        }),
        cachedAt,
      };
    } finally {
      statement.free();
    }
  }

  async getImage(userId: string, imageKey: string): Promise<Blob | null> {
    return (await this.getImageEntry(userId, imageKey))?.value ?? null;
  }

  async setImage(userId: string, imageKey: string, image: Blob): Promise<void> {
    if (image.size === 0 || image.size > MAX_IMAGE_SIZE_BYTES) return;
    const database = await this.database();
    const bytes = new Uint8Array(await image.arrayBuffer());
    database.run(
      `INSERT INTO cached_images (user_id, image_key, mime_type, image_data, cached_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, image_key) DO UPDATE SET mime_type = excluded.mime_type, image_data = excluded.image_data, cached_at = excluded.cached_at`,
      [userId, imageKey, image.type || 'application/octet-stream', bytes, Date.now()],
    );
    this.pruneImages(database, userId, imageKey);
    await this.persist(database);
  }

  async clearUser(userId: string): Promise<void> {
    if (!this.databasePromise) return;
    const database = await this.database();
    database.run('DELETE FROM media_pages WHERE user_id = ?', [userId]);
    database.run('DELETE FROM cached_images WHERE user_id = ?', [userId]);
    await this.persist(database);
  }

  async invalidateCatalog(): Promise<void> {
    if (!this.databasePromise) return;
    const database = await this.database();
    database.run("DELETE FROM media_pages WHERE cache_key LIKE 'songs:%' OR cache_key LIKE 'artists:%'");
    await this.persist(database);
  }

  reportUnavailable(): void {
    this.persistent.set(false);
  }

  private database(): Promise<Database> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.reject(new Error('The local media database is available only in a browser.'));
    }
    if (!this.databasePromise) {
      this.databasePromise = this.openDatabase();
    }
    return this.databasePromise;
  }

  private async openDatabase(): Promise<Database> {
    const sql = await initSqlJs({
      locateFile: (file) => new URL(`assets/sql/${file}`, document.baseURI).toString(),
    });
    let restored: Uint8Array | null = null;
    if (typeof indexedDB !== 'undefined') {
      try {
        restored = await this.readSnapshot();
        this.persistent.set(true);
      } catch {
        this.reportUnavailable();
      }
    } else {
      this.reportUnavailable();
    }

    const database = new sql.Database(restored);
    database.run(`
      CREATE TABLE IF NOT EXISTS media_pages (
        user_id TEXT NOT NULL,
        cache_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        cached_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, cache_key)
      );
      CREATE TABLE IF NOT EXISTS cached_images (
        user_id TEXT NOT NULL,
        image_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        image_data BLOB NOT NULL,
        cached_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, image_key)
      );
      CREATE INDEX IF NOT EXISTS cached_images_age ON cached_images(user_id, cached_at);
    `);
    return database;
  }

  private async readSnapshot(): Promise<Uint8Array | null> {
    const storage = await this.openStorage();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = storage.transaction(DATABASE_STORE, 'readonly');
        const request = transaction.objectStore(DATABASE_STORE).get('database');
        request.onsuccess = () => {
          const value: unknown = request.result;
          if (value instanceof ArrayBuffer) resolve(new Uint8Array(value));
          else if (value instanceof Uint8Array) resolve(new Uint8Array(value));
          else resolve(null);
        };
        request.onerror = () => reject(request.error ?? new Error('Could not read the local SQLite database.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not read the local SQLite database.'));
      });
    } finally {
      storage.close();
    }
  }

  private openStorage(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DATABASE_STORE)) {
          request.result.createObjectStore(DATABASE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open local media storage.'));
      request.onblocked = () => reject(new Error('Local media storage is blocked by another open tab.'));
    });
  }

  private pruneImages(database: Database, userId: string, newestKey: string): void {
    const total = database.exec(
      'SELECT COALESCE(SUM(length(image_data)), 0) AS total FROM cached_images WHERE user_id = ?',
      [userId],
    )[0]?.values[0]?.[0];
    let totalBytes = typeof total === 'number' ? total : 0;
    while (totalBytes > MAX_IMAGE_CACHE_BYTES) {
      const oldest = database.exec(
        `SELECT image_key, length(image_data) FROM cached_images
         WHERE user_id = ? AND image_key <> ?
         ORDER BY cached_at ASC LIMIT 1`,
        [userId, newestKey],
      )[0]?.values[0];
      if (!oldest || typeof oldest[0] !== 'string' || typeof oldest[1] !== 'number') break;
      database.run('DELETE FROM cached_images WHERE user_id = ? AND image_key = ?', [userId, oldest[0]]);
      totalBytes -= oldest[1];
    }
  }

  private persist(database: Database): Promise<void> {
    if (!this.persistent()) return Promise.resolve();
    this.persistDatabase = database;
    this.persistVersion += 1;
    if (!this.persistPromise) {
      this.persistPromise = new Promise((resolve) => this.resolvePersist = resolve);
    }
    this.schedulePersist();
    return this.persistPromise;
  }

  private schedulePersist(): void {
    if (this.persisting || this.persistTimer || !this.persistent()) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.saveSnapshot();
    }, 75);
  }

  private async saveSnapshot(): Promise<void> {
    const database = this.persistDatabase;
    if (!database || !this.persistent()) {
      this.finishPersist();
      return;
    }
    this.persisting = true;
    const version = this.persistVersion;
    let storage: IDBDatabase | null = null;
    try {
      const snapshot = database.export();
      storage = await this.openStorage();
      const databaseStorage = storage;
      await new Promise<void>((resolve, reject) => {
        const transaction = databaseStorage.transaction(DATABASE_STORE, 'readwrite');
        transaction.objectStore(DATABASE_STORE).put(snapshot, 'database');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local media cache.'));
        transaction.onabort = () => reject(transaction.error ?? new Error('Could not save local media cache.'));
      });
    } catch {
      this.reportUnavailable();
    } finally {
      storage?.close();
      this.savedVersion = version;
      this.persisting = false;
    }

    if (this.persistent() && this.savedVersion < this.persistVersion) {
      this.schedulePersist();
    } else {
      this.finishPersist();
    }
  }

  private finishPersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    this.persistDatabase = null;
    const resolve = this.resolvePersist;
    this.resolvePersist = null;
    this.persistPromise = null;
    resolve?.();
  }
}
