import { useCallback, useEffect, useMemo } from 'react'
import { usePrompt } from './usePrompt'
import { useModelProvider } from './useModelProvider'
import { useThreads } from './useThreads'
import { useAppState } from './useAppState'
import { useMessages } from './useMessages'
import { useRouter } from '@tanstack/react-router'
import { defaultModel } from '@/lib/models'
import { route } from '@/constants/routes'
import {
  emptyThreadContent,
  extractToolCall,
  isCompletionResponse,
  newAssistantThreadContent,
  newUserThreadContent,
  postMessageProcessing,
  sendCompletion,
} from '@/lib/completion'
import { CompletionMessagesBuilder } from '@/lib/messages'
import { ChatCompletionMessageToolCall } from 'openai/resources'
import { useAssistant } from './useAssistant'
import { toast } from 'sonner'
import { getTools } from '@/services/mcp'
import { MCPTool } from '@/types/completion'
import { listen } from '@tauri-apps/api/event'
import { SystemEvent } from '@/types/events'
import { stopModel, startModel } from '@/services/models'
import { useRAG } from './useRAG'

export const useChat = () => {
  const { prompt, setPrompt } = usePrompt()
  const {
    tools,
    updateTokenSpeed,
    resetTokenSpeed,
    updateTools,
    updateStreamingContent,
    updateLoadingModel,
    setAbortController,
  } = useAppState()
  const { currentAssistant } = useAssistant()

  const { getProviderByName, selectedModel, selectedProvider } =
    useModelProvider()

  const { getCurrentThread: retrieveThread, createThread } = useThreads()
  const { getMessages, addMessage } = useMessages()
  const router = useRouter()
  const { enabled: ragEnabled } = useRAG()

  const provider = useMemo(() => {
    return getProviderByName(selectedProvider)
  }, [selectedProvider, getProviderByName])

  useEffect(() => {
    function setTools() {
      getTools().then((data: MCPTool[]) => {
        updateTools(data)
      })
    }
    setTools()

    let unsubscribe = () => { }
    listen(SystemEvent.MCP_UPDATE, setTools).then((unsub) => {
      // Unsubscribe from the event when the component unmounts
      unsubscribe = unsub
    })
    return unsubscribe
  }, [updateTools])

  const getCurrentThread = useCallback(async () => {
    let currentThread = retrieveThread()
    if (!currentThread) {
      currentThread = await createThread(
        {
          id: selectedModel?.id ?? defaultModel(selectedProvider),
          provider: selectedProvider,
        },
        prompt,
        currentAssistant
      )
      router.navigate({
        to: route.threadsDetail,
        params: { threadId: currentThread.id },
      })
    }
    return currentThread
  }, [
    createThread,
    prompt,
    retrieveThread,
    router,
    selectedModel?.id,
    selectedProvider,
    currentAssistant,
  ])

  const sendMessage = useCallback(
    async (message: string, uploadedFiles?: Array<{
      name: string
      type: string
      size: number
      base64: string
      dataUrl: string
    }>) => {
      const activeThread = await getCurrentThread()

      resetTokenSpeed()
      if (!activeThread || !provider) return
      const messages = getMessages(activeThread.id)
      const abortController = new AbortController()
      setAbortController(activeThread.id, abortController)
      updateStreamingContent(emptyThreadContent)

      // Initialize hidden context data and final message
      let hiddenContextData: string | undefined = undefined
      const finalMessage = message

      // Process uploaded files if they exist
      if (uploadedFiles && uploadedFiles.length > 0) {
        const file = uploadedFiles[0] // Process first file for now

        try {
          const extractedText = await window.core?.api?.extractTextFromFile({
            base64Content: file.base64,
            fileName: file.name,
            fileType: file.type
          })
          hiddenContextData = `[Extracted Content from ${file.name}]:\n${extractedText}\n\n`
          toast.success(`Text extracted from "${file.name}"`)
        } catch (error) {
          console.error('Text extraction failed:', error)
          toast.error(`Failed to extract text from "${file.name}": ${error}`)
          hiddenContextData = `[Failed to extract content from ${file.name}]\n`
        }
      }

      // Create user message with metadata
      const userMessage = newUserThreadContent(activeThread.id, message)
      if (uploadedFiles && uploadedFiles.length > 0 && hiddenContextData) { userMessage.metadata = {
          ...userMessage.metadata,
          hidden_llm_context: hiddenContextData,
        }
      }

      addMessage(userMessage)
      setPrompt('')

      try {

        if (selectedModel?.id) {
          updateLoadingModel(true)
          await startModel(provider, selectedModel.id, abortController).catch(
            console.error
          )
          updateLoadingModel(false)
        }

        if (ragEnabled) {
          // TODO: refactor this to use a separate hook or service
          const ragSystemPrompt = `
# Document Knowledge Base Integration

## Available Tools

### rag_query_documents
**Purpose**: Search for relevant information from indexed documents
**Parameters**:
- query_text (required): Search terms or natural language query
- top_k (optional, default: 3): Number of results to retrieve (adjust based on query complexity)

**Best Practices**:
- Use specific, relevant keywords for targeted searches
- For broad topics, start with general terms then refine with follow-up queries
- Consider synonyms and related terms if initial queries yield limited results
- Increase top_k (5-10) for complex questions requiring multiple perspectives

### rag_list_data_sources
**Purpose**: View available documents in the knowledge base
**When to use**: 
- When users ask about available resources
- To understand the scope of information available
- Before conducting searches to better target queries

## Workflow Guidelines

### 1. Query Assessment
- **Always search first** when users ask questions that could benefit from document context
- **Exception**: Only skip searching for purely computational, creative, or general knowledge tasks

### 2. Search Strategy
- **Single focused topic**: Use 1-2 targeted queries
- **Complex/multi-faceted questions**: Use multiple complementary searches
- **Unclear questions**: Start broad, then narrow based on initial results

### 3. Response Construction
- **Lead with retrieved information** when available and relevant
- **Integrate context naturally** rather than simply appending it
- **Synthesize multiple sources** when using several document chunks
- **Acknowledge limitations** if relevant information isn't found

## Citation Requirements

### Format
- Use clear source attribution: "According to [Document Name]... or "As stated in [Document Title]..."
- Include page numbers or section references when available
- For multiple sources: "Based on information from [Source A] and [Source B]..."

### When to Cite
- **Always cite** when directly referencing document content
- **Distinguish** between document-sourced information and your general knowledge
- **Be transparent** about the source of specific claims or data points

## Response Framework

'''
1. Search the knowledge base using rag_query_documents
2. Evaluate retrieved information for relevance and quality
3. If insufficient, conduct additional targeted searches
4. Construct response integrating:
   - Retrieved document context (cited)
   - Your analysis and synthesis
   - Clear distinction between sources
5. Acknowledge any limitations in available information
'''

## Error Handling

- **No relevant results**: Acknowledge the limitation and provide general knowledge if appropriate
- **Tool failures**: Inform the user and offer to help based on general knowledge
- **Conflicting information**: Present multiple perspectives and note discrepancies

## Quality Indicators

✅ **Good Practice**:
- Search before responding to relevant queries
- Cite sources clearly and accurately
- Synthesize information from multiple documents
- Acknowledge when information comes from documents vs. general knowledge

❌ **Avoid**:
- Responding without searching when documents might be relevant
- Vague or missing citations
- Presenting document information as your own knowledge
- Over-relying on single sources for complex topics
`.trim()

          if (currentAssistant?.instructions !== undefined) {
            currentAssistant.instructions = `${currentAssistant.instructions}\n\n${ragSystemPrompt}`
          }
        }

        const builder = new CompletionMessagesBuilder(

          // Add assistant instructions if available
          messages,
          currentAssistant?.instructions
        )

        // Prepare final message with hidden context if available
        let messageWithContext = finalMessage
        if (hiddenContextData) {
          messageWithContext = `${hiddenContextData}${finalMessage}`
        }

        builder.addUserMessage(messageWithContext)

        let isCompleted = false

        let availableTools = selectedModel?.capabilities?.includes('tools')
          ? tools
          : []
        // TODO: Later replaced by Agent setup?
        const followUpWithToolUse = true
        while (!isCompleted && !abortController.signal.aborted) {
          const completion = await sendCompletion(
            activeThread,
            provider,
            builder.getMessages(),
            abortController,
            availableTools,
            currentAssistant.parameters?.stream === false ? false : true,
            currentAssistant.parameters as unknown as Record<string, object>
            // TODO: replace it with according provider setting later on
            // selectedProvider === 'llama.cpp' && availableTools.length > 0
            //   ? false
            //   : true
          )

          if (!completion) throw new Error('No completion received')
          let accumulatedText = ''
          const currentCall: ChatCompletionMessageToolCall | null = null
          const toolCalls: ChatCompletionMessageToolCall[] = []
          if (isCompletionResponse(completion)) {
            accumulatedText = completion.choices[0]?.message?.content || ''
            if (completion.choices[0]?.message?.tool_calls) {
              toolCalls.push(...completion.choices[0].message.tool_calls)
            }
          } else {
            for await (const part of completion) {
              const delta = part.choices[0]?.delta?.content || ''
              if (part.choices[0]?.delta?.tool_calls) {
                extractToolCall(part, currentCall, toolCalls)
              }
              if (delta) {
                accumulatedText += delta
                // Create a new object each time to avoid reference issues
                // Use a timeout to prevent React from batching updates too quickly
                const currentContent = newAssistantThreadContent(
                  activeThread.id,
                  accumulatedText
                )
                updateStreamingContent(currentContent)
                updateTokenSpeed(currentContent)
                await new Promise((resolve) => setTimeout(resolve, 0))
              }
            }
          }
          // TODO: Remove this check when integrating new llama.cpp extension
          if (
            accumulatedText.length === 0 &&
            toolCalls.length === 0 &&
            activeThread.model?.id &&
            provider.provider === 'llama.cpp'
          ) {
            await stopModel(activeThread.model.id, 'cortex')
            throw new Error('No response received from the model')
          }

          // Create a final content object for adding to the thread
          const finalContent = newAssistantThreadContent(
            activeThread.id,
            accumulatedText
          )
          builder.addAssistantMessage(accumulatedText, undefined, toolCalls)
          const updatedMessage = await postMessageProcessing(
            toolCalls,
            builder,
            finalContent,
            abortController
          )
          addMessage(updatedMessage ?? finalContent)

          isCompleted = !toolCalls.length
          // Do not create agent loop if there is no need for it
          if (!followUpWithToolUse) availableTools = []
        }
      } catch (error) {
        toast.error(
          `Error sending message: ${error && typeof error === 'object' && 'message' in error ? error.message : error}`
        )
        console.error('Error sending message:', error)
      } finally {
        updateLoadingModel(false)
        updateStreamingContent(undefined)
      }
    },
    [
      getCurrentThread,
      resetTokenSpeed,
      provider,
      getMessages,
      setAbortController,
      updateStreamingContent,
      addMessage,
      setPrompt,
      selectedModel?.id,
      selectedModel?.capabilities,
      ragEnabled,
      currentAssistant,
      tools,
      updateLoadingModel,
      updateTokenSpeed
    ]
  )

  return { sendMessage }
}
