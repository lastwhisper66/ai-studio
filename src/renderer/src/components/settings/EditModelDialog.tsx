import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Button } from '@renderer/components/ui/button'
import type { ModelCapability } from '@shared/types'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'

interface EditModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: { id: string; name: string; group: string; capabilities: ModelCapability[] }
  onSave: (
    id: string,
    data: { name?: string; group?: string; capabilities?: ModelCapability[] },
  ) => Promise<void>
}

export function EditModelDialog({
  open,
  onOpenChange,
  model,
  onSave,
}: EditModelDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(model.name)
  const [group, setGroup] = useState(model.group)
  const [selectedCaps, setSelectedCaps] = useState<ModelCapability[]>(model.capabilities)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog open reset
      setName(model.name)
      setGroup(model.group)
      setSelectedCaps([...model.capabilities])
    }
  }, [open, model])

  const canSubmit = name.trim().length > 0

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    await onSave(model.id, {
      name: name.trim(),
      group: group.trim(),
      capabilities: selectedCaps,
    })
    onOpenChange(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const toggleCap = (cap: ModelCapability): void => {
    setSelectedCaps((prev) => (prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('editModel.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Model Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">
              <span className="text-destructive">*</span> {t('addModel.modelId')}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {/* Group Name */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('addModel.groupName')}</Label>
            <Input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('addModel.groupNamePlaceholder')}
            />
          </div>

          {/* Capabilities */}
          <div className="space-y-1.5">
            <Label className="text-sm">{t('addModel.capabilities')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {FULL_CAPABILITIES.map((cap) => {
                const active = selectedCaps.includes(cap)
                const config = CAPABILITY_CONFIG[cap]
                return (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCap(cap)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                      active
                        ? 'border-transparent font-medium text-white'
                        : 'border-border text-muted-foreground hover:border-primary/50'
                    }`}
                    style={active ? { backgroundColor: config.color } : undefined}>
                    {t(config.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {t('editModel.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
