import { create } from 'zustand'
import { ThreadMessage } from '@janhq/core'
import { MCPTool } from '@/types/completion'
import { useAssistant } from './useAssistant'
import { ChatCompletionMessageToolCall } from 'openai/resources'

type AppState = {
  streamingContent?: ThreadMessage
  streamingContentByThread: Record<string, ThreadMessage | undefined>
  loadingModel?: boolean
  tools: MCPTool[]
  serverStatus: 'running' | 'stopped' | 'pending'
  abortControllers: Record<string, AbortController>
  tokenSpeed?: TokenSpeed
  // New: Track token speeds per message and per thread (for streaming)
  messageTokenSpeeds: Record<string, TokenSpeed>
  streamingTokenSpeeds: Record<string, TokenSpeed> // threadId -> TokenSpeed for active streaming
  currentToolCall?: ChatCompletionMessageToolCall
  setServerStatus: (value: 'running' | 'stopped' | 'pending') => void
  updateStreamingContent: (content: ThreadMessage | undefined) => void
  updateStreamingContentForThread: (threadId: string, content: ThreadMessage | undefined) => void
  getStreamingContentForThread: (threadId: string) => ThreadMessage | undefined
  updateCurrentToolCall: (
    toolCall: ChatCompletionMessageToolCall | undefined
  ) => void
  updateLoadingModel: (loading: boolean) => void
  updateTools: (tools: MCPTool[]) => void
  setAbortController: (threadId: string, controller: AbortController) => void
  updateTokenSpeed: (message: ThreadMessage) => void
  // New: Update token speed for specific message
  updateMessageTokenSpeed: (message: ThreadMessage) => void
  // New: Update streaming token speed for thread
  updateStreamingTokenSpeed: (threadId: string) => void
  // New: Get streaming token speed for thread
  getStreamingTokenSpeed: (threadId: string) => TokenSpeed | undefined
  // New: Transfer streaming token speed to final message
  transferStreamingTokenSpeedToMessage: (threadId: string, messageId: string) => void
  getMessageTokenSpeed: (messageId: string) => TokenSpeed | undefined
  // New: Transfer token speed from one message to another
  transferMessageTokenSpeed: (fromMessageId: string, toMessageId: string) => void
  resetTokenSpeed: () => void
  // New: Reset token speed for specific message
  resetMessageTokenSpeed: (messageId: string) => void
}

