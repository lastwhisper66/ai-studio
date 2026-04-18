import { useEffect, useMemo, useState } from 'react'
import {
  TextSelect,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Sparkles,
  MousePointerClick,
  ShieldAlert,
  X,
  RotateCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '@renderer/i18n'
import { Switch } from '@renderer/components/ui/switch'
import { Label } from '@renderer/components/ui/label'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useSelectionActionStore } from '@renderer/stores/selectionActionStore'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'
import { ShortcutRecorder } from '@renderer/components/settings/ShortcutRecorder'
import { ModelPickerDialog } from '@renderer/components/chat/ModelPickerDialog'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import { ProviderIcon } from '@renderer/components/settings/ProviderIcon'
import {
  selectionActionIconMap,
  defaultSelectionActionIcon,
} from '@renderer/components/selection-toolbar/icons'
import { LANGUAGES, generateTranslatePrompt } from '@renderer/lib/languages'
import { DEFAULT_KEYBINDINGS } from '@shared/keybindings'
import type { SelectionAction } from '@shared/types'
import { DEFAULT_SELECTION_MAX_TEXT_LENGTH, DEFAULT_SELECTION_MIN_TEXT_LENGTH } from '@shared/types'

const SELECTION_ACTION = 'toggle-selection-assistant'
const BUILTIN_SEL_TRANSLATE_ID = 'builtin-sel-translate'
const PROGRAM_NAME_MAX_LENGTH = 120

function parseProgramList(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string' && v.trim()) : []
  } catch {
    return []
  }
}

