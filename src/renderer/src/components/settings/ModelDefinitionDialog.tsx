import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronDown, Check } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@renderer/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@renderer/components/ui/command'
import { cn } from '@renderer/lib/utils'
import type { ModelCapability, ModelDefinition } from '@shared/types'
import { CAPABILITY_CONFIG, FULL_CAPABILITIES } from './capability-config'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'

export interface ModelDefinitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ModelDefinition
  /** Pre-fill the `group` field when adding a new definition from inside a
   *  specific group node (ignored on edit). */
  defaultGroup?: string
  onSave: (data: {
    name: string
    group?: string
    capabilities: ModelCapability[]
    contextWindow: number | null
    reasoningEfforts: string[] | null
  }) => Promise<void>
}

export function ModelDefinitionDialog({
  open,
  onOpenChange,
  initial,
  defaultGroup,
  onSave,
}: ModelDefinitionDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [name, setName] = useState(initial?.name ?? '')
  const [group, setGroup] = useState(initial?.group ?? defaultGroup ?? '')
  const [capabilities, setCapabilities] = useState<ModelCapability[]>(initial?.capabilities ?? [])
  const [contextWindow, setContextWindow] = useState(
    initial?.contextWindow != null ? String(initial.contextWindow) : '',
  )
  const [reasoningEffortsStr, setReasoningEffortsStr] = useState(
    initial?.reasoningEfforts ? initial.reasoningEfforts.join(', ') : '',
  )
  const [groupPopoverOpen, setGroupPopoverOpen] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- dialog open reset
      setName(initial?.name ?? '')
      setGroup(initial?.group ?? defaultGroup ?? '')
      setCapabilities(initial?.capabilities ?? [])
      setContextWindow(initial?.contextWindow != null ? String(initial.contextWindow) : '')
      setReasoningEffortsStr(initial?.reasoningEfforts ? initial.reasoningEfforts.join(', ') : '')
    }
  }, [open, initial, defaultGroup])

  // Suggestions for the group input: distinct display names already in use,
  // sourced from both `model_definitions.group_name` and `model_groups`
  // rows (so user-created empty groups still show up).
  const allDefinitions = useModelDefinitionStore((s) => s.definitions)
  const allRuleGroups = useModelGroupStore((s) => s.groups)
  const groupSuggestions = useMemo(() => {
    const set = new Set<string>()
    for (const d of allDefinitions) {
      const g = d.group?.trim()
      if (g) set.add(g)
    }
    for (const r of allRuleGroups) {
      const g = r.displayName?.trim()
      if (g) set.add(g)
    }
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [allDefinitions, allRuleGroups])

  /** Group suggestions filtered by what the user has typed so far. */
  const filteredGroupSuggestions = useMemo(() => {
    const q = group.trim().toLowerCase()
    if (!q) return groupSuggestions
    return groupSuggestions.filter((g) => g.toLowerCase().includes(q))
  }, [groupSuggestions, group])

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
    const reasoningEfforts = reasoningEffortsStr.trim()
      ? reasoningEffortsStr
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : null
    const trimmedGroup = group.trim()
    await onSave({
      name: name.trim(),
      group: trimmedGroup.length > 0 ? trimmedGroup : undefined,
      capabilities,
      contextWindow: parsedContextWindow,
      reasoningEfforts,
    })
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
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t('modelLibrary.group')}</label>
            <Popover open={groupPopoverOpen} onOpenChange={setGroupPopoverOpen}>
              <PopoverAnchor asChild>
                <div className="relative">
                  <Input
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder={t('modelLibrary.groupPlaceholder')}
                    className="pr-9"
                  />
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label="Toggle group suggestions"
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 -translate-y-1/2 rounded p-1 transition-colors">
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          groupPopoverOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  </PopoverTrigger>
                </div>
              </PopoverAnchor>
              {groupSuggestions.length > 0 && (
                <PopoverContent
                  align="start"
                  className="p-0"
                  style={{ width: 'var(--radix-popper-anchor-width)' }}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  // When this popover opens inside a Radix Dialog, the
                  // dialog's `react-remove-scroll` registers a `wheel`
                  // listener on `document` (bubble phase) that prevents the
                  // default scroll for any target outside the dialog. The
                  // portal'd popover content is technically "outside",
                  // so stop the wheel event from bubbling to `document`
                  // and the native scroll on the list can proceed.
                  onWheel={(e) => e.stopPropagation()}>
                  <Command shouldFilter={false}>
                    <CommandList className="max-h-60">
                      <CommandEmpty>{t('modelLibrary.noGroupMatch')}</CommandEmpty>
                      <CommandGroup>
                        {filteredGroupSuggestions.map((g) => (
                          <CommandItem
                            key={g}
                            value={g}
                            onSelect={(v) => {
                              setGroup(v)
                              setGroupPopoverOpen(false)
                            }}>
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                group === g ? 'opacity-100' : 'opacity-0',
                              )}
                            />
                            {g}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              )}
            </Popover>
            <p className="text-muted-foreground text-xs">{t('modelLibrary.groupHint')}</p>
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
            <label className="text-sm font-medium">{t('modelLibrary.reasoningEfforts')}</label>
            <Input
              value={reasoningEffortsStr}
              onChange={(e) => setReasoningEffortsStr(e.target.value)}
              placeholder="e.g. high, medium, low"
            />
            <p className="text-muted-foreground text-xs">
              {t('modelLibrary.reasoningEffortsHint')}
            </p>
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
