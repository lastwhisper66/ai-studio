import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { Assistant, ConflictItem, ImportResolution } from '@shared/types'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { useAssistantTemplateStore } from '@renderer/stores/assistantTemplateStore'
import { useConversationStore } from '@renderer/stores/conversationStore'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { AssistantSettingsDialog } from '@renderer/components/chat/AssistantSettingsDialog'
import { CategorySidebar } from './CategorySidebar'
import { LibraryToolbar, type LibraryTab } from './LibraryToolbar'
import { TemplateCard } from './TemplateCard'
import { AssistantCard } from './AssistantCard'
import { ImportConflictDialog } from './ImportConflictDialog'
import { listAllCategories, listAssistantGroups } from './categories'

function matchesSearch(a: Assistant, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  const haystack = [a.name, a.description, a.systemPrompt, ...a.promptSuggestions]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export function AssistantLibraryView(): React.JSX.Element {
  const { t } = useTranslation()

  const templates = useAssistantTemplateStore((s) => s.templates)
  const createTemplate = useAssistantTemplateStore((s) => s.createTemplate)
  const deleteTemplate = useAssistantTemplateStore((s) => s.deleteTemplate)
  const addFromTemplate = useAssistantTemplateStore((s) => s.addFromTemplate)
  const saveAsTemplate = useAssistantTemplateStore((s) => s.saveAsTemplate)
  const exportTemplate = useAssistantTemplateStore((s) => s.exportTemplate)
  const importTemplates = useAssistantTemplateStore((s) => s.importTemplates)
  const applyImport = useAssistantTemplateStore((s) => s.applyImport)

  const assistants = useAssistantStore((s) => s.assistants)
  const addAssistant = useAssistantStore((s) => s.addAssistant)
  const deleteAssistant = useAssistantStore((s) => s.deleteAssistant)
  const updateAssistant = useAssistantStore((s) => s.updateAssistant)
  const duplicateAssistant = useAssistantStore((s) => s.duplicateAssistant)
  const loadAssistants = useAssistantStore((s) => s.loadAssistants)
  const setActiveAssistantId = useAssistantStore((s) => s.setActiveAssistantId)

  const conversations = useConversationStore((s) => s.conversations)
  const createConversation = useConversationStore((s) => s.createConversation)
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation)
  const setActiveView = useSettingsStore((s) => s.setActiveView)

  const [tab, setTab] = useState<LibraryTab>('discover')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'template' | 'assistant'>('template')
  const [editorTargetId, setEditorTargetId] = useState<string | null>(null)
  const [editorCreate, setEditorCreate] = useState(false)

  const [importPlanOpen, setImportPlanOpen] = useState(false)
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [pendingOk, setPendingOk] = useState<Assistant[]>([])
  const [statusToast, setStatusToast] = useState<string | null>(null)

  // ── Filtered data ─────────────────────────────────────────
  const visibleTemplates = useMemo(() => {
    return templates
      .filter((tpl) => activeCategory === null || tpl.category === activeCategory)
      .filter((tpl) => matchesSearch(tpl, search))
  }, [templates, activeCategory, search])

  const visibleAssistants = useMemo(() => {
    return assistants
      .filter((a) => activeCategory === null || a.group === activeCategory)
      .filter((a) => matchesSearch(a, search))
  }, [assistants, activeCategory, search])

  // ── Category counts ───────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const list = tab === 'discover' ? listAllCategories(templates) : listAssistantGroups(assistants)
    return list.map((id) => ({
      id,
      count:
        tab === 'discover'
          ? templates.filter((tpl) => tpl.category === id).length
          : assistants.filter((a) => a.group === id).length,
    }))
  }, [tab, templates, assistants])

  // ── Card actions ──────────────────────────────────────────
  const handleAdd = useCallback(
    async (template: Assistant) => {
      const created = await addFromTemplate(template.id)
      if (created) await loadAssistants()
    },
    [addFromTemplate, loadAssistants],
  )

  const handleGoToChat = useCallback(
    async (assistantId: string) => {
      setActiveAssistantId(assistantId)
      const existing = conversations.find((c) => c.assistantId === assistantId)
      if (existing) {
        await setActiveConversation(existing.id)
      } else {
        await createConversation(undefined, assistantId)
      }
      setActiveView('chat')
    },
    [conversations, createConversation, setActiveAssistantId, setActiveConversation, setActiveView],
  )

  const handleEditTemplate = (template: Assistant): void => {
    setEditorMode('template')
    setEditorTargetId(template.id)
    setEditorCreate(false)
    setEditorOpen(true)
  }

  const handleEditAssistant = (assistant: Assistant): void => {
    setEditorMode('assistant')
    setEditorTargetId(assistant.id)
    setEditorCreate(false)
    setEditorOpen(true)
  }

  const handleDuplicateTemplate = async (template: Assistant): Promise<void> => {
    await createTemplate({
      name: `${template.name} ${t('library.card.copySuffix')}`,
      icon: template.icon,
      description: template.description,
      systemPrompt: template.systemPrompt,
      promptSuggestions: template.promptSuggestions,
      category: template.category,
      recommendedModel: template.recommendedModel,
      temperature: template.temperature,
      maxCompletionTokens: template.maxCompletionTokens,
      topP: template.topP,
      contextCount: template.contextCount,
    })
  }

  const handleDeleteTemplate = async (template: Assistant): Promise<void> => {
    await deleteTemplate(template.id)
  }

  const handleExportTemplate = async (template: Assistant): Promise<void> => {
    const r = await exportTemplate(template.id)
    if (r)
      setStatusToast(t('library.import.toast.success', { imported: 0, skipped: 0, overwritten: 0 }))
  }

  const handleSaveAsTemplate = async (assistant: Assistant): Promise<void> => {
    await saveAsTemplate(assistant.id)
  }

  const handleSetDefault = async (assistant: Assistant): Promise<void> => {
    await updateAssistant(assistant.id, { isDefault: true })
    await loadAssistants()
  }

  // ── Toolbar actions ───────────────────────────────────────
  const handleNewTemplate = (): void => {
    setEditorMode('template')
    setEditorTargetId(null)
    setEditorCreate(true)
    setEditorOpen(true)
  }

  const handleImport = async (): Promise<void> => {
    const plan = await importTemplates()
    if (!plan) return
    if (plan.conflicts.length === 0) {
      const r = await applyImport({ ok: plan.ok, resolutions: [] })
      if (r) setStatusToast(t('library.import.toast.success', { ...r }))
      return
    }
    setPendingOk(plan.ok)
    setConflicts(plan.conflicts)
    setImportPlanOpen(true)
  }

  const handleConflictApply = async (
    resolutions: Array<ImportResolution & { template: Assistant }>,
  ): Promise<void> => {
    const r = await applyImport({ ok: pendingOk, resolutions })
    setImportPlanOpen(false)
    setPendingOk([])
    setConflicts([])
    if (r) setStatusToast(t('library.import.toast.success', { ...r }))
  }

  // ── Editor save callback ─────────────────────────────────
  const handleCreateFromEditor = async (
    data: Partial<Assistant> & { name: string },
  ): Promise<void> => {
    if (editorMode === 'template') {
      await createTemplate(data)
    } else {
      await addAssistant(data)
    }
  }

  // ── Empty state ──────────────────────────────────────────
  const emptyMessage =
    tab === 'discover'
      ? search
        ? t('library.empty.noResults')
        : t('library.empty.noTemplates')
      : search
        ? t('library.empty.noResults')
        : t('library.empty.noAssistants')

  const items = tab === 'discover' ? visibleTemplates : visibleAssistants

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b px-6">
        <h1 className="text-base font-semibold">{t('nav.library')}</h1>
      </div>

      <div className="flex min-h-0 flex-1">
        <CategorySidebar
          categories={categoryCounts}
          totalCount={tab === 'discover' ? templates.length : assistants.length}
          activeCategory={activeCategory}
          onSelect={setActiveCategory}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <LibraryToolbar
            activeTab={tab}
            onTabChange={(next) => {
              setTab(next)
              setActiveCategory(null)
            }}
            templateCount={templates.length}
            assistantCount={assistants.length}
            searchQuery={search}
            onSearchChange={setSearch}
            onNewTemplate={handleNewTemplate}
            onImport={handleImport}
          />

          <ScrollArea className="flex-1">
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.length === 0 ? (
                <div className="col-span-full flex h-40 items-center justify-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : tab === 'discover' ? (
                visibleTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    onAdd={handleAdd}
                    onGoToChat={handleGoToChat}
                    onEdit={handleEditTemplate}
                    onDuplicate={handleDuplicateTemplate}
                    onExport={handleExportTemplate}
                    onDelete={handleDeleteTemplate}
                  />
                ))
              ) : (
                visibleAssistants.map((a) => (
                  <AssistantCard
                    key={a.id}
                    assistant={a}
                    onGoToChat={handleGoToChat}
                    onEdit={handleEditAssistant}
                    onDuplicate={(x) => duplicateAssistant(x.id)}
                    onSaveAsTemplate={handleSaveAsTemplate}
                    onSetDefault={handleSetDefault}
                    onDelete={(x) => deleteAssistant(x.id)}
                  />
                ))
              )}
            </div>

            {statusToast && (
              <div className="border-t bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {statusToast}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      <AssistantSettingsDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        assistantId={editorTargetId}
        mode={editorCreate ? 'create' : 'edit'}
        editorRole={editorMode}
        onCreate={handleCreateFromEditor}
      />

      <ImportConflictDialog
        open={importPlanOpen}
        conflicts={conflicts}
        onCancel={() => {
          setImportPlanOpen(false)
          setPendingOk([])
          setConflicts([])
        }}
        onApply={handleConflictApply}
      />
    </div>
  )
}
