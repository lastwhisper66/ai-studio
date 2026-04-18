import { useState, useEffect, useCallback, useRef } from 'react'
import {
  X,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  ChevronDown,
  ImagePlus,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'
import { useSeedTranslator } from '@renderer/hooks/useSeedTranslator'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { AssistantSettingsDialog } from './AssistantSettingsDialog'
import { ModelPickerDialog } from './ModelPickerDialog'
import type { FileData } from '@shared/types'
import { isImageMime } from '@shared/types'

interface ChatViewProps {
  topicCollapsed: boolean
  onToggleTopic: () => void
}

export function ChatView({ topicCollapsed, onToggleTopic }: ChatViewProps): React.JSX.Element {
  const { t } = useTranslation()
  const resolveError = useLocalizedError()
  const st = useSeedTranslator()
  const {
    activeConversationId,
    conversations,
    messages,
    hasMoreMessages,
    error,
    isLoading,
    isStreaming,
    streamingContent,
    streamingReasoningContent,
    streamStartTime,
    sendMessage,
    stopGeneration,
    loadMoreMessages,
    clearError,
  } = useConversationStore()

  const assistants = useAssistantStore((s) => s.assistants)
  const activeAssistantId = useAssistantStore((s) => s.activeAssistantId)
  const updateAssistant = useAssistantStore((s) => s.updateAssistant)

  const providers = useProviderStore((s) => s.providers)

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const activeAssistant = activeAssistantId
    ? assistants.find((a) => a.id === activeAssistantId)
    : activeConversation?.assistantId
      ? assistants.find((a) => a.id === activeConversation.assistantId)
      : undefined

  // Provider / model display — assistant-level only (no conversation override)
  const resolvedProviderId = activeAssistant?.providerId ?? null
  const resolvedModelName = activeAssistant?.model ?? ''
  const resolvedProvider = providers.find((p) => p.id === resolvedProviderId)
  const resolvedModel = resolvedModelName || t('common.noModelSet')
  const template = resolvedProvider ? getTemplateByType(resolvedProvider.type) : undefined

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsInitialTab, setSettingsInitialTab] = useState<'assistant' | 'model' | 'prompt'>(
    'assistant',
  )
  const [modelPickerOpen, setModelPickerOpen] = useState(false)

  // Drag-and-drop state
  const [isDragging, setIsDragging] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<FileData[] | undefined>(undefined)
  const dragCounter = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounter.current = 0

    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB — matches file-handlers.ts

    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter((f) => isImageMime(f.type) && f.size <= MAX_FILE_SIZE)
    if (imageFiles.length === 0) return

    // Read each image file as base64, preserving drop order via index
    let completed = 0
    const results: (FileData | null)[] = new Array(imageFiles.length).fill(null)
    const checkDone = (): void => {
      completed++
      if (completed === imageFiles.length) {
        const valid = results.filter((r): r is FileData => r !== null)
        if (valid.length > 0) setDroppedFiles(valid)
      }
    }
    imageFiles.forEach((file, idx) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        results[idx] = { name: file.name, mimeType: file.type, base64, size: file.size }
        checkDone()
      }
      reader.onerror = () => checkDone()
      reader.readAsDataURL(file)
    })
  }, [])

  const handleDroppedFilesConsumed = useCallback(() => {
    setDroppedFiles(undefined)
  }, [])

  // Reset drag state when drag is cancelled (Escape, window switch, etc.)
  useEffect(() => {
    const reset = (): void => {
      dragCounter.current = 0
      setIsDragging(false)
    }
    window.addEventListener('dragend', reset)
    return () => window.removeEventListener('dragend', reset)
  }, [])

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(clearError, 5000)
    return () => clearTimeout(timer)
  }, [error, clearError])

  // Cleanup stream listeners on unmount
  useEffect(() => {
    return () => window.api.removeAllStreamListeners()
  }, [])

  const handleEditSystemPrompt = (): void => {
    setSettingsInitialTab('prompt')
    setSettingsOpen(true)
  }

  const handleOpenSettings = (): void => {
    setSettingsInitialTab('assistant')
    setSettingsOpen(true)
  }

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background text-foreground"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          {/* Assistant info — clickable */}
          <button
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => handleOpenSettings()}>
            <span>{activeAssistant ? st(activeAssistant.name) : t('chat.newChat')}</span>
          </button>

          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />

          {/* Provider + Model selector */}
          <button
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            disabled={!activeAssistant}
            onClick={() => setModelPickerOpen(true)}>
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: template?.color ?? '#6b7280' }}
            />
            <span>
              {resolvedModel}
              {resolvedProvider && (
                <span className="text-muted-foreground/60"> | {resolvedProvider.name}</span>
              )}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
          <ModelPickerDialog
            open={modelPickerOpen}
            onOpenChange={setModelPickerOpen}
            selectedProviderId={resolvedProviderId}
            selectedModelId={resolvedModelName}
            onSelect={(providerId, modelId) => {
              if (activeAssistant) {
                updateAssistant(activeAssistant.id, { providerId, model: modelId })
              }
            }}
          />
        </div>

        {/* Right: topic panel toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleTopic}>
              {topicCollapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <PanelRightClose className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {topicCollapsed ? t('chat.expandTopicPanel') : t('chat.collapseTopicPanel')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Messages area */}
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        streamingReasoningContent={streamingReasoningContent}
        isStreaming={isStreaming}
        isLoading={isLoading}
        hasActiveConversation={!!activeConversationId}
        hasMoreMessages={hasMoreMessages}
        streamStartTime={streamStartTime}
        onSend={sendMessage}
        onLoadMore={loadMoreMessages}
        activeAssistant={activeAssistant}
        onEditSystemPrompt={handleEditSystemPrompt}
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span className="flex-1">{resolveError(error)}</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearError}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Input area */}
      <MessageInput
        onSend={sendMessage}
        onStop={stopGeneration}
        isStreaming={isStreaming}
        droppedFiles={droppedFiles}
        onDroppedFilesConsumed={handleDroppedFilesConsumed}
      />

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 px-12 py-8">
            <ImagePlus className="h-10 w-10 text-primary" />
            <p className="text-sm font-medium text-primary">{t('chat.dropImageHere')}</p>
          </div>
        </div>
      )}

      {/* Assistant Settings Dialog */}
      <AssistantSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        assistantId={activeAssistant?.id ?? null}
        initialTab={settingsInitialTab}
      />
    </div>
  )
}
