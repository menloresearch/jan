/**
 * Shared utilities for RAG components
 */

export const getFileIcon = (fileType: string): string => {
  switch (fileType) {
    case 'pdf':
      return '📄'
    case 'txt':
    case 'md':
      return '📝'
    case 'docx':
      return '📘'
    case 'html':
      return '🌐'
    case 'csv':
      return '📊'
    case 'json':
      return '📋'
    case 'image':
      return '🖼️'
    default:
      return '📄'
  }
}

export const formatFileSize = (bytes?: number): string => {
  if (!bytes) return 'Unknown size'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString()
}

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Transform MCP response to RAGDocument format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const transformMCPSources = (sources: any[]) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return sources.map((source: any) => ({
    source_id: source.source_id,
    path: source.path || source.path_or_url,
    filename: source.filename || source.path?.split('/').pop() || 'Unknown',
    file_type: source.file_type || 'unknown',
    status: source.status || 'indexed',
    created_at: source.created_at || new Date().toISOString(),
    updated_at: source.updated_at || new Date().toISOString(),
    metadata: source.metadata || {},
    chunk_count: source.chunk_count,
    file_size: source.file_size,
  }))
}