import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'
import type { ModelCapability, ModelDefinition, ProviderType } from '@shared/types'

const ALL_PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'openai-response', label: 'OpenAI Response' },
  { value: 'azure', label: 'Azure' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'silicon', label: 'Silicon Flow' },
  { value: 'newapi', label: 'NewAPI' },
]

export interface BatchToolbarProps {
  /** Currently selected definitions (full objects so we can compute union/diff). */
  selected: ModelDefinition[]
  /** Called for each selected id with the new capability set. */
  onUpdateCapabilities: (id: string, capabilities: ModelCapability[]) => Promise<void>
  /** Called for each selected id with the new provider-types set. */
  onUpdateProviderTypes: (id: string, providerTypes: ProviderType[]) => Promise<void>
  /** Called for each selected id to remove it. */
  onDelete: (id: string) => Promise<void>
  /** Called after a batch finishes successfully (e.g. to clear the selection). */
  onBatchDone: () => void
}

export function BatchToolbar({
  selected,
  onUpdateCapabilities,
  onUpdateProviderTypes,
  onDelete,
  onBatchDone,
}: BatchToolbarProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (selected.length === 0) return null

  // Caps that at least one selected def has — used for "remove cap" picker.
  const capsInUse: ModelCapability[] = []
  for (const cap of FULL_CAPABILITIES) {
    if (selected.some((d) => d.capabilities.includes(cap))) capsInUse.push(cap)
  }
  const providerTypesInUse: ProviderType[] = []
  for (const pt of ALL_PROVIDER_TYPES) {
    if (selected.some((d) => d.providerTypes.includes(pt.value))) providerTypesInUse.push(pt.value)
  }

  const addCaps = async (caps: ModelCapability[]): Promise<void> => {
    if (caps.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = Array.from(new Set([...def.capabilities, ...caps]))
        await onUpdateCapabilities(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const removeCaps = async (caps: ModelCapability[]): Promise<void> => {
    if (caps.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = def.capabilities.filter((c) => !caps.includes(c))
        await onUpdateCapabilities(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const addProviders = async (pts: ProviderType[]): Promise<void> => {
    if (pts.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = Array.from(new Set([...def.providerTypes, ...pts]))
        await onUpdateProviderTypes(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const removeProviders = async (pts: ProviderType[]): Promise<void> => {
    if (pts.length === 0) return
    setBusy(true)
    try {
      for (const def of selected) {
        const next = def.providerTypes.filter((p) => !pts.includes(p))
        await onUpdateProviderTypes(def.id, next)
      }
      onBatchDone()
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (): Promise<void> => {
    setBusy(true)
    try {
      for (const def of selected) {
        await onDelete(def.id)
      }
      onBatchDone()
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5">
      <span className="text-muted-foreground text-xs">
        {t('modelManage.batch.selected', { count: selected.length })}
      </span>

      <CapPopover
        triggerLabel={t('modelManage.batch.addCap')}
        triggerIcon={<Plus className="h-3 w-3" />}
        caps={FULL_CAPABILITIES}
        onConfirm={addCaps}
        disabled={busy}
      />
      <CapPopover
        triggerLabel={t('modelManage.batch.removeCap')}
        triggerIcon={<Minus className="h-3 w-3" />}
        caps={capsInUse}
        onConfirm={removeCaps}
        disabled={busy || capsInUse.length === 0}
      />

      <ProviderPopover
        triggerLabel={t('modelManage.batch.addProvider')}
        triggerIcon={<Plus className="h-3 w-3" />}
        items={ALL_PROVIDER_TYPES}
        onConfirm={addProviders}
        disabled={busy}
      />
      <ProviderPopover
        triggerLabel={t('modelManage.batch.removeProvider')}
        triggerIcon={<Minus className="h-3 w-3" />}
        items={ALL_PROVIDER_TYPES.filter((p) => providerTypesInUse.includes(p.value))}
        onConfirm={removeProviders}
        disabled={busy || providerTypesInUse.length === 0}
      />

      <Button
        size="sm"
        variant="destructive"
        disabled={busy}
        onClick={() => setConfirmDelete(true)}
        className="ml-auto h-7 gap-1 text-xs">
        <Trash2 className="h-3 w-3" />
        {t('modelManage.batch.delete')}
      </Button>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelManage.batch.confirmDelete', { count: selected.length })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

interface CapPopoverProps {
  triggerLabel: string
  triggerIcon: React.ReactNode
  caps: ModelCapability[]
  onConfirm: (chosen: ModelCapability[]) => Promise<void>
  disabled: boolean
}

function CapPopover({
  triggerLabel,
  triggerIcon,
  caps,
  onConfirm,
  disabled,
}: CapPopoverProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<ModelCapability[]>([])

  const toggle = (c: ModelCapability): void => {
    setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const confirm = async (): Promise<void> => {
    await onConfirm(picked)
    setPicked([])
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v) setPicked([])
        setOpen(v)
      }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="h-7 gap-1 text-xs">
          {triggerIcon}
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-1">
          {caps.map((cap) => {
            const cfg = CAPABILITY_CONFIG[cap]
            const Icon = cfg.icon
            const isPicked = picked.includes(cap)
            return (
              <button
                key={cap}
                type="button"
                onClick={() => toggle(cap)}
                className={`hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                  isPicked ? 'bg-accent' : ''
                }`}>
                <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                {t(cfg.labelKey)}
              </button>
            )
          })}
          <div className="flex justify-end pt-2">
            <Button size="sm" disabled={picked.length === 0} onClick={confirm} className="h-7">
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface ProviderPopoverProps {
  triggerLabel: string
  triggerIcon: React.ReactNode
  items: { value: ProviderType; label: string }[]
  onConfirm: (chosen: ProviderType[]) => Promise<void>
  disabled: boolean
}

function ProviderPopover({
  triggerLabel,
  triggerIcon,
  items,
  onConfirm,
  disabled,
}: ProviderPopoverProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<ProviderType[]>([])

  const toggle = (p: ProviderType): void => {
    setPicked((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  const confirm = async (): Promise<void> => {
    await onConfirm(picked)
    setPicked([])
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (!v) setPicked([])
        setOpen(v)
      }}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} className="h-7 gap-1 text-xs">
          {triggerIcon}
          {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="start">
        <div className="space-y-1">
          {items.map(({ value, label }) => {
            const isPicked = picked.includes(value)
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value)}
                className={`hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors ${
                  isPicked ? 'bg-accent' : ''
                }`}>
                {label}
              </button>
            )
          })}
          <div className="flex justify-end pt-2">
            <Button size="sm" disabled={picked.length === 0} onClick={confirm} className="h-7">
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
