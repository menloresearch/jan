import { defaultAssistant } from '@/hooks/useAssistant'
import { indexedDBStorage } from '@/lib/indexeddb'

/**
 * Fetches all threads from IndexedDB.
 * @returns {Promise<Thread[]>} A promise that resolves to an array of threads.
 */
export const fetchThreads = async (): Promise<Thread[]> => {
  try {
    const threads = await indexedDBStorage.listThreads()
    return threads.map((thread) => ({
      ...thread,
      assistants: thread.assistants ?? [defaultAssistant],
    }))
  } catch (error) {
    console.error('Error fetching threads:', error)
    return []
  }
}

/**
 * Creates a new thread using IndexedDB.
 * @param thread - The thread object to create.
 * @returns {Promise<Thread>} A promise that resolves to the created thread.
 */
export const createThread = async (thread: Thread): Promise<Thread> => {
  try {
    const createdThread = await indexedDBStorage.createThread({
      ...thread,
      assistants: thread.assistants ?? [defaultAssistant],
    })
    return createdThread
  } catch (error) {
    console.error('Error creating thread:', error)
    return thread
  }
}

/**
 * Updates an existing thread using IndexedDB.
 * @param thread - The thread object to update.
 */
export const updateThread = async (thread: Thread): Promise<void> => {
  try {
    await indexedDBStorage.modifyThread(thread)
  } catch (error) {
    console.error('Error updating thread:', error)
  }
}

/**
 * Deletes a thread using IndexedDB.
 * @param threadId - The ID of the thread to delete.
 * @returns
 */
export const deleteThread = async (threadId: string): Promise<void> => {
  try {
    await indexedDBStorage.deleteThread(threadId)
  } catch (error) {
    console.error('Error deleting thread:', error)
  }
}
