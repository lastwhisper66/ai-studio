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
import type { ModelCapability, ModelDefinition, ProviderType } from '@shared/types'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'

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

export interface ModelDefinitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ModelDefinition
  /** Optional pattern hint shown when adding from a specific rule. */
  groupPatternHint?: string
  onSave: (data: {
    name: string
    capabilities: ModelCapability[]
    providerTypes: ProviderType[]
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
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>(initial?.providerTypes ?? [])

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog open reset
      setName(initial?.name ?? '')
      setCapabilities(initial?.capabilities ?? [])
      setProviderTypes(initial?.providerTypes ?? [])
    }
  }, [open, initial])

  const toggleCapability = (cap: ModelCapability): void => {
    setCapabilities((prev) => (prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]))
  }

  const toggleProviderType = (pt: ProviderType): void => {
    setProviderTypes((prev) => (prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]))
  }

  const handleSave = async (): Promise<void> => {
    if (!name.trim()) return
    await onSave({ name: name.trim(), capabilities, providerTypes })
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

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.providerTypes')}</label>
            <p className="text-muted-foreground text-xs">{t('modelLibrary.providerTypesHint')}</p>
            <div className="flex flex-wrap gap-2">
              {ALL_PROVIDER_TYPES.map(({ value, label }) => {
                const isActive = providerTypes.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleProviderType(value)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-transparent'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    }`}>
                    {isActive && <X className="h-3 w-3" />}
                    {label}
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
          <Button onClick={handleSave} disabled={!name.trim()}>
            {initial ? t('common.save') : t('modelLibrary.addDefinition')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
