import { Assistant, AssistantExtension, ToolManager } from '@janhq/core'
import { RetrievalTool } from './tools/retrieval'
import { FunctionTool } from './tools/function'

export default class JanAssistantExtension extends AssistantExtension {
  async onLoad() {
    // Register the retrieval tool
    ToolManager.instance().register(new RetrievalTool())
    ToolManager.instance().register(new FunctionTool())
  }

  /**
   * Called when the extension is unloaded.
   */
  onUnload(): void {}

  async getAssistants(): Promise<Assistant[]> {
    // Just return default Jan assistant right away
    return [this.defaultAssistant]
  }

  async createAssistant(assistant: Assistant): Promise<void> {
    // Do not create assistant for now
    // Just use default Jan assistant
  }

  async deleteAssistant(assistant: Assistant): Promise<void> {
    // We don't have the ability to delete assistants for now
  }

  private defaultAssistant: Assistant = {
    avatar: '',
    thread_location: undefined,
    id: 'jan',
    object: 'assistant',
    created_at: Date.now() / 1000,
    name: 'Jan',
    description: 'A default assistant that can use all downloaded models',
    model: '*',
    instructions: '',
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
      {
        type: 'function',
        enabled: false,
        settings: {},
      },
    ],
    file_ids: [],
    metadata: undefined,
  }
}
