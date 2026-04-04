import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Paperclip,
  Brain,
  Globe,
  Zap,
  Trash2,
  Maximize2,
  Minimize2,
  Scissors,
  Send,
  Square,
  X,
  Plus,
  Pencil,
  Check,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Input } from '@renderer/components/ui/input'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { usePhraseStore } from '@renderer/stores/phraseStore'
import { cn } from '@renderer/lib/utils'
import type { FileData, ReasoningEffort } from '@shared/types'
import { isImageMime } from '@shared/types'

type AttachedFile = FileData

interface MessageInputProps {
  onSend: (content: string, files?: FileData[], reasoningEffort?: ReasoningEffort) => void
  onStop: () => void
  isStreaming: boolean
  droppedFiles?: FileData[]
  onDroppedFilesConsumed?: () => void
}

type ReasoningLevel = ReasoningEffort | 'off'

// ── Phrase Popover ──────────────────────────────────────────────
function PhrasePopover({ onSelect }: { onSelect: (content: string) => void }): React.JSX.Element {
  const { t } = useTranslation()
  const { phrases, createPhrase, updatePhrase, deletePhrase } = usePhraseStore()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  const handleAdd = async (): Promise<void> => {
    if (!newContent.trim()) return
    await createPhrase(newTitle.trim() || newContent.slice(0, 20), newContent.trim())
    setNewTitle('')
    setNewContent('')
    setAdding(false)
  }

  const handleEdit = async (id: string): Promise<void> => {
    if (!newContent.trim()) return
    await updatePhrase(id, {
      title: newTitle.trim() || newContent.slice(0, 20),
      content: newContent.trim(),
    })
    setEditingId(null)
    setNewTitle('')
    setNewContent('')
  }

  const startEdit = (id: string, title: string, content: string): void => {
    setEditingId(id)
    setNewTitle(title)
    setNewContent(content)
    setAdding(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="hover:bg-muted text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors">
              <Zap className="h-4 w-4" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t('chat.quickPhrases')}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="start" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">{t('chat.quickPhrases')}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => {
              setAdding(true)
              setEditingId(null)
            }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {adding && (
          <div className="space-y-2 border-b p-3">
            <Input
              placeholder={t('chat.phraseTitle')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-7 text-xs"
            />
            <Textarea
              placeholder={t('chat.phraseContent')}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="min-h-16 resize-none text-xs"
            />
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => setAdding(false)}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" className="h-6 text-xs" onClick={handleAdd}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        )}
        <ScrollArea className="max-h-64">
          {phrases.length === 0 && !adding && (
            <p className="text-muted-foreground px-3 py-4 text-center text-xs">
              {t('chat.noPhrasesYet')}
            </p>
          )}
          {phrases.map((phrase) =>
            editingId === phrase.id ? (
              <div key={phrase.id} className="space-y-2 border-b p-3">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-7 text-xs"
                />
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="min-h-16 resize-none text-xs"
                />
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button size="sm" className="h-6 text-xs" onClick={() => handleEdit(phrase.id)}>
                    <Check className="mr-1 h-3 w-3" />
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            ) : (
              <div
                key={phrase.id}
                className="hover:bg-accent group flex cursor-pointer items-start justify-between gap-2 px-3 py-2"
                onClick={() => {
                  onSelect(phrase.content)
                  setOpen(false)
                }}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{phrase.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{phrase.content}</p>
                </div>
                <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation()
                      startEdit(phrase.id, phrase.title, phrase.content)
                    }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation()
                      deletePhrase(phrase.id)
                    }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ),
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

// ── Reasoning Popover ───────────────────────────────────────────
function ReasoningPopover({
  value,
  onChange,
}: {
  value: ReasoningLevel
  onChange: (v: ReasoningLevel) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const levels: { value: ReasoningLevel; label: string }[] = [
    { value: 'off', label: t('chat.reasoningOff') },
    { value: 'low', label: t('chat.reasoningLow') },
    { value: 'medium', label: t('chat.reasoningMedium') },
    { value: 'high', label: t('chat.reasoningHigh') },
    { value: 'xhigh', label: t('chat.reasoningXhigh') },
  ]
  const active = value !== 'off'
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip open={open ? false : undefined}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'hover:bg-muted text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                active && 'text-primary bg-primary/10 hover:bg-primary/15',
              )}>
              <Brain className="h-4 w-4" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{t('chat.reasoning')}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="start" className="w-44 p-1">
        {levels.map((l) => (
          <button
            key={l.value}
            className={cn(
              'hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs',
              value === l.value && 'bg-accent font-medium',
            )}
            onClick={() => {
              onChange(l.value)
              setOpen(false)
            }}>
            <Check className={cn('h-3 w-3', value !== l.value && 'invisible')} />
            {l.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// ── Generic Tool Button ─────────────────────────────────────────
function ToolButton({
  icon,
  label,
  active,
  onClick,
  className,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            'hover:bg-muted text-muted-foreground hover:text-foreground flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            active && 'text-primary bg-primary/10 hover:bg-primary/15',
            className,
          )}>
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

// ── Attachment Preview ──────────────────────────────────────────
function AttachmentPreview({
  files,
  onRemove,
}: {
  files: AttachedFile[]
  onRemove: (index: number) => void
}): React.JSX.Element | null {
  if (files.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 px-4 pt-2">
      {files.map((f, i) => (
        <div key={i} className="bg-muted flex items-center gap-1 rounded-md px-2 py-1 text-xs">
          {isImageMime(f.mimeType) ? (
            <img
              src={`data:${f.mimeType};base64,${f.base64}`}
              className="h-5 w-5 rounded object-cover"
              alt={f.name}
            />
          ) : (
            <Paperclip className="h-3 w-3" />
          )}
          <span className="max-w-24 truncate">{f.name}</span>
          <button
            onClick={() => onRemove(i)}
            className="hover:text-destructive ml-0.5 transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────
export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  droppedFiles,
  onDroppedFilesConsumed,
}: MessageInputProps): React.JSX.Element {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [webSearch, setWebSearch] = useState(false)
  const [reasoning, setReasoning] = useState<ReasoningLevel>('off')
  const [clearDialogOpen, setClearDialogOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeConversationId = useConversationStore((s) => s.activeConversationId)
  const clearMessages = useConversationStore((s) => s.clearMessages)
  const renameConversation = useConversationStore((s) => s.renameConversation)
  const insertDivider = useConversationStore((s) => s.insertDivider)
  const focusInputTrigger = useConversationStore((s) => s.focusInputTrigger)

  // Focus textarea when triggered by store signal
  useEffect(() => {
    if (focusInputTrigger === 0) return
    if (isStreaming) return
    textareaRef.current?.focus()
  }, [focusInputTrigger, isStreaming])

  // Consume files dropped from ChatView drag-and-drop overlay
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing external prop to local state
      setAttachedFiles((prev) => [...prev, ...droppedFiles])
      onDroppedFilesConsumed?.()
      textareaRef.current?.focus()
    }
  }, [droppedFiles, onDroppedFilesConsumed])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    if (isExpanded) {
      el.style.height = ''
      return
    }
    el.style.height = 'auto'
    const maxRows = 8
    const lineH = parseInt(getComputedStyle(el).lineHeight) || 20
    el.style.height = Math.min(el.scrollHeight, lineH * maxRows) + 'px'
  }, [input, isExpanded])

  const buildContent = (): string => {
    let content = input.trim()
    if (webSearch) {
      content = `[网络搜索已开启]\n${content}`
    }
    for (const f of attachedFiles) {
      if (f.mimeType.startsWith('text/') || f.mimeType === 'application/json') {
        // Correctly decode UTF-8 encoded text files
        const bytes = Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))
        const text = new TextDecoder('utf-8').decode(bytes)
        content += `\n\n--- 附件: ${f.name} ---\n${text}`
      }
      // Image files are sent separately via IPC payload, not embedded in text
    }
    return content
  }

  const handleSend = (): void => {
    const content = buildContent()
    if (!content && attachedFiles.length === 0) return
    if (isStreaming) return
    // Collect image files to send via IPC payload
    const imageFiles = attachedFiles.filter((f) => isImageMime(f.mimeType))
    // Use placeholder text when sending only images (images are not persisted in DB)
    const displayContent =
      content ||
      (imageFiles.length > 0
        ? `[${imageFiles.length > 1 ? `${imageFiles.length} 张图片` : '图片'}]`
        : '')
    // Resolve reasoning effort: 'off' means no reasoning parameter
    const effort = reasoning !== 'off' ? reasoning : undefined
    setInput('')
    setAttachedFiles([])
    onSend(displayContent, imageFiles.length > 0 ? imageFiles : undefined, effort)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
    if (e.key === 'Escape' && isExpanded) {
      setIsExpanded(false)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (isImageMime(item.type)) {
        e.preventDefault()
        // Capture mimeType synchronously — DataTransferItem properties become
        // unavailable after the paste event handler returns
        const mimeType = item.type
        const blob = item.getAsFile()
        if (!blob) return
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          // Extract base64 from data URL: "data:image/png;base64,xxxx"
          const base64 = dataUrl.split(',')[1]
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: `clipboard-${Date.now()}.${mimeType.split('/')[1]}`,
              mimeType,
              base64,
              size: blob.size,
            },
          ])
        }
        reader.readAsDataURL(blob)
        return
      }
    }
    // No image found — let default text paste happen
  }

  const handleAttach = async (): Promise<void> => {
    const result = await window.api.openFileDialog()
    if (result.success && result.data && result.data.length > 0) {
      setAttachedFiles((prev) => [...prev, ...result.data!])
    }
  }

  const handleClearMessages = useCallback((): void => {
    if (!activeConversationId) return
    setClearDialogOpen(true)
  }, [activeConversationId])

  const handleClearConfirm = useCallback(async (): Promise<void> => {
    if (activeConversationId) {
      await clearMessages(activeConversationId)
      await renameConversation(activeConversationId, 'New Chat')
    }
    setClearDialogOpen(false)
  }, [activeConversationId, clearMessages, renameConversation])

  const handleInsertDivider = async (): Promise<void> => {
    if (!activeConversationId) return
    await insertDivider()
  }

  const wrapperCls = isExpanded
    ? 'absolute inset-0 z-50 flex flex-col bg-background'
    : 'px-4 pb-4 pt-2'

  const innerCls = isExpanded ? 'flex flex-1 flex-col px-6 pb-6 pt-4' : ''

  return (
    <div className={wrapperCls}>
      {isExpanded && (
        <div className="flex items-center justify-between border-b px-6 py-2">
          <span className="text-sm font-medium">{t('chat.expandedEditor')}</span>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsExpanded(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className={innerCls}>
        <div
          className={`rounded-2xl border bg-card shadow-sm${isExpanded ? ' flex flex-1 flex-col overflow-hidden' : ''}`}>
          {/* Attachment preview */}
          <AttachmentPreview
            files={attachedFiles}
            onRemove={(i) => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))}
          />

          {/* Textarea */}
          <div
            className={`px-4 pt-3 pb-1${isExpanded ? ' flex flex-1 flex-col overflow-hidden' : ''}`}>
            <textarea
              ref={textareaRef}
              placeholder={
                isStreaming ? t('chat.streamingPlaceholder') : t('chat.inputPlaceholder')
              }
              className={`w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground${isExpanded ? ' flex-1' : ''}${isStreaming ? ' opacity-50' : ''}`}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              readOnly={isStreaming}
              style={isExpanded ? undefined : { minHeight: '2.5rem' }}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            {/* Left: tool buttons */}
            <div className="flex items-center gap-0.5">
              <ToolButton
                icon={<Paperclip className="h-4 w-4" />}
                label={t('chat.addAttachment')}
                onClick={handleAttach}
              />
              <ReasoningPopover value={reasoning} onChange={setReasoning} />
              <ToolButton
                icon={<Globe className="h-4 w-4" />}
                label={t('chat.webSearch')}
                active={webSearch}
                onClick={() => setWebSearch((v) => !v)}
              />
              <PhrasePopover onSelect={(c) => setInput((prev) => prev + c)} />
              <ToolButton
                icon={<Trash2 className="h-4 w-4" />}
                label={t('chat.clearMessages')}
                onClick={handleClearMessages}
              />
              <ToolButton
                icon={
                  isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />
                }
                label={isExpanded ? t('chat.collapse') : t('chat.expand')}
                onClick={() => setIsExpanded((v) => !v)}
              />
              <ToolButton
                icon={<Scissors className="h-4 w-4" />}
                label={t('chat.clearContext')}
                onClick={handleInsertDivider}
              />
            </div>

            {/* Right: send / stop */}
            <div className="flex items-center">
              {isStreaming ? (
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8 rounded-lg"
                  onClick={onStop}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={handleSend}
                  disabled={!input.trim() && attachedFiles.length === 0}>
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Clear Messages Confirmation Dialog */}
      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('chat.clearMessagesTitle')}</DialogTitle>
            <DialogDescription>{t('chat.confirmClearMessages')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleClearConfirm}>
              {t('chat.clearMessages')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
