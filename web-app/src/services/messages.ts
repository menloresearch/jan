import { indexedDBStorage } from '@/lib/indexeddb'
import { ThreadMessage } from '@janhq/core'

/**
 * @fileoverview Fetch messages from IndexedDB.
 * @param threadId
 * @returns
 */
export const fetchMessages = async (
  threadId: string
): Promise<ThreadMessage[]> => {
  try {
    return await indexedDBStorage.listMessages(threadId)
  } catch (error) {
    console.error('Error fetching messages:', error)
    return []
  }
}

/**
 * @fileoverview Create a message using IndexedDB.
 * @param message
 * @returns
 */
export const createMessage = async (
  message: ThreadMessage
): Promise<ThreadMessage> => {
  try {
    return await indexedDBStorage.createMessage(message)
  } catch (error) {
    console.error('Error creating message:', error)
    return message
  }
}

/**
 * @fileoverview Delete a message using IndexedDB.
 * @param threadId
 * @param messageID
 * @returns
 */
export const deleteMessage = async (threadId: string, messageId: string): Promise<void> => {
  try {
    await indexedDBStorage.deleteMessage(threadId, messageId)
  } catch (error) {
    console.error('Error deleting message:', error)
  }
}
