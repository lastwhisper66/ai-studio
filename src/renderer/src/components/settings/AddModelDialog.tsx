import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Button } from '@renderer/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import type { ModelCapability } from '@shared/types'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'

interface AddModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingNames: string[]
  onAdd: (modelId: string, group?: string, capabilities?: ModelCapability[]) => Promise<unknown>
}

export function AddModelDialog({
  open,
  onOpenChange,
  existingNames,
  onAdd,
}: AddModelDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [modelId, setModelId] = useState('')
  const [modelGroup, setModelGroup] = useState('')
  const [selectedCaps, setSelectedCaps] = useState<ModelCapability[]>([])

  const isDuplicate = existingNames.includes(modelId.trim())
  const canSubmit = modelId.trim() && !isDuplicate

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return
    await onAdd(
      modelId.trim(),
      modelGroup.trim() || undefined,
      selectedCaps.length > 0 ? selectedCaps : undefined,
    )
    setModelId('')
    setModelGroup('')
    setSelectedCaps([])
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
          <DialogTitle>{t('addModel.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Model ID (required) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm">
                <span className="text-destructive">*</span> {t('addModel.modelId')}
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="text-muted-foreground/50 h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>{t('addModel.modelIdTooltip')}</TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('addModel.modelIdPlaceholder')}
              autoFocus
            />
            {isDuplicate && (
              <p className="text-destructive text-xs">{t('addModel.duplicateError')}</p>
            )}
          </div>

          {/* Group Name (optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm">{t('addModel.groupName')}</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="text-muted-foreground/50 h-3.5 w-3.5 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>{t('addModel.groupNameTooltip')}</TooltipContent>
              </Tooltip>
            </div>
            <Input
              value={modelGroup}
              onChange={(e) => setModelGroup(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('addModel.groupNamePlaceholder')}
            />
          </div>

          {/* Capabilities (optional) */}
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
            {t('addModel.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
