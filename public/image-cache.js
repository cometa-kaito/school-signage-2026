// image-cache.js - IndexedDBを使用した画像キャッシュモジュール

// ========================================
// 定数
// ========================================

const DB_NAME = 'signage-image-cache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const FETCH_TIMEOUT = 10000; // 10秒

// ========================================
// ImageCacheモジュール
// ========================================

/**
 * 画像キャッシュモジュール
 * IndexedDBを使用して画像をBlobとして保存し、
 * ネットワークが制限された環境でも画像を表示できるようにする
 */
export const ImageCache = {
    /** @type {IDBDatabase|null} */
    db: null,

    /** @type {Map<string, string>} メモリ内でBlob URLを管理 */
    blobUrls: new Map(),

    // ========================================
    // 初期化
    // ========================================

    /**
     * IndexedDBを初期化
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB open error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('ImageCache: IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }

                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('cachedAt', 'cachedAt', { unique: false });
                console.log('ImageCache: Object store created');
            };
        });
    },

    // ========================================
    // キャッシュ操作
    // ========================================

    /**
     * 画像をダウンロードしてキャッシュに保存
     * @param {string} id - 画像ID
     * @param {string} url - 画像URL
     * @returns {Promise<boolean>}
     */
    async cacheImage(id, url) {
        try {
            await this.init();

            console.log(`ImageCache: Fetching image ${id} from ${url}`);

            const blob = await this.fetchImageBlob(url);
            if (!blob) return false;

            return this.saveToStore(id, url, blob);
        } catch (error) {
            console.error(`ImageCache: Error caching image ${id}:`, error);
            return false;
        }
    },

    /**
     * 画像をフェッチしてBlobを取得
     * @param {string} url
     * @returns {Promise<Blob|null>}
     */
    async fetchImageBlob(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

        try {
            const response = await fetch(url, {
                mode: 'cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            console.log(`ImageCache: Got blob, size: ${blob.size} bytes`);
            return blob;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                console.warn('ImageCache: Fetch timeout');
            } else {
                console.warn(`ImageCache: CORS blocked or fetch failed, skipping cache`);
            }

            return null;
        }
    },

    /**
     * BlobをIndexedDBに保存
     * @param {string} id
     * @param {string} url
     * @param {Blob} blob
     * @returns {Promise<boolean>}
     */
    saveToStore(id, url, blob) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const record = {
                id,
                blob,
                url,
                cachedAt: Date.now()
            };

            const request = store.put(record);

            request.onsuccess = () => {
                console.log(`ImageCache: Cached image ${id}`);
                resolve(true);
            };

            request.onerror = () => {
                console.error(`ImageCache: Failed to cache image ${id}`, request.error);
                reject(request.error);
            };
        });
    },

    /**
     * キャッシュから画像を取得（Blob URL形式）
     * @param {string} id
     * @returns {Promise<string|null>}
     */
    async getImage(id) {
        try {
            await this.init();

            // 既存のBlob URLがあれば再利用
            if (this.blobUrls.has(id)) {
                return this.blobUrls.get(id);
            }

            return new Promise((resolve) => {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(id);

                request.onsuccess = () => {
                    const record = request.result;
                    if (record?.blob) {
                        const blobUrl = URL.createObjectURL(record.blob);
                        this.blobUrls.set(id, blobUrl);
                        console.log(`ImageCache: Retrieved image ${id} from cache`);
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
            console.error('ImageCache: Error in getImage:', error);
            return null;
        }
    },

    /**
     * 画像がキャッシュされているか確認
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async hasImage(id) {
        try {
            await this.init();

            return new Promise((resolve) => {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.count(IDBKeyRange.only(id));

                request.onsuccess = () => resolve(request.result > 0);
                request.onerror = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    },

    // ========================================
    // 削除操作
    // ========================================

    /**
     * 特定の画像をキャッシュから削除
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async removeImage(id) {
        try {
            await this.init();
            this.revokeBlobUrl(id);

            return new Promise((resolve) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.delete(id);

                request.onsuccess = () => {
                    console.log(`ImageCache: Removed image ${id}`);
                    resolve(true);
                };
                request.onerror = () => resolve(false);
            });
        } catch (error) {
            return false;
        }
    },

    /**
     * 不要なキャッシュを削除（現在のads配列にないもの）
     * @param {string[]} currentAdIds
     * @returns {Promise<number>}
     */
    async cleanup(currentAdIds) {
        try {
            await this.init();

            const currentIdSet = new Set(currentAdIds);
            let removedCount = 0;

            return new Promise((resolve) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.openCursor();

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const id = cursor.value.id;
                        if (!currentIdSet.has(id)) {
                            this.revokeBlobUrl(id);
                            cursor.delete();
                            removedCount++;
                            console.log(`ImageCache: Cleaned up old image ${id}`);
                        }
                        cursor.continue();
                    } else {
                        if (removedCount > 0) {
                            console.log(`ImageCache: Cleanup complete, removed ${removedCount} images`);
                        }
                        resolve(removedCount);
                    }
                };

                request.onerror = () => resolve(removedCount);
            });
        } catch (error) {
            console.error('ImageCache: Error in cleanup:', error);
            return 0;
        }
    },

    /**
     * 全てのキャッシュをクリア
     * @returns {Promise<boolean>}
     */
    async clearAll() {
        try {
            await this.init();

            // 全てのBlob URLを解放
            this.blobUrls.forEach((url) => URL.revokeObjectURL(url));
            this.blobUrls.clear();

            return new Promise((resolve) => {
                const transaction = this.db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => {
                    console.log('ImageCache: All cache cleared');
                    resolve(true);
                };
                request.onerror = () => resolve(false);
            });
        } catch (error) {
            console.error('ImageCache: Error clearing cache:', error);
            return false;
        }
    },

    // ========================================
    // 統計情報
    // ========================================

    /**
     * キャッシュの統計情報を取得
     * @returns {Promise<{count: number, totalSize: number}>}
     */
    async getStats() {
        try {
            await this.init();

            return new Promise((resolve) => {
                const transaction = this.db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.openCursor();

                let count = 0;
                let totalSize = 0;

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        count++;
                        if (cursor.value.blob) {
                            totalSize += cursor.value.blob.size;
                        }
                        cursor.continue();
                    } else {
                        resolve({ count, totalSize });
                    }
                };

                request.onerror = () => resolve({ count: 0, totalSize: 0 });
            });
        } catch (error) {
            return { count: 0, totalSize: 0 };
        }
    },

    // ========================================
    // ユーティリティ
    // ========================================

    /**
     * Blob URLを解放
     * @param {string} id
     */
    revokeBlobUrl(id) {
        if (this.blobUrls.has(id)) {
            URL.revokeObjectURL(this.blobUrls.get(id));
            this.blobUrls.delete(id);
        }
    }
};

// デバッグ用にグローバルに公開
window.ImageCache = ImageCache;
