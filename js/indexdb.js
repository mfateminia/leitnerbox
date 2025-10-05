class IndexedDBWrapper {
    constructor(dbName, storeName, version = 2) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.version = version;
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create paragraphs object store if it doesn't exist
                if (!db.objectStoreNames.contains('paragraphs')) {
                    db.createObjectStore('paragraphs', { keyPath: 'id', autoIncrement: true });
                    console.log('Created paragraphs object store');
                }
                
                // Create words object store if it doesn't exist
                if (!db.objectStoreNames.contains('words')) {
                    db.createObjectStore('words', { keyPath: 'id', autoIncrement: true });
                    console.log('Created words object store');
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    async write(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async read(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async readAll() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clear() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => {
                console.log(`Successfully cleared object store: ${this.storeName}`);
                resolve();
            };
            request.onerror = () => {
                console.error(`Error clearing object store: ${this.storeName}`, request.error);
                reject(request.error);
            };
        });
    }

    async delete(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

// Usage example:
// const db = new IndexedDBWrapper('myDB', 'myStore');
// await db.open();
// await db.write({ name: 'Ali', age: 30 });
// const item = await db.read(1);
// const allItems = await db.readAll();