export function SelectionAssistantSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { settings, saveSettings } = useSettingsStore()
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)
  const { actions, loadActions, createAction, updateAction, deleteAction } =
    useSelectionActionStore()

  // Keybinding
  const overrides = useKeybindingStore((s) => s.overrides)
  const getAccelerator = useKeybindingStore((s) => s.getAccelerator)
  const getAllEffective = useKeybindingStore((s) => s.getAllEffective)
  const setOverride = useKeybindingStore((s) => s.setOverride)
  const resetAction = useKeybindingStore((s) => s.resetAction)
  const [shortcutRegistered, setShortcutRegistered] = useState(true)

  // Core toggles
  const [enabled, setEnabled] = useState(true)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)

  // Action editor dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<SelectionAction | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSystemPrompt, setFormSystemPrompt] = useState('')
  const [formTargetLang, setFormTargetLang] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Excluded programs — live-edited list backed by settings
  const [programInput, setProgramInput] = useState('')
  const excludedPrograms = useMemo(
    () => parseProgramList(settings['selection.excludedPrograms']),
    [settings],
  )

  // Text length thresholds
  const [minLen, setMinLen] = useState('')
  const [maxLen, setMaxLen] = useState('')

  useEffect(() => {
    loadActions()
  }, [loadActions])

  useEffect(() => {
    setEnabled(settings['selection.enabled'] !== 'false')
    setMinLen(settings['selection.minTextLength'] ?? String(DEFAULT_SELECTION_MIN_TEXT_LENGTH))
    setMaxLen(settings['selection.maxTextLength'] ?? String(DEFAULT_SELECTION_MAX_TEXT_LENGTH))
  }, [settings])

  // Keep the Switch in sync when the state flips externally (global shortcut / tray)
  useEffect(() => {
    const unsubscribe = window.api.onSelectionStateChanged((next) => {
      setEnabled(next)
      saveSettings({ 'selection.enabled': String(next) })
    })
    return unsubscribe
  }, [saveSettings])

  const providerId = settings['selection.providerId'] || ''
  const modelId = settings['selection.modelId'] || ''
  const selectedProvider = providers.find((p) => p.id === providerId)
  const selectedModel = models.find((m) => m.name === modelId && m.providerId === providerId)

  const currentAccelerator = getAccelerator(SELECTION_ACTION)
  const shortcutOverridden = SELECTION_ACTION in overrides

  const handleEnabledToggle = async (checked: boolean): Promise<void> => {
    if (checked === enabled) return
    const result = await window.api.toggleSelectionAssistant()
    const next = result.success && typeof result.data === 'boolean' ? result.data : checked
    setEnabled(next)
    await saveSettings({ 'selection.enabled': String(next) })
  }

  const handleShortcutChange = async (accel: string): Promise<void> => {
    const effective = getAllEffective()
    for (const [id, a] of Object.entries(effective)) {
      if (id === SELECTION_ACTION) continue
      if (a.toLowerCase() === accel.toLowerCase()) return
    }
    await setOverride(SELECTION_ACTION, accel)
    const result = await window.api.updateSelectionShortcut()
    setShortcutRegistered(result.data?.registered !== false)
  }

  const handleShortcutReset = async (): Promise<void> => {
    await resetAction(SELECTION_ACTION)
    const result = await window.api.updateSelectionShortcut()
    setShortcutRegistered(result.data?.registered !== false)
  }

  const handleModelSelect = (newProviderId: string, newModelId: string): void => {
    saveSettings({
      'selection.providerId': newProviderId,
      'selection.modelId': newModelId,
    })
    setModelPickerOpen(false)
  }

  const openCreate = (): void => {
    setEditingAction(null)
    setFormName('')
    setFormDescription('')
    setFormSystemPrompt('')
    setFormTargetLang('')
    setEditDialogOpen(true)
  }

  const openEdit = (action: SelectionAction): void => {
    setEditingAction(action)
    setFormName(action.name)
    setFormDescription(action.description)
    if (action.id === BUILTIN_SEL_TRANSLATE_ID) {
      const lang = settings['selection.translateTargetLang'] || i18n.language || 'en'
      setFormTargetLang(lang)
      const englishLabel = LANGUAGES.find((l) => l.code === lang)?.englishLabel ?? lang
      setFormSystemPrompt(generateTranslatePrompt(englishLabel))
    } else {
      setFormSystemPrompt(action.systemPrompt)
      setFormTargetLang('')
    }
    setEditDialogOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!formName.trim()) return
    if (editingAction) {
      await updateAction(editingAction.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        systemPrompt: formSystemPrompt.trim(),
      })
    } else {
      await createAction({
        name: formName.trim(),
        description: formDescription.trim(),
        systemPrompt: formSystemPrompt.trim(),
      })
    }
    setEditDialogOpen(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!pendingDeleteId) return
    await deleteAction(pendingDeleteId)
    setPendingDeleteId(null)
    setDeleteDialogOpen(false)
  }

  const pendingDeleteAction = actions.find((a) => a.id === pendingDeleteId)

  // ── Program exclusion list ──────────────────────────────────────
  const addExcludedProgram = async (): Promise<void> => {
    const trimmed = programInput.trim().slice(0, PROGRAM_NAME_MAX_LENGTH)
    if (!trimmed) return
    if (excludedPrograms.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
      setProgramInput('')
      return
    }
    const next = [...excludedPrograms, trimmed]
    await saveSettings({ 'selection.excludedPrograms': JSON.stringify(next) })
    await window.api.refreshSelectionFilter().catch(() => null)
    setProgramInput('')
  }

  const removeExcludedProgram = async (name: string): Promise<void> => {
    const next = excludedPrograms.filter((p) => p !== name)
    await saveSettings({ 'selection.excludedPrograms': JSON.stringify(next) })
    await window.api.refreshSelectionFilter().catch(() => null)
  }

  // ── Text length thresholds — commit on blur ─────────────────────
  const commitLengthThresholds = async (): Promise<void> => {
    const min = Math.max(
      DEFAULT_SELECTION_MIN_TEXT_LENGTH,
      Number.parseInt(minLen, 10) || DEFAULT_SELECTION_MIN_TEXT_LENGTH,
    )
    const max = Math.max(min, Number.parseInt(maxLen, 10) || DEFAULT_SELECTION_MAX_TEXT_LENGTH)
    await saveSettings({
      'selection.minTextLength': String(min),
      'selection.maxTextLength': String(max),
    })
    await window.api.refreshSelectionFilter().catch(() => null)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.selectionAssistant.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.selectionAssistant.description')}
        </p>
      </div>

      {/* Enable / Shortcut */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.selectionAssistant.general')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <TextSelect className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">
                {t('settings.selectionAssistant.enableLabel')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.selectionAssistant.enableHint')}
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleEnabledToggle} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <MousePointerClick className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">
                {t('settings.selectionAssistant.shortcutLabel')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.selectionAssistant.shortcutHint', {
                  default: DEFAULT_KEYBINDINGS[SELECTION_ACTION].defaultAccelerator,
                })}
              </p>
              {!shortcutRegistered && (
                <p className="text-destructive mt-1 inline-flex items-center gap-1 text-xs">
                  <ShieldAlert className="size-3" />
                  {t('settings.selectionAssistant.shortcutUnavailable')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShortcutRecorder value={currentAccelerator} onChange={handleShortcutChange} />
            {shortcutOverridden && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleShortcutReset}
                title={t('common.reset')}>
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Model */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.selectionAssistant.model')}</h3>
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">
                {t('settings.selectionAssistant.modelLabel')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.selectionAssistant.modelHint')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setModelPickerOpen(true)}
            className="bg-secondary hover:bg-secondary/80 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors">
            {selectedProvider && selectedModel ? (
              <>
                <ProviderIcon
                  type={selectedProvider.type}
                  name={selectedProvider.name}
                  color={getTemplateByType(selectedProvider.type)?.color ?? ''}
                  size="sm"
                />
                <span className="max-w-40 truncate">{selectedModel.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t('common.noModelSet')}</span>
            )}
            <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-xl border bg-card/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{t('settings.selectionAssistant.actions')}</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t('settings.selectionAssistant.actionsHint')}
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('settings.selectionAssistant.addAction')}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {actions.map((action) => {
            const Icon = selectionActionIconMap[action.icon] || defaultSelectionActionIcon
            return (
              <div
                key={action.id}
                className="group flex items-center justify-between gap-4 rounded-lg border bg-card/30 p-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{action.name}</p>
                      {action.isBuiltin && (
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                          {t('settings.quickAssistant.builtin')}
                        </span>
                      )}
                    </div>
                    {action.description && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {action.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch
                    checked={action.enabled}
                    onCheckedChange={(checked) => updateAction(action.id, { enabled: checked })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openEdit(action)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!action.isBuiltin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-7 w-7"
                      onClick={() => {
                        setPendingDeleteId(action.id)
                        setDeleteDialogOpen(true)
                      }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Program filter */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">
          {t('settings.selectionAssistant.excludedPrograms')}
        </h3>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('settings.selectionAssistant.excludedProgramsHint')}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <Input
            value={programInput}
            onChange={(e) => setProgramInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addExcludedProgram()
              }
            }}
            maxLength={PROGRAM_NAME_MAX_LENGTH}
            placeholder={t('settings.selectionAssistant.excludedProgramsPlaceholder')}
          />
          <Button variant="outline" size="sm" onClick={addExcludedProgram}>
            {t('common.add')}
          </Button>
        </div>

        {excludedPrograms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {excludedPrograms.map((name) => (
              <span
                key={name}
                className="bg-secondary text-secondary-foreground inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-xs">
                <span className="max-w-[240px] truncate" title={name}>
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => removeExcludedProgram(name)}
                  className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Length thresholds */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.selectionAssistant.textLength')}</h3>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('settings.selectionAssistant.textLengthHint')}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('settings.selectionAssistant.minLength')}</Label>
            <Input
              type="number"
              min={1}
              value={minLen}
              onChange={(e) => setMinLen(e.target.value)}
              onBlur={commitLengthThresholds}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('settings.selectionAssistant.maxLength')}</Label>
            <Input
              type="number"
              min={1}
              value={maxLen}
              onChange={(e) => setMaxLen(e.target.value)}
              onBlur={commitLengthThresholds}
            />
          </div>
        </div>
      </div>

      {/* Model Picker */}
      <ModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        selectedProviderId={providerId || null}
        selectedModelId={modelId}
        onSelect={handleModelSelect}
      />

      {/* Edit/Create Action */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditingAction(null)
            setFormName('')
            setFormDescription('')
            setFormSystemPrompt('')
            setFormTargetLang('')
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAction
                ? t('settings.selectionAssistant.editAction')
                : t('settings.selectionAssistant.addAction')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('settings.quickAssistant.nameLabel')}</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('settings.quickAssistant.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.quickAssistant.descriptionLabel')}</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('settings.quickAssistant.descriptionPlaceholder')}
              />
            </div>
            {editingAction?.id === BUILTIN_SEL_TRANSLATE_ID && (
              <div className="space-y-2">
                <Label>{t('settings.quickAssistant.targetLangLabel', '目标语言')}</Label>
                <Select
                  value={formTargetLang}
                  onValueChange={(value) => {
                    setFormTargetLang(value)
                    const englishLabel =
                      LANGUAGES.find((l) => l.code === value)?.englishLabel ?? value
                    setFormSystemPrompt(generateTranslatePrompt(englishLabel))
                    // Persist immediately so the bubble picks up the change
                    saveSettings({ 'selection.translateTargetLang': value })
                  }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('settings.quickAssistant.systemPromptLabel')}</Label>
              <Textarea
                value={formSystemPrompt}
                onChange={(e) => setFormSystemPrompt(e.target.value)}
                placeholder={t('settings.quickAssistant.systemPromptPlaceholder')}
                className="min-h-32 max-h-64 resize-none overflow-y-auto"
              />
              <p className="text-muted-foreground text-xs">
                {t('settings.quickAssistant.systemPromptHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!formName.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Action */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.selectionAssistant.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.selectionAssistant.deleteDescription', {
                name: pendingDeleteAction?.name ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
