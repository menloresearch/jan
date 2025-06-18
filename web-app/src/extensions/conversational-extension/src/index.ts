import { ConversationalExtension, Thread, ThreadMessage } from '@janhq/core'
import { indexedDBStorage } from './indexeddb'

export default class BrowserConversationalExtension extends ConversationalExtension {
  async onLoad(): Promise<void> {
    console.log('Browser conversationa extension loaded')
    try {
      await indexedDBStorage.init()
    } catch (err) {
      console.warn('IndexedDB failed to iniate: ', err)
    }
  }

  async onUnload(): Promise<void> {}

  async listThreads(): Promise<Thread[]> {
    return indexedDBStorage.listThreads()
  }

  async createThread(thread: Thread): Promise<Thread> {
    return indexedDBStorage.createThread(thread)
  }

  async modifyThread(thread: Thread): Promise<void> {
    return indexedDBStorage.modifyThread(thread)
  }

  async deleteThread(threadId: string): Promise<void> {
    return indexedDBStorage.deleteThread(threadId)
  }

  async createMessage(message: ThreadMessage): Promise<ThreadMessage> {
    return indexedDBStorage.createMessage(message)
  }

  async modifyMessage(message: ThreadMessage): Promise<ThreadMessage> {
    return indexedDBStorage.modifyMessage(message)
  }

  async deleteMessage(_threadId: string, messageId: string): Promise<void> {
    return indexedDBStorage.deleteMessage(messageId)
  }

  async listMessages(threadId: string): Promise<ThreadMessage[]> {
    return indexedDBStorage.listMessages(threadId)
  }
}
