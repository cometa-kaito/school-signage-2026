// lib/image-cache.ts - IndexedDBを使用した画像キャッシュモジュール

const DB_NAME = "signage-image-cache";
const DB_VERSION = 1;
const STORE_NAME = "images";
const FETCH_TIMEOUT = 10000; // 10秒

interface CacheRecord {
  id: string;
  blob: Blob;
  url: string;
  cachedAt: number;
}

interface CacheStats {
  count: number;
  totalSize: number;
}

class ImageCacheClass {
  private db: IDBDatabase | null = null;
  private blobUrls: Map<string, string> = new Map();

  // ========================================
  // 初期化
  // ========================================

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB open error:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }

        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("cachedAt", "cachedAt", { unique: false });
      };
    });
  }

  // ========================================
  // キャッシュ操作
  // ========================================

  /**
   * 画像をダウンロードしてキャッシュに保存
   */
  async cacheImage(id: string, url: string): Promise<boolean> {
    try {
      await this.init();

      const blob = await this.fetchImageBlob(url);
      if (!blob) return false;

      return this.saveToStore(id, url, blob);
    } catch (error) {
      console.error(`ImageCache: Error caching image ${id}:`, error);
      return false;
    }
  }

  /**
   * 画像をフェッチしてBlobを取得
   */
  private async fetchImageBlob(url: string): Promise<Blob | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        mode: "cors",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      return blob;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        console.warn("ImageCache: Fetch timeout");
      } else {
        console.warn("ImageCache: CORS blocked or fetch failed, skipping cache");
      }

      return null;
    }
  }

  /**
   * BlobをIndexedDBに保存
   */
  private saveToStore(id: string, url: string, blob: Blob): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      const record: CacheRecord = {
        id,
        blob,
        url,
        cachedAt: Date.now(),
      };

      const request = store.put(record);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        console.error(`ImageCache: Failed to cache image ${id}`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * キャッシュから画像を取得（Blob URL形式）
   */
  async getImage(id: string): Promise<string | null> {
    try {
      await this.init();

      // 既存のBlob URLがあれば再利用
      if (this.blobUrls.has(id)) {
        return this.blobUrls.get(id)!;
      }

      return new Promise((resolve) => {
        if (!this.db) {
          resolve(null);
          return;
        }

        const transaction = this.db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const record = request.result as CacheRecord | undefined;
          if (record?.blob) {
            const blobUrl = URL.createObjectURL(record.blob);
            this.blobUrls.set(id, blobUrl);
            resolve(blobUrl);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error(`ImageCache: Error getting image ${id}`, request.error);
          resolve(null);
        };
      });
    } catch (error) {
      console.error("ImageCache: Error in getImage:", error);
      return null;
    }
  }

  /**
   * 画像がキャッシュされているか確認
   */
  async hasImage(id: string): Promise<boolean> {
    try {
      await this.init();

      return new Promise((resolve) => {
        if (!this.db) {
          resolve(false);
          return;
        }

        const transaction = this.db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.count(IDBKeyRange.only(id));

        request.onsuccess = () => resolve(request.result > 0);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  // ========================================
  // 削除操作
  // ========================================

  /**
   * 特定の画像をキャッシュから削除
   */
  async removeImage(id: string): Promise<boolean> {
    try {
      await this.init();
      this.revokeBlobUrl(id);

      return new Promise((resolve) => {
        if (!this.db) {
          resolve(false);
          return;
        }

        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * 不要なキャッシュを削除（現在のads配列にないもの）
   */
  async cleanup(currentAdIds: string[]): Promise<number> {
    try {
      await this.init();

      const currentIdSet = new Set(currentAdIds);
      let removedCount = 0;

      return new Promise((resolve) => {
        if (!this.db) {
          resolve(0);
          return;
        }

        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const id = cursor.value.id as string;
            if (!currentIdSet.has(id)) {
              this.revokeBlobUrl(id);
              cursor.delete();
              removedCount++;
            }
            cursor.continue();
          } else {
            resolve(removedCount);
          }
        };

        request.onerror = () => resolve(removedCount);
      });
    } catch (error) {
      console.error("ImageCache: Error in cleanup:", error);
      return 0;
    }
  }

  /**
   * 全てのキャッシュをクリア
   */
  async clearAll(): Promise<boolean> {
    try {
      await this.init();

      // 全てのBlob URLを解放
      this.blobUrls.forEach((url) => URL.revokeObjectURL(url));
      this.blobUrls.clear();

      return new Promise((resolve) => {
        if (!this.db) {
          resolve(false);
          return;
        }

        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch (error) {
      console.error("ImageCache: Error clearing cache:", error);
      return false;
    }
  }

  // ========================================
  // 統計情報
  // ========================================

  /**
   * キャッシュの統計情報を取得
   */
  async getStats(): Promise<CacheStats> {
    try {
      await this.init();

      return new Promise((resolve) => {
        if (!this.db) {
          resolve({ count: 0, totalSize: 0 });
          return;
        }

        const transaction = this.db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        let count = 0;
        let totalSize = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            count++;
            if (cursor.value.blob) {
              totalSize += (cursor.value.blob as Blob).size;
            }
            cursor.continue();
          } else {
            resolve({ count, totalSize });
          }
        };

        request.onerror = () => resolve({ count: 0, totalSize: 0 });
      });
    } catch {
      return { count: 0, totalSize: 0 };
    }
  }

  // ========================================
  // ユーティリティ
  // ========================================

  /**
   * Blob URLを解放
   */
  private revokeBlobUrl(id: string): void {
    if (this.blobUrls.has(id)) {
      URL.revokeObjectURL(this.blobUrls.get(id)!);
      this.blobUrls.delete(id);
    }
  }
}

/** シングルトンインスタンス */
export const ImageCache = new ImageCacheClass();