export const useAppState = create<AppState>()((set, get) => ({
  streamingContent: undefined,
  streamingContentByThread: {},
  loadingModel: false,
  tools: [],
  serverStatus: 'stopped',
  abortControllers: {},
  tokenSpeed: undefined,
  messageTokenSpeeds: {},
  streamingTokenSpeeds: {},
  currentToolCall: undefined,
  updateStreamingContent: (content: ThreadMessage | undefined) => {
    set(() => ({
      streamingContent: content
        ? {
            ...content,
            created_at: content.created_at || Date.now(),
            metadata: {
              ...content.metadata,
              assistant: useAssistant.getState().currentAssistant,
            },
          }
        : undefined,
    }))
  },
  updateStreamingContentForThread: (threadId: string, content: ThreadMessage | undefined) => {
    set((state) => ({
      streamingContentByThread: {
        ...state.streamingContentByThread,
        [threadId]: content
          ? {
              ...content,
              created_at: content.created_at || Date.now(),
              metadata: {
                ...content.metadata,
                assistant: useAssistant.getState().currentAssistant,
              },
            }
          : undefined,
      },
    }))
  },
  getStreamingContentForThread: (threadId: string) => {
    return get().streamingContentByThread[threadId]
  },
  updateCurrentToolCall: (toolCall) => {
    set(() => ({
      currentToolCall: toolCall,
    }))
  },
  updateLoadingModel: (loading) => {
    set({ loadingModel: loading })
  },
  updateTools: (tools) => {
    set({ tools })
  },
  setServerStatus: (value) => set({ serverStatus: value }),
  setAbortController: (threadId, controller) => {
    set((state) => ({
      abortControllers: {
        ...state.abortControllers,
        [threadId]: controller,
      },
    }))
  },
  updateTokenSpeed: (message) =>
    set((state) => {
      const currentTimestamp = new Date().getTime() // Get current time in milliseconds
      if (!state.tokenSpeed) {
        // If this is the first update, just set the lastTimestamp and return
        return {
          tokenSpeed: {
            lastTimestamp: currentTimestamp,
            tokenSpeed: 0,
            tokenCount: 1,
            message: message.id,
          },
        }
      }

      const timeDiffInSeconds =
        (currentTimestamp - state.tokenSpeed.lastTimestamp) / 1000 // Time difference in seconds
      const totalTokenCount = state.tokenSpeed.tokenCount + 1
      const averageTokenSpeed =
        totalTokenCount / (timeDiffInSeconds > 0 ? timeDiffInSeconds : 1) // Calculate average token speed
      return {
        tokenSpeed: {
          ...state.tokenSpeed,
          tokenSpeed: averageTokenSpeed,
          tokenCount: totalTokenCount,
          message: message.id,
        },
      }
    }),
  updateMessageTokenSpeed: (message) =>
    set((state) => {
      const currentTimestamp = new Date().getTime()
      const messageId = message.id
      const existingSpeed = state.messageTokenSpeeds[messageId]
      
      if (!existingSpeed) {
        // First update for this message
        const newSpeed = {
          lastTimestamp: currentTimestamp,
          tokenSpeed: 0,
          tokenCount: 1,
          message: messageId,
        }
        return {
          messageTokenSpeeds: {
            ...state.messageTokenSpeeds,
            [messageId]: newSpeed,
          },
        }
      }

      const timeDiffInSeconds = (currentTimestamp - existingSpeed.lastTimestamp) / 1000
      const totalTokenCount = existingSpeed.tokenCount + 1
      const averageTokenSpeed = totalTokenCount / (timeDiffInSeconds > 0 ? timeDiffInSeconds : 1)
      
      const updatedSpeed = {
        ...existingSpeed,
        tokenSpeed: averageTokenSpeed,
        tokenCount: totalTokenCount,
        lastTimestamp: currentTimestamp,
      }
      
      return {
        messageTokenSpeeds: {
          ...state.messageTokenSpeeds,
          [messageId]: updatedSpeed,
        },
      }
    }),
  updateStreamingTokenSpeed: (threadId) =>
    set((state) => {
      const currentTimestamp = new Date().getTime()
      const existingSpeed = state.streamingTokenSpeeds[threadId]
      
      if (!existingSpeed) {
        // First update for this thread - initialize with start time
        return {
          streamingTokenSpeeds: {
            ...state.streamingTokenSpeeds,
            [threadId]: {
              lastTimestamp: currentTimestamp, // This will be our start time
              tokenSpeed: 0,
              tokenCount: 1, // First token
              message: threadId,
            },
          },
        }
      }

      // Increment token count
      const newTokenCount = existingSpeed.tokenCount + 1
      
      // Calculate total time elapsed since we started streaming (using the original lastTimestamp as start time)
      const totalTimeElapsed = (currentTimestamp - existingSpeed.lastTimestamp) / 1000
      
      // Calculate tokens per second
      const tokensPerSecond = totalTimeElapsed > 0 ? newTokenCount / totalTimeElapsed : 0
      
      return {
        streamingTokenSpeeds: {
          ...state.streamingTokenSpeeds,
          [threadId]: {
            lastTimestamp: existingSpeed.lastTimestamp, // Keep original start time
            tokenSpeed: tokensPerSecond,
            tokenCount: newTokenCount,
            message: threadId,
          },
        },
      }
    }),
  getStreamingTokenSpeed: (threadId) => {
    return get().streamingTokenSpeeds[threadId]
  },
  transferStreamingTokenSpeedToMessage: (threadId, messageId) => {
    set((state) => {
      const streamingSpeed = state.streamingTokenSpeeds[threadId]
      if (!streamingSpeed) {
        return state
      }
      
      const newMessageTokenSpeeds = { ...state.messageTokenSpeeds }
      const newStreamingTokenSpeeds = { ...state.streamingTokenSpeeds }
      
      // Transfer to message
      newMessageTokenSpeeds[messageId] = {
        ...streamingSpeed,
        message: messageId,
      }
      
      // Clean up streaming entry
      delete newStreamingTokenSpeeds[threadId]
      
      return {
        messageTokenSpeeds: newMessageTokenSpeeds,
        streamingTokenSpeeds: newStreamingTokenSpeeds,
      }
    })
  },
  getMessageTokenSpeed: (messageId) => {
    return get().messageTokenSpeeds[messageId]
  },
  transferMessageTokenSpeed: (fromMessageId, toMessageId) => {
    set((state) => {
      const fromSpeed = state.messageTokenSpeeds[fromMessageId]
      if (!fromSpeed) {
        return state
      }
      
      const newMessageTokenSpeeds = { ...state.messageTokenSpeeds }
      newMessageTokenSpeeds[toMessageId] = {
        ...fromSpeed,
        message: toMessageId,
      }
      // Clean up the old entry
      delete newMessageTokenSpeeds[fromMessageId]
      
      return {
        messageTokenSpeeds: newMessageTokenSpeeds,
      }
    })
  },
  resetTokenSpeed: () =>
    set({
      tokenSpeed: undefined,
    }),
  resetMessageTokenSpeed: (messageId) =>
    set((state) => {
      const newMessageTokenSpeeds = { ...state.messageTokenSpeeds }
      delete newMessageTokenSpeeds[messageId]
      return {
        messageTokenSpeeds: newMessageTokenSpeeds,
      }
    }),
}))
