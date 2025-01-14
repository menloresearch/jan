import { Client } from '../mcpsdk/client/index.js'
import { SSEClientTransport } from '../mcpsdk/client/sse.js'
import { OpenAI } from 'openai'

import {
  AssistantTool,
  ChatCompletionRole,
  ContentType,
  events,
  InferenceTool,
  MessageEvent,
  MessageRequest,
  MessageStatus,
  ThreadMessage,
} from '@janhq/core'
import { ChatCompletionMessageParam } from 'openai/resources/index.js'
import {
  applyToolCallsIfPresent,
  mapToolListToOpenAiTools,
  ToolsListServerResponseType,
} from '../utils.js'

// Define new extension tool class
export class FunctionTool extends InferenceTool {
  name: string = 'function'
  async process(
    data: MessageRequest,
    tool?: AssistantTool
  ): Promise<MessageRequest> {
    const transport = new SSEClientTransport(
      new URL('http://127.0.0.1:8000/sse'),
      {}
    )

    const client = new Client(
      {
        name: 'jan-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    )
    await client.connect(transport)

    // List available tools
    const tools = (await client.listTools()) as ToolsListServerResponseType

    const openai = new OpenAI({
      apiKey: 'mcp',
      baseURL: 'http://127.0.0.1:39291/v1',
      dangerouslyAllowBrowser: true,
    })

    const messages = data.messages as ChatCompletionMessageParam[]

    const maxIterations = 10

    for (let i = 0; i < maxIterations; i++) {
      const response = await openai.chat.completions.create({
        model: data.model?.id,
        temperature: 0.2,
        messages,
        tools: mapToolListToOpenAiTools(tools),
      })

      messages.push(response.choices[0].message)
      this.broadcastMessage(data, response.choices[0].message)

      if (response.choices[0].finish_reason === 'stop') break

      // Handle tool calls
      const toolMessages = await applyToolCallsIfPresent(client, response)

      messages.push(...toolMessages)
      toolMessages.forEach((message) => {
        if (message.choices?.[0]?.message)
          this.broadcastMessage(data, message.choices?.[0]?.message)
      })
    }

    return Promise.resolve({
      ...data,
      messages: messages as any,
    })
  }

  private broadcastMessage(
    data: MessageRequest,
    message: OpenAI.Chat.Completions.ChatCompletionMessage
  ) {
    const timestamp = Date.now()
    const appMessage: ThreadMessage = {
      id: Date.now().toString(),
      thread_id: data.threadId,
      assistant_id: data.assistantId,
      role: message.role as ChatCompletionRole,
      content: [
        {
          type: ContentType.Text,
          text: {
            value: message.content as string,
            annotations: [],
          },
        },
      ],
      status: MessageStatus.Ready,
      created_at: timestamp,
      completed_at: timestamp,
      object: 'thread.message',
    }
    events.emit(MessageEvent.OnMessageResponse, appMessage)
  }
}
