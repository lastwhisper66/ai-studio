import { useEffect, useState } from 'react'
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  Sparkles,
  Pin,
  MousePointerClick,
  RotateCcw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from '@renderer/i18n'
import { useSeedTranslator } from '@renderer/hooks/useSeedTranslator'
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
import { useQuickActionStore } from '@renderer/stores/quickActionStore'
import { useKeybindingStore } from '@renderer/stores/keybindingStore'
import { ShortcutRecorder } from '@renderer/components/settings/ShortcutRecorder'
import { ModelPickerDialog } from '@renderer/components/chat/ModelPickerDialog'
import { getTemplateByType } from '@renderer/components/settings/provider-templates'
import { ProviderIcon } from '@renderer/components/settings/ProviderIcon'
import {
  quickActionIconMap,
  defaultQuickActionIcon,
} from '@renderer/components/quick-assistant/icons'
import {
  LANGUAGES,
  generateTranslatePrompt,
  generateImageTranslatePrompt,
} from '@renderer/lib/languages'
import type { QuickAction } from '@shared/types'

const QUICK_ASSISTANT_ACTION = 'toggle-quick-assistant'

export function QuickAssistantSection(): React.JSX.Element {
  const { t } = useTranslation()
  const st = useSeedTranslator()
  const { settings, saveSettings } = useSettingsStore()
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)
  const { actions, loadActions, createAction, updateAction, deleteAction } = useQuickActionStore()

  const [enabled, setEnabled] = useState(true)
  const [defaultPinned, setDefaultPinned] = useState(false)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSystemPrompt, setFormSystemPrompt] = useState('')
  const [formTargetLang, setFormTargetLang] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Keybinding
  const overrides = useKeybindingStore((s) => s.overrides)
  const getAccelerator = useKeybindingStore((s) => s.getAccelerator)
  const getAllEffective = useKeybindingStore((s) => s.getAllEffective)
  const setOverride = useKeybindingStore((s) => s.setOverride)
  const resetAction = useKeybindingStore((s) => s.resetAction)

  const currentAccelerator = getAccelerator(QUICK_ASSISTANT_ACTION)
  const shortcutOverridden = QUICK_ASSISTANT_ACTION in overrides

  const handleShortcutChange = async (accel: string): Promise<void> => {
    const effective = getAllEffective()
    for (const [id, a] of Object.entries(effective)) {
      if (id === QUICK_ASSISTANT_ACTION) continue
      if (a.toLowerCase() === accel.toLowerCase()) return
    }
    await setOverride(QUICK_ASSISTANT_ACTION, accel)
  }

  useEffect(() => {
    loadActions()
  }, [loadActions])

  useEffect(() => {
    setEnabled(settings['quickAssistant.enabled'] !== 'false')
    setDefaultPinned(settings['quickAssistant.defaultPinned'] === 'true')
  }, [settings])

  const providerId = settings['quickAssistant.providerId'] || ''
  const modelId = settings['quickAssistant.modelId'] || ''

  // Resolve display names
  const selectedProvider = providers.find((p) => p.id === providerId)
  const selectedModel = models.find((m) => m.name === modelId && m.providerId === providerId)

  const handleEnabledToggle = (checked: boolean): void => {
    setEnabled(checked)
    saveSettings({ 'quickAssistant.enabled': String(checked) })
  }

  const handleDefaultPinnedToggle = (checked: boolean): void => {
    setDefaultPinned(checked)
    saveSettings({ 'quickAssistant.defaultPinned': String(checked) })
  }

  const handleModelSelect = (newProviderId: string, newModelId: string): void => {
    saveSettings({
      'quickAssistant.providerId': newProviderId,
      'quickAssistant.modelId': newModelId,
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

  const openEdit = (action: QuickAction): void => {
    setEditingAction(action)
    setFormName(st(action.name))
    setFormDescription(st(action.description))
    if (action.id === 'builtin-translate' || action.id === 'builtin-image-translate') {
      const lang = settings['quickAssistant.translateTargetLang'] || i18n.language || 'en'
      setFormTargetLang(lang)
      const englishLabel = LANGUAGES.find((l) => l.code === lang)?.englishLabel ?? lang
      setFormSystemPrompt(
        action.id === 'builtin-image-translate'
          ? generateImageTranslatePrompt(englishLabel)
          : generateTranslatePrompt(englishLabel),
      )
    } else {
      setFormSystemPrompt(action.systemPrompt)
      setFormTargetLang('')
    }
    setEditDialogOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!formName.trim()) return
    if (editingAction) {
      // If the user didn't actually edit the display values, keep the
      // original raw strings (which may be `seed.*` i18n keys) so that the
      // built-in row stays translatable on language change.
      const name = formName.trim() === st(editingAction.name) ? editingAction.name : formName.trim()
      const description =
        formDescription.trim() === st(editingAction.description)
          ? editingAction.description
          : formDescription.trim()
      await updateAction(editingAction.id, {
        name,
        description,
        systemPrompt: formSystemPrompt.trim(),
      })
      // Note: translateTargetLang is persisted immediately in the dropdown's
      // onValueChange handler, so no need to save it again here.
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.quickAssistant.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.quickAssistant.description')}
        </p>
      </div>

      {/* Enable/Disable */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.quickAssistant.general')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Zap className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">
                {t('settings.quickAssistant.enableLabel')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.quickAssistant.enableHint')}
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleEnabledToggle} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Pin className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">
                {t('settings.quickAssistant.defaultPinnedLabel')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.quickAssistant.defaultPinnedHint')}
              </p>
            </div>
          </div>
          <Switch checked={defaultPinned} onCheckedChange={handleDefaultPinnedToggle} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <MousePointerClick className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">
                {t('settings.quickAssistant.shortcutLabel')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.quickAssistant.shortcutHint')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShortcutRecorder value={currentAccelerator} onChange={handleShortcutChange} />
            {shortcutOverridden && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => resetAction(QUICK_ASSISTANT_ACTION)}
                title={t('common.reset')}>
                <RotateCcw className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Model Selection */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">{t('settings.quickAssistant.model')}</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">
                {t('settings.quickAssistant.modelLabel')}
              </Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t('settings.quickAssistant.modelHint')}
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

      {/* Actions Management */}
      <div className="rounded-xl border bg-card/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('settings.quickAssistant.actions')}</h3>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('settings.quickAssistant.addAction')}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {actions.map((action) => {
            const Icon = quickActionIconMap[action.icon] || defaultQuickActionIcon
            const displayName = st(action.name)
            const displayDesc = st(action.description)
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
                      <p className="text-sm font-medium">{displayName}</p>
                      {action.isBuiltin && (
                        <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                          {t('settings.quickAssistant.builtin')}
                        </span>
                      )}
                    </div>
                    {displayDesc && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">{displayDesc}</p>
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

      {/* Model Picker Dialog */}
      <ModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        selectedProviderId={providerId || null}
        selectedModelId={modelId}
        onSelect={handleModelSelect}
      />

      {/* Edit/Create Dialog */}
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
                ? t('settings.quickAssistant.editAction')
                : t('settings.quickAssistant.addAction')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('settings.quickAssistant.nameLabel')}</Label>
              <Input
                placeholder={t('settings.quickAssistant.namePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.quickAssistant.descriptionLabel')}</Label>
              <Input
                placeholder={t('settings.quickAssistant.descriptionPlaceholder')}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            {(editingAction?.id === 'builtin-translate' ||
              editingAction?.id === 'builtin-image-translate') && (
              <div className="space-y-2">
                <Label>{t('settings.quickAssistant.targetLangLabel', '目标语言')}</Label>
                <Select
                  value={formTargetLang}
                  onValueChange={(value) => {
                    setFormTargetLang(value)
                    const englishLabel =
                      LANGUAGES.find((l) => l.code === value)?.englishLabel ?? value
                    setFormSystemPrompt(
                      editingAction?.id === 'builtin-image-translate'
                        ? generateImageTranslatePrompt(englishLabel)
                        : generateTranslatePrompt(englishLabel),
                    )
                    // Persist immediately so the quick assistant popup picks up the change
                    saveSettings({ 'quickAssistant.translateTargetLang': value })
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
                placeholder={t('settings.quickAssistant.systemPromptPlaceholder')}
                value={formSystemPrompt}
                onChange={(e) => setFormSystemPrompt(e.target.value)}
                className="min-h-32 max-h-64 overflow-y-auto resize-none"
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.quickAssistant.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.quickAssistant.deleteDescription', {
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
