import { callTool } from './mcp'

/**
 * @description RAG service for managing document indexing and querying
 * This service provides functions to interact with the RAG MCP server
 */

export interface RAGDocument {
  source_id: string
  path: string
  filename: string
  file_type: string
  status: string
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
  chunk_count?: number
  file_size?: number
}

export interface RAGQueryResult {
  query: string
  total_results: number
  retrieved_contexts: Array<{
    document_id: string
    text_chunk: string
    similarity_score: number
    distance: number
    metadata: {
      original_document_path: string
      document_type: string
      chunk_order: number
      source_id: string
    }
  }>
  source_info: Record<string, {
    name: string
    type: string
    status: string
    added_at: string
  }>
  query_timestamp: string
}


/**
 * Add a file to the RAG system for indexing
 * @param filePath - Absolute path to the file
 * @param metadata - Optional metadata to associate with the file
 * @returns Promise with the result of adding the file
 */
export const addFileToRAG = async (
  filePath: string,
  metadata: Record<string, unknown> = {}
): Promise<{ status: string; source_id: string; message: string; chunk_count: number }> => {
  try {
    const result = await callTool({
      toolName: 'rag_add_data_source',
      arguments: {
        source_type: 'file',
        path_or_url: filePath,
        metadata
      }
    })

    if (result.error) {
      throw new Error(result.error)
    }

    const response = JSON.parse(result.content[0].text)
    return response
  } catch (error) {
    console.error('Failed to add file to RAG:', error)
    throw error
  }
}

/**
 * Query the RAG system for relevant document chunks
 * @param queryText - The text to search for
 * @param topK - Number of top results to return (default: 3)
 * @param filters - Optional filters to apply
 * @returns Promise with query results
 */
export const queryRAG = async (
  queryText: string,
  topK: number = 3,
  filters: Record<string, unknown> = {}
): Promise<RAGQueryResult> => {
  try {
    const result = await callTool({
      toolName: 'rag_query_documents',
      arguments: {
        query_text: queryText,
        top_k: topK,
        filters
      }
    })

    if (result.error) {
      throw new Error(result.error)
    }

    const response = JSON.parse(result.content[0].text)
    return response
  } catch (error) {
    console.error('Failed to query RAG:', error)
    throw error
  }
}

/**
 * List all data sources in the RAG system
 * @returns Promise with list of all RAG sources
 */
export const listRAGSources = async (): Promise<{ sources: RAGDocument[] }> => {
  try {
    const result = await callTool({
      toolName: 'rag_list_data_sources',
      arguments: {}
    })

    if (result.error) {
      throw new Error(result.error)
    }

    const response = JSON.parse(result.content[0].text)
    return response
  } catch (error) {
    console.error('Failed to list RAG sources:', error)
    throw error
  }
}

/**
 * Remove a data source from the RAG system
 * @param sourceId - The ID of the source to remove
 * @returns Promise with removal result
 */
export const removeRAGSource = async (
  sourceId: string
): Promise<{ status: string; message: string }> => {
  try {
    const result = await callTool({
      toolName: 'rag_remove_data_source',
      arguments: {
        source_id: sourceId
      }
    })

    if (result.error) {
      throw new Error(result.error)
    }

    const response = JSON.parse(result.content[0].text)
    return response
  } catch (error) {
    console.error('Failed to remove RAG source:', error)
    throw error
  }
}

/**
 * Clean all data sources from the RAG system by re-initializing the database
 * @returns Promise with cleanup result
 */
export const cleanAllRAGSources = async (): Promise<{
  status: string
  message: string
  sources_removed: number
  chunks_removed: number
  timestamp: string
}> => {
  try {
    const result = await callTool({
      toolName: 'rag_clean_all_data_sources',
      arguments: {}
    })

    if (result.error) {
      throw new Error(result.error)
    }

    const response = JSON.parse(result.content[0].text)
    return response
  } catch (error) {
    console.error('Failed to clean all RAG sources:', error)
    throw error
  }
}
