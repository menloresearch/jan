/**
 * Storage utilities to replace Tauri functionality with web-based alternatives
 */

// Settings storage using localStorage
export const settingsStorage = {
  get: <T>(key: string, defaultValue?: T): T | undefined => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : defaultValue
    } catch (error) {
      console.error(`Error reading from localStorage key "${key}":`, error)
      return defaultValue
    }
  },

  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error)
    }
  },

  remove: (key: string): void => {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      console.error(`Error removing localStorage key "${key}":`, error)
    }
  },

  clear: (): void => {
    try {
      localStorage.clear()
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }
}

// Large data storage using IndexedDB (for conversations, prompts, etc.)
class LargeDataStorage {
  private dbName = 'jan-large-data'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create store for large text data (prompts, conversations, etc.)
        if (!db.objectStoreNames.contains('large-data')) {
          const store = db.createObjectStore('large-data', { keyPath: 'key' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init()
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB for large data storage')
    }
    return this.db
  }

  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['large-data'], 'readonly')
      const store = transaction.objectStore('large-data')
      const request = store.get(key)

      request.onsuccess = () => {
        const result = request.result
        resolve(result ? result.value : undefined)
      }
      request.onerror = () => reject(request.error)
    })
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['large-data'], 'readwrite')
      const store = transaction.objectStore('large-data')
      const request = store.put({
        key,
        value,
        timestamp: Date.now()
      })

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async remove(key: string): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['large-data'], 'readwrite')
      const store = transaction.objectStore('large-data')
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['large-data'], 'readwrite')
      const store = transaction.objectStore('large-data')
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}

export const largeDataStorage = new LargeDataStorage()

// Event system to replace Tauri events
class WebEventSystem {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map()

  on(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event)
      if (eventListeners) {
        eventListeners.delete(callback)
        if (eventListeners.size === 0) {
          this.listeners.delete(event)
        }
      }
    }
  }

  emit(event: string, data?: any): void {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error)
        }
      })
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (!callback) {
      this.listeners.delete(event)
      return
    }

    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.delete(callback)
      if (eventListeners.size === 0) {
        this.listeners.delete(event)
      }
    }
  }
}

export const webEventSystem = new WebEventSystem()

// File system utilities (web-based replacements)
export const fileSystemUtils = {
  // Replace file dialog functionality
  openFileDialog: async (options?: {
    multiple?: boolean
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<File[] | null> => {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = options?.multiple ?? false
      
      if (options?.filters) {
        const extensions = options.filters.flatMap(f => f.extensions.map(ext => `.${ext}`))
        input.accept = extensions.join(',')
      }

      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files
        resolve(files ? Array.from(files) : null)
      }

      input.oncancel = () => resolve(null)
      input.click()
    })
  },

  // Replace directory dialog functionality
  openDirectoryDialog: async (): Promise<FileSystemDirectoryHandle | null> => {
    try {
      if ('showDirectoryPicker' in window) {
        return await (window as any).showDirectoryPicker()
      }
      console.warn('Directory picker not supported in this browser')
      return null
    } catch (error) {
      console.error('Error opening directory dialog:', error)
      return null
    }
  },

  // Replace reveal in file manager
  revealInFileManager: (path: string): void => {
    console.warn('Reveal in file manager not supported in web environment. Path:', path)
    // Could potentially show a toast with the path or copy to clipboard
  },

  // Download file functionality
  downloadFile: (content: string | Blob, filename: string): void => {
    const blob = typeof content === 'string' ? new Blob([content], { type: 'text/plain' }) : content
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

// Window management utilities
export const windowUtils = {
  // Replace Tauri window theme setting
  setTheme: (theme: 'light' | 'dark' | null): void => {
    if (theme === null) {
      // Auto theme - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', prefersDark)
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  },

  // Replace window creation
  createWindow: (url: string, options?: { title?: string; width?: number; height?: number }): Window | null => {
    const features = []
    if (options?.width) features.push(`width=${options.width}`)
    if (options?.height) features.push(`height=${options.height}`)
    
    return window.open(url, options?.title || '_blank', features.join(','))
  },

  // Replace app relaunch
  relaunch: (): void => {
    window.location.reload()
  }
}

// App update utilities (web-based mock)
export const updateUtils = {
  checkForUpdate: async (): Promise<{ version: string; available: boolean } | null> => {
    // In a real web app, this would check against your update server
    console.log('Update check not implemented for web environment')
    return null
  },

  downloadAndInstall: async (onProgress?: (progress: number) => void): Promise<void> => {
    // Mock implementation for web environment
    console.log('Auto-update not available in web environment')
    if (onProgress) {
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        onProgress(i / 100)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
  }
}