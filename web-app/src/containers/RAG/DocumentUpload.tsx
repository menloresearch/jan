import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { IconUpload, IconCheck } from '@tabler/icons-react'
import {
  CloudUploadIcon,
  FileIcon,
  CheckCircleIcon,
  XCircleIcon,
  FileTextIcon,
  DatabaseIcon,
  CodeIcon,
  SparklesIcon,
} from 'lucide-react'
import { useRAGDocuments } from '../../hooks/useRAG'
import { addFileToRAG, listRAGSources } from '../../services/rag'
import { transformMCPSources } from './utils'
import { toast } from 'sonner'

interface DocumentUploadProps {
  onUploadComplete?: () => void
}

const DocumentUpload = ({ onUploadComplete }: DocumentUploadProps) => {
  const { setDocuments: setRagDocuments, setDocumentsLoading: setLoading } =
    useRAGDocuments()
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle')
  const [currentFileName, setCurrentFileName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadDocuments = async () => {
    setLoading(true)
    try {
      const { sources } = await listRAGSources()
      const documents = transformMCPSources(sources)
      setRagDocuments(documents)
    } catch (error) {
      console.error('Failed to load RAG documents:', error)
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFiles = async (files: FileList) => {
    if (!files || files.length === 0) return

    const file = files[0]
    setUploading(true)
    setUploadStatus('uploading')
    setCurrentFileName(file.name)
    setUploadProgress(0)

    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 50 // First 50% for file reading
          setUploadProgress(progress)
        }
      }

      reader.onload = async () => {
        try {
          setUploadProgress(50) // File reading complete
          const base64Content = reader.result as string
          const base64Data = base64Content.split(',')[1] // Remove data:mime;base64, prefix

          setUploadProgress(60) // Starting file save
          // Save file using Tauri
          const tempFilePath = await window.core?.api?.saveFile({
            base64Content: base64Data,
            fileName: file.name,
          })

          setUploadProgress(80) // File saved, starting RAG processing
          // Add to RAG system
          await addFileToRAG(tempFilePath, {
            original_filename: file.name,
            file_size: file.size,
            upload_date: new Date().toISOString(),
          })

          setUploadProgress(100) // Complete
          setUploadStatus('success')
          toast.success(`File "${file.name}" uploaded and indexed successfully`)
          await loadDocuments()

          // Auto-close dialog after success
          setTimeout(() => {
            onUploadComplete?.()
          }, 1500)
        } catch (error) {
          console.error('Failed to process file:', error)
          setUploadStatus('error')
          toast.error(`Failed to process file: ${error}`)
        } finally {
          setTimeout(() => {
            setUploading(false)
            setUploadProgress(0)
            setUploadStatus('idle')
            setCurrentFileName('')
          }, 2000)
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Failed to read file:', error)
      setUploadStatus('error')
      toast.error('Failed to read file')
      setUploading(false)
    }
  }

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files
    if (files) {
      await handleFiles(files)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary shadow-sm">
            <CloudUploadIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-main-view-fg">
              Upload Documents
            </h2>
            <p className="text-sm text-main-view-fg/70">
              Add documents to your RAG knowledge base
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
          dragActive
            ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 scale-[1.02] shadow-xl ring-4 ring-primary/20'
            : 'border-main-view-fg/20 hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/5 hover:to-transparent'
        } ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload documents by clicking or dragging files here"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.txt,.md,.docx,.html,.csv,.json"
          onChange={handleFileUpload}
          disabled={uploading}
        />

        <div className="space-y-6">
          {/* Enhanced Upload Icon with Status */}
          <div className="mx-auto w-24 h-24 rounded-full flex items-center justify-center relative">
            {uploadStatus === 'idle' && (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center border-2 border-primary/20">
                <CloudUploadIcon size={40} className="text-primary" />
              </div>
            )}
            {uploadStatus === 'uploading' && (
              <div className="w-full h-full bg-gradient-to-br from-accent/20 to-accent/10 rounded-full flex items-center justify-center border-2 border-accent/20 animate-pulse">
                <FileIcon size={40} className="text-accent" />
              </div>
            )}
            {uploadStatus === 'success' && (
              <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-full flex items-center justify-center border-2 border-emerald-200">
                <CheckCircleIcon size={40} className="text-emerald-600" />
              </div>
            )}
            {uploadStatus === 'error' && (
              <div className="w-full h-full bg-gradient-to-br from-red-100 to-red-50 rounded-full flex items-center justify-center border-2 border-red-200">
                <XCircleIcon size={40} className="text-red-600" />
              </div>
            )}
          </div>

          {/* Enhanced Status Text */}
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-main-view-fg">
              {uploadStatus === 'idle' && 'Drop files here or click to upload'}
              {uploadStatus === 'uploading' &&
                `Processing ${currentFileName}...`}
              {uploadStatus === 'success' && 'Upload completed successfully!'}
              {uploadStatus === 'error' && 'Upload failed'}
            </h3>

            {uploadStatus === 'idle' && (
              <div className="space-y-4">
                <p className="text-sm text-main-view-fg/70">
                  Drag and drop your documents or click to browse
                </p>

                {/* File Format Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-md mx-auto">
                  <div className="flex flex-col items-center p-3 bg-main-view-fg/5 rounded-lg border border-main-view-fg/10">
                    <FileTextIcon className="w-6 h-6 text-red-500 mb-1" />
                    <span className="text-xs font-medium text-main-view-fg/70">
                      PDF
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-main-view-fg/5 rounded-lg border border-main-view-fg/10">
                    <FileTextIcon className="w-6 h-6 text-blue-500 mb-1" />
                    <span className="text-xs font-medium text-main-view-fg/70">
                      DOCX
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-main-view-fg/5 rounded-lg border border-main-view-fg/10">
                    <CodeIcon className="w-6 h-6 text-green-500 mb-1" />
                    <span className="text-xs font-medium text-main-view-fg/70">
                      MD/TXT
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 bg-main-view-fg/5 rounded-lg border border-main-view-fg/10">
                    <DatabaseIcon className="w-6 h-6 text-orange-500 mb-1" />
                    <span className="text-xs font-medium text-main-view-fg/70">
                      CSV/JSON
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <Badge
                    variant="secondary"
                    className="text-xs bg-main-view-fg/10"
                  >
                    Max 50MB
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-xs bg-main-view-fg/10"
                  >
                    Multiple files supported
                  </Badge>
                </div>
              </div>
            )}

            {uploadStatus === 'uploading' && (
              <div className="space-y-4">
                <div className="w-full max-w-sm mx-auto">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-main-view-fg/70">Progress</span>
                    <span className="font-medium text-main-view-fg">
                      {uploadProgress}%
                    </span>
                  </div>
                  <Progress
                    value={uploadProgress}
                    className="h-3 bg-main-view-fg/10"
                  />
                </div>
                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                  <p className="text-sm text-accent font-medium">
                    {uploadProgress < 50 && '📖 Reading file content...'}
                    {uploadProgress >= 50 &&
                      uploadProgress < 80 &&
                      '💾 Saving to local storage...'}
                    {uploadProgress >= 80 &&
                      '🧠 Processing for RAG indexing...'}
                  </p>
                </div>
              </div>
            )}

            {uploadStatus === 'success' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center justify-center gap-2 text-emerald-700">
                  <SparklesIcon className="w-5 h-5" />
                  <span className="font-medium">
                    Document successfully indexed!
                  </span>
                </div>
                <p className="text-sm text-emerald-600 mt-1">
                  Your document is now available for AI-enhanced conversations
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          {uploadStatus === 'idle' && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-fg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <IconUpload className="w-5 h-5 mr-2" />
              Choose Files
            </Button>
          )}
        </div>
      </div>

      {/* Enhanced Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-6">
          <h4 className="font-semibold text-primary mb-4 flex items-center">
            <SparklesIcon className="w-5 h-5 mr-2" />
            How RAG Works
          </h4>
          <ul className="text-sm text-primary/80 space-y-3">
            <li className="flex items-start">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-primary">1</span>
              </div>
              <span>
                Documents are processed and split into semantic chunks
              </span>
            </li>
            <li className="flex items-start">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-primary">2</span>
              </div>
              <span>
                Each chunk is converted to embeddings for semantic search
              </span>
            </li>
            <li className="flex items-start">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-primary">3</span>
              </div>
              <span>
                AI uses relevant chunks as context for accurate responses
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-xl p-6">
          <h4 className="font-semibold text-accent mb-4 flex items-center">
            <IconCheck className="w-5 h-5 mr-2" />
            Privacy & Performance
          </h4>
          <ul className="text-sm text-accent/80 space-y-3">
            <li className="flex items-start">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-accent">🔒</span>
              </div>
              <span>
                All processing happens locally - your data never leaves your
                device
              </span>
            </li>
            <li className="flex items-start">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-accent">⚡</span>
              </div>
              <span>Large documents may take a few minutes to process</span>
            </li>
            <li className="flex items-start">
              <div className="w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                <span className="text-xs font-bold text-accent">✨</span>
              </div>
              <span>Higher quality documents lead to better AI responses</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default DocumentUpload
