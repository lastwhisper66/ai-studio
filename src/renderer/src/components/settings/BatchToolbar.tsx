import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Minus, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
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
import type { ModelCapability, ModelDefinition } from '@shared/types'

export interface BatchToolbarProps {
  /** Currently selected definitions (full objects so we can compute union/diff). */
  selected: ModelDefinition[]
  /** Called for each selected id with the new capability set. */
  onUpdateCapabilities: (id: string, capabilities: ModelCapability[]) => Promise<void>
  /** Called for each selected id to remove it. */
  onDelete: (id: string) => Promise<void>
  /** Called after a batch finishes successfully (e.g. to clear the selection). */
  onBatchDone: () => void
}

export function BatchToolbar({
  selected,
  onUpdateCapabilities,
  onDelete,
  onBatchDone,
}: BatchToolbarProps): React.JSX.Element {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const noSelection = selected.length === 0

  // Caps that at least one selected def has — used for "remove cap" picker.
  const capsInUse: ModelCapability[] = []
  for (const cap of FULL_CAPABILITIES) {
    if (selected.some((d) => d.capabilities.includes(cap))) capsInUse.push(cap)
  }
  // Caps that ALL selected defs have — pre-checked & locked in "add cap" picker
  // so the user can see what's already there without being able to "uncheck-then-add".
  const capsAllHave: ModelCapability[] = []
  if (selected.length > 0) {
    for (const cap of FULL_CAPABILITIES) {
      if (selected.every((d) => d.capabilities.includes(cap))) capsAllHave.push(cap)
    }
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
    <>
      <CapPopover
        triggerLabel={t('modelManage.batch.addCap')}
        triggerIcon={<Plus className="h-3 w-3" />}
        caps={FULL_CAPABILITIES}
        lockedCaps={capsAllHave}
        onConfirm={addCaps}
        disabled={busy || noSelection}
      />
      <CapPopover
        triggerLabel={t('modelManage.batch.removeCap')}
        triggerIcon={<Minus className="h-3 w-3" />}
        caps={capsInUse}
        onConfirm={removeCaps}
        disabled={busy || noSelection || capsInUse.length === 0}
      />
      <Button
        size="sm"
        variant="destructive"
        disabled={busy || noSelection}
        onClick={() => setConfirmDelete(true)}
        className="h-7 gap-1 text-xs">
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
    </>
  )
}

interface CapPopoverProps {
  triggerLabel: string
  triggerIcon: React.ReactNode
  caps: ModelCapability[]
  /** Caps to show as pre-checked + read-only (e.g. caps every selected def already has). */
  lockedCaps?: ModelCapability[]
  onConfirm: (chosen: ModelCapability[]) => Promise<void>
  disabled: boolean
}

function CapPopover({
  triggerLabel,
  triggerIcon,
  caps,
  lockedCaps = [],
  onConfirm,
  disabled,
}: CapPopoverProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<ModelCapability[]>([])

  const toggle = (c: ModelCapability): void => {
    if (lockedCaps.includes(c)) return
    setPicked((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]))
  }

  const confirm = async (): Promise<void> => {
    const additions = picked.filter((c) => !lockedCaps.includes(c))
    await onConfirm(additions)
    setPicked([])
    setOpen(false)
  }

  const hasAdditions = picked.some((c) => !lockedCaps.includes(c))

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (v) setPicked([...lockedCaps])
        else setPicked([])
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
            const isLocked = lockedCaps.includes(cap)
            return (
              <div
                key={cap}
                role="button"
                tabIndex={isLocked ? -1 : 0}
                aria-disabled={isLocked}
                onClick={() => toggle(cap)}
                onKeyDown={(e) => {
                  if (isLocked) return
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle(cap)
                  }
                }}
                className={`focus-visible:ring-ring/50 flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors outline-none focus-visible:ring-2 ${
                  isLocked
                    ? 'text-muted-foreground cursor-not-allowed'
                    : 'hover:bg-accent cursor-pointer'
                } ${isPicked && !isLocked ? 'bg-accent' : ''}`}>
                <Checkbox
                  checked={isPicked}
                  disabled={isLocked}
                  tabIndex={-1}
                  className="pointer-events-none size-3.5"
                />
                <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                {t(cfg.labelKey)}
              </div>
            )
          })}
          <div className="flex justify-end pt-2">
            <Button size="sm" disabled={!hasAdditions} onClick={confirm} className="h-7">
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
