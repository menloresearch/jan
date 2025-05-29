import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// RAG Document interface
export interface RAGDocument {
  source_id: string
  path: string
  filename: string
  file_type: string
  status: 'processing' | 'indexed' | 'error'
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
  error_message?: string
  chunk_count?: number
  file_size?: number
}

interface RAGState {
  enabled: boolean
  // RAG documents state
  documents: RAGDocument[]
  documentsLoading: boolean

  // Selected RAG setting screen
  selectedSetting: string

  setEnabled: (enabled: boolean) => void
  // Actions
  setDocuments: (documents: RAGDocument[]) => void
  setDocumentsLoading: (loading: boolean) => void
  addDocument: (document: RAGDocument) => void
  removeDocument: (sourceId: string) => void
  updateDocument: (sourceId: string, updates: Partial<RAGDocument>) => void
  cleanAllDocuments: () => void
  setSelectedSetting: (setting: string) => void
}

// Default values
const defaultEnabled = false

export const useRAG = create<RAGState>()(
  persist(
    (set) => ({
      // Initial state
      enabled: defaultEnabled,
      documents: [],
      documentsLoading: false,
      selectedSetting: 'dashboard',

      setEnabled: (enabled: boolean) => {
        set({ enabled })
      },

      setDocuments: (documents: RAGDocument[]) => {
        set({ documents })
      },

      setDocumentsLoading: (loading: boolean) => {
        set({ documentsLoading: loading })
      },

      addDocument: (document: RAGDocument) => {
        set((state) => ({
          documents: [...state.documents, document]
        }))
      },

      removeDocument: (sourceId: string) => {
        set((state) => ({
          documents: state.documents.filter(doc => doc.source_id !== sourceId)
        }))
      },

      updateDocument: (sourceId: string, updates: Partial<RAGDocument>) => {
        set((state) => ({
          documents: state.documents.map(doc =>
            doc.source_id === sourceId ? { ...doc, ...updates } : doc
          )
        }))
      },

      cleanAllDocuments: () => {
        set({
          documents: [],
        })
      },

      setSelectedSetting: (setting: string) => {
        set({ selectedSetting: setting })
      }
    }),
    {
      name: 'jan-rag-settings',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain parts of the state
      partialize: (state) => ({
        selectedSetting: state.selectedSetting
      })
    }
  )
)

export const useRAGDocuments = () => {
  const {
    documents,
    documentsLoading,
    setDocuments,
    setDocumentsLoading,
    addDocument,
    removeDocument,
    updateDocument,
    cleanAllDocuments
  } = useRAG()

  return {
    documents,
    documentsLoading,
    setDocuments,
    setDocumentsLoading,
    addDocument,
    removeDocument,
    updateDocument,
    cleanAllDocuments
  }
}


export const useRAGNavigation = () => {
  const { selectedSetting, setSelectedSetting } = useRAG()
  return { selectedSetting, setSelectedSetting }
}