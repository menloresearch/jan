import { IconBrandSpeedtest } from '@tabler/icons-react'
import { useAppState } from '@/hooks/useAppState'
import { cn } from '@/lib/utils'

interface MessageTokenSpeedProps {
  messageId: string
  isStreaming?: boolean
  className?: string
  // Add metadata prop to get persisted token speed
  metadata?: Record<string, unknown>
}

export const MessageTokenSpeed = ({ 
  messageId, 
  isStreaming = false, 
  className,
  metadata
}: MessageTokenSpeedProps) => {
  const { getMessageTokenSpeed } = useAppState()
  const runtimeTokenSpeed = getMessageTokenSpeed(messageId)
  
  // Check for persisted token speed in metadata first, then runtime data
  const persistedTokenSpeed = metadata?.tokenSpeed as number | undefined
  const tokenSpeed = runtimeTokenSpeed || (persistedTokenSpeed ? {
    tokenSpeed: persistedTokenSpeed,
    tokenCount: 0,
    lastTimestamp: 0,
    message: messageId
  } : null)

  // Only show if we have token speed data and it's meaningful
  if (!tokenSpeed || tokenSpeed.tokenSpeed === 0) {
    return null
  }

  return (
    <div className={cn(
      "flex items-center gap-1 text-main-view-fg/60 text-xs",
      isStreaming && "animate-pulse",
      className
    )}>
      <IconBrandSpeedtest size={14} />
      <span>
        {Math.round(tokenSpeed.tokenSpeed)} tokens/sec
      </span>
    </div>
  )
}

export default MessageTokenSpeed