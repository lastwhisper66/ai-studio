import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import type { ModelCapability, ModelDefinition } from '@shared/types'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'

export interface ModelDefinitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ModelDefinition
  /** Optional pattern hint shown when adding from a specific rule. */
  groupPatternHint?: string
  onSave: (data: {
    name: string
    capabilities: ModelCapability[]
    contextWindow: number | null
  }) => Promise<void>
}

export function ModelDefinitionDialog({
  open,
  onOpenChange,
  initial,
  groupPatternHint,
  onSave,
}: ModelDefinitionDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [capabilities, setCapabilities] = useState<ModelCapability[]>(initial?.capabilities ?? [])
  const [contextWindow, setContextWindow] = useState(
    initial?.contextWindow != null ? String(initial.contextWindow) : '',
  )

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog open reset
      setName(initial?.name ?? '')
      setCapabilities(initial?.capabilities ?? [])
      setContextWindow(initial?.contextWindow != null ? String(initial.contextWindow) : '')
    }
  }, [open, initial])

  const toggleCapability = (cap: ModelCapability): void => {
    setCapabilities((prev) => (prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]))
  }

  const parsedContextWindow = contextWindow.trim() ? Number(contextWindow) : null
  const isContextWindowInvalid =
    parsedContextWindow !== null &&
    (!Number.isInteger(parsedContextWindow) || parsedContextWindow <= 0)

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    if (isContextWindowInvalid) return
    await onSave({ name: name.trim(), capabilities, contextWindow: parsedContextWindow })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? t('modelLibrary.editDefinition') : t('modelLibrary.addDefinition')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.modelName')}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. gpt-4o, deepseek-chat"
            />
            {groupPatternHint && (
              <p className="text-muted-foreground text-xs">
                {t('modelManage.newDefinitionGroupHint', { pattern: groupPatternHint })}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.contextWindow')}</label>
            <Input
              value={contextWindow}
              onChange={(e) => setContextWindow(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={t('modelLibrary.contextWindowPlaceholder')}
              inputMode="numeric"
            />
            <p className="text-muted-foreground text-xs">{t('modelLibrary.contextWindowHint')}</p>
            {isContextWindowInvalid && (
              <p className="text-destructive text-xs">{t('modelLibrary.contextWindowInvalid')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.capabilities')}</label>
            <div className="flex flex-wrap gap-2">
              {FULL_CAPABILITIES.map((cap) => {
                const cfg = CAPABILITY_CONFIG[cap]
                if (!cfg) return null
                const isActive = capabilities.includes(cap)
                const Icon = cfg.icon
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'border-transparent text-white'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}
                    style={isActive ? { backgroundColor: cfg.color } : undefined}>
                    {isActive && <X className="h-3 w-3" />}
                    <Icon className="h-3 w-3" /> {t(cfg.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || isContextWindowInvalid}>
            {initial ? t('common.save') : t('modelLibrary.addDefinition')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
