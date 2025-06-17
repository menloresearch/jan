import { Assistant } from '@janhq/core'

const DB_NAME = 'jan-assistants'
const DB_VERSION = 1
const ASSISTANTS_STORE = 'assistants'

class IndexedDBStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create assistants store
        if (!db.objectStoreNames.contains(ASSISTANTS_STORE)) {
          const assistantsStore = db.createObjectStore(ASSISTANTS_STORE, {
            keyPath: 'id',
          })
          assistantsStore.createIndex('created_at', 'created_at', {
            unique: false,
          })
          assistantsStore.createIndex('name', 'name', { unique: false })
        }
      }
    })
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) {
      throw new Error('Failed to initialize Assistant IndexedDB')
    }
    return this.db
  }

  async getAssistants(): Promise<Assistant[]> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSISTANTS_STORE], 'readonly')
      const store = transaction.objectStore(ASSISTANTS_STORE)
      const index = store.index('created_at')
      const request = index.openCursor(null, 'next') // Sort by created_at asc

      const assistants: Assistant[] = []
      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          assistants.push(cursor.value as Assistant)
          cursor.continue()
        } else {
          resolve(assistants)
        }
      }
      request.onerror = () => reject(request.error)
    })
  }

  async createAssistant(assistant: Assistant): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSISTANTS_STORE], 'readwrite')
      const store = transaction.objectStore(ASSISTANTS_STORE)
      const request = store.put(assistant)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async deleteAssistant(assistantId: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([ASSISTANTS_STORE], 'readwrite')
      const store = transaction.objectStore(ASSISTANTS_STORE)
      const request = store.delete(assistantId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

// Singleton instance
export const indexedDBStorage = new IndexedDBStorage()
