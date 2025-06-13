import { ThreadMessage } from "@janhq/core";

const DB_NAME = "jan-conversations";
const DB_VERSION = 1;
const THREADS_STORE = "threads";
const MESSAGES_STORE = "messages";

interface IndexedDBThread {
  id: string;
  title: string;
  created: number;
  updated: number;
  assistants: ThreadAssistantInfo[];
  metadata?: {
    order?: number;
    is_favorite?: boolean;
  };
  object: "thread";
}

class IndexedDBStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create threads store
        if (!db.objectStoreNames.contains(THREADS_STORE)) {
          const threadsStore = db.createObjectStore(THREADS_STORE, {
            keyPath: "id",
          });
          threadsStore.createIndex("updated", "updated", { unique: false });
          threadsStore.createIndex("created", "created", { unique: false });
        } else {
          // Handle migration - add created index if it doesn't exist
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const threadsStore = transaction.objectStore(THREADS_STORE);
            if (!threadsStore.indexNames.contains("created")) {
              threadsStore.createIndex("created", "created", { unique: false });
            }
          }
        }

        // Create messages store
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messagesStore = db.createObjectStore(MESSAGES_STORE, {
            keyPath: "id",
          });
          messagesStore.createIndex("thread_id", "thread_id", {
            unique: false,
          });
          messagesStore.createIndex("created_at", "created_at", {
            unique: false,
          });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error("Failed to initialize IndexedDB");
    }
    return this.db;
  }

  // Thread operations
  async listThreads(): Promise<Thread[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([THREADS_STORE], "readonly");
      const store = transaction.objectStore(THREADS_STORE);
      const index = store.index("created");
      const request = index.openCursor(null, "prev"); // Sort by created desc

      const threads: Thread[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const thread = cursor.value as IndexedDBThread;
          threads.push({
            ...thread,
            order: thread.metadata?.order,
            isFavorite: thread.metadata?.is_favorite,
            model: {
              id: thread.assistants?.[0]?.model?.id,
              provider: thread.assistants?.[0]?.model?.engine,
            },
          } as Thread);
          cursor.continue();
        } else {
          resolve(threads);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async createThread(thread: Thread): Promise<Thread> {
    const db = await this.ensureDB();
    const now = Date.now() / 1000;

    const dbThread: IndexedDBThread = {
      id: thread.id,
      title: thread.title,
      created: now,
      updated: now,
      object: "thread",
      assistants:
        thread.assistants?.map((assistant) => ({
          ...assistant,
          model: {
            id: thread.model?.id ?? "*",
            engine: thread.model?.provider ?? "llama.cpp",
          },
        })) ?? [],
      metadata: {
        order: thread.order,
        is_favorite: thread.isFavorite,
      },
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([THREADS_STORE], "readwrite");
      const store = transaction.objectStore(THREADS_STORE);
      const request = store.add(dbThread);

      request.onsuccess = () => {
        resolve({
          ...thread,
          created: now,
          updated: now,
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async modifyThread(thread: Thread): Promise<void> {
    const db = await this.ensureDB();
    const now = Date.now() / 1000;

    const dbThread: IndexedDBThread = {
      id: thread.id,
      title: thread.title,
      created: thread.created ?? now,
      updated: thread.updated ?? now,
      object: "thread",
      assistants:
        thread.assistants?.map((assistant) => ({
          ...assistant,
          model: {
            id: thread.model?.id ?? "*",
            engine: thread.model?.provider ?? "llama.cpp",
          },
        })) ?? [],
      metadata: {
        order: thread.order,
        is_favorite: thread.isFavorite,
      },
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([THREADS_STORE], "readwrite");
      const store = transaction.objectStore(THREADS_STORE);
      const request = store.put(dbThread);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteThread(threadId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [THREADS_STORE, MESSAGES_STORE],
        "readwrite",
      );

      // Delete thread
      const threadsStore = transaction.objectStore(THREADS_STORE);
      threadsStore.delete(threadId);

      // Delete all messages for this thread
      const messagesStore = transaction.objectStore(MESSAGES_STORE);
      const messagesIndex = messagesStore.index("thread_id");
      const messagesRequest = messagesIndex.openCursor(
        IDBKeyRange.only(threadId),
      );

      messagesRequest.onsuccess = () => {
        const cursor = messagesRequest.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Message operations
  async listMessages(threadId: string): Promise<ThreadMessage[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], "readonly");
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index("thread_id");
      const request = index.getAll(threadId);

      request.onsuccess = () => {
        const messages = request.result as ThreadMessage[];
        // Sort by created_at ascending
        messages.sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async createMessage(message: ThreadMessage): Promise<ThreadMessage> {
    const db = await this.ensureDB();
    const messageWithTimestamp = {
      ...message,
      created_at: message.created_at ?? Date.now() / 1000,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], "readwrite");
      const store = transaction.objectStore(MESSAGES_STORE);
      const request = store.add(messageWithTimestamp);

      request.onsuccess = () => resolve(messageWithTimestamp);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteMessage(_threadId: string, messageId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE], "readwrite");
      const store = transaction.objectStore(MESSAGES_STORE);
      const request = store.delete(messageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Singleton instance
export const indexedDBStorage = new IndexedDBStorage();

