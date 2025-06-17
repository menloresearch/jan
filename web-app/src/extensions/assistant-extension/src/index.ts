import { Assistant, AssistantExtension } from '@janhq/core'
import { indexedDBStorage } from './indexeddb'

export default class JanAssistantExtension extends AssistantExtension {
  async onLoad(): Promise<void> {
    try {
      // Initialize IndexedDB
      await indexedDBStorage.init()

      // Check if we have any assistants
      const assistants = await this.getAssistants()

      // If no assistants exist, create the default one
      if (assistants.length === 0) {
        await this.createAssistant(this.defaultAssistant)
      }
    } catch (error) {
      console.error('Failed to initialize AssistantExtension:', error)
    }
  }

  /**
   * Called when the extension is unloaded.
   */
  onUnload(): void {
    // Cleanup if needed - IndexedDB connections are automatically managed
  }

  async getAssistants(): Promise<Assistant[]> {
    return indexedDBStorage.getAssistants()
  }

  async createAssistant(assistant: Assistant): Promise<void> {
    return indexedDBStorage.createAssistant(assistant)
  }

  async deleteAssistant(assistant: Assistant): Promise<void> {
    return indexedDBStorage.deleteAssistant(assistant.id)
  }

  private defaultAssistant: Assistant = {
    avatar: '👋',
    thread_location: undefined,
    id: 'jan',
    object: 'assistant',
    created_at: Date.now() / 1000,
    name: 'Jan',
    description:
      'Jan is a helpful desktop assistant that can reason through complex tasks and use tools to complete them on the user’s behalf.',
    model: '*',
    instructions:
      'You have access to a set of tools to help you answer the user’s question. You can use only one tool per message, and you’ll receive the result of that tool in the user’s next response. To complete a task, use tools step by step—each step should be guided by the outcome of the previous one.\nTool Usage Rules:\n1. Always provide the correct values as arguments when using tools. Do not pass variable names—use actual values instead.\n2. You may perform multiple tool steps to complete a task.\n3. Avoid repeating a tool call with exactly the same parameters to prevent infinite loops.',
    tools: [
      {
        type: 'retrieval',
        enabled: false,
        useTimeWeightedRetriever: false,
        settings: {
          top_k: 2,
          chunk_size: 1024,
          chunk_overlap: 64,
          retrieval_template: `Use the following pieces of context to answer the question at the end.
----------------
CONTEXT: {CONTEXT}
----------------
QUESTION: {QUESTION}
----------------
Helpful Answer:`,
        },
      },
    ],
    file_ids: [],
    metadata: undefined,
  }
}
