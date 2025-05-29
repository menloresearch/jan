import { cn } from '@/lib/utils'
import {
  IconFileText,
  IconUpload,
  IconSettings,
} from '@tabler/icons-react'

interface RAGDocumentMenuProps {
  activeSection: string
  setActiveSection: (section: string) => void
}

const ragMenuItems = [
  {
    title: 'Documents',
    icon: IconFileText,
    id: 'documents',
  },
  {
    title: 'Upload',
    icon: IconUpload,
    id: 'upload',
  },
  {
    title: 'Settings',
    icon: IconSettings,
    id: 'settings',
  },
]

const RAGDocumentMenu = ({ activeSection, setActiveSection }: RAGDocumentMenuProps) => {
  return (
    <div className="w-48 shrink-0 border-r border-[hsla(var(--app-border))] bg-[hsla(var(--left-panel-bg))] text-[hsla(var(--left-panel-fg))]">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-[hsla(var(--left-panel-fg))] mb-4">
          RAG Documents
        </h2>
        <nav className="space-y-1">
          {ragMenuItems.map((item) => {
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors w-full text-left',
                  isActive
                    ? 'bg-[hsla(var(--left-panel-fg))] bg-opacity-10 text-[hsla(var(--left-panel-fg))]'
                    : 'text-[hsla(var(--left-panel-fg))] opacity-70 hover:opacity-100 hover:bg-[hsla(var(--left-panel-fg))] hover:bg-opacity-5'
                )}
              >
                <item.icon size={16} />
                {item.title}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

export default RAGDocumentMenu