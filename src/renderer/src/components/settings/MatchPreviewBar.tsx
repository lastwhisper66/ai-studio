import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { inferModelGroup } from '@renderer/lib/inferModelGroup'
import { CAPABILITY_CONFIG } from './capability-config'
import type { ModelDefinition, ModelGroup } from '@shared/types'

export interface MatchPreviewBarProps {
  /** Called when user clicks the "matched definition" row. */
  onPickDefinition: (def: ModelDefinition) => void
  /** Called when user clicks the "matched rule" row. Receives undefined when
   *  the row's call-to-action is "no rule matched" (caller may switch to the
   *  Unmatched pseudo-node). */
  onPickRule: (rule: ModelGroup | undefined) => void
}

/**
 * A debounced input that, given any model name, shows in one strip:
 *   1. Which `model_definition` it would resolve to (or "no definition match")
 *   2. Which `model_group` rule it would resolve to (or "no rule match;
 *      inferred as <inferModelGroup(name)>")
 * Clicking either row jumps the caller to that record.
 */
export function MatchPreviewBar({
  onPickDefinition,
  onPickRule,
}: MatchPreviewBarProps): React.JSX.Element {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const id = setTimeout(() => setDebounced(input), 200)
    return () => clearTimeout(id)
  }, [input])

  const resolveDef = useModelDefinitionStore((s) => s.resolve)
  const resolveRule = useModelGroupStore((s) => s.resolveRule)

  const matched = useMemo(() => {
    const name = debounced.trim()
    if (!name) return null
    return {
      def: resolveDef(name),
      rule: resolveRule(name),
      inferred: inferModelGroup(name),
    }
  }, [debounced, resolveDef, resolveRule])

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('modelManage.preview.placeholder')}
          className="pl-9"
        />
      </div>

      {matched && (
        <div className="bg-muted/40 space-y-1.5 rounded-md border p-2.5 text-xs">
          {/* Row 1: matched definition */}
          {matched.def ? (
            <button
              type="button"
              onClick={() => onPickDefinition(matched.def!)}
              className="hover:bg-accent/40 flex w-full items-center gap-2 rounded px-1.5 py-1 text-left">
              <span className="text-muted-foreground shrink-0">
                {t('modelManage.preview.matchedDef')}:
              </span>
              <span className="font-medium">{matched.def.name}</span>
              <div className="flex gap-1">
                {matched.def.capabilities.map((cap) => {
                  const cfg = CAPABILITY_CONFIG[cap]
                  if (!cfg) return null
                  const Icon = cfg.icon
                  return (
                    <span
                      key={cap}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                      }}>
                      <Icon className="h-2.5 w-2.5" style={{ color: cfg.color }} />
                    </span>
                  )
                })}
              </div>
            </button>
          ) : (
            <div className="text-muted-foreground px-1.5 py-1">
              <span className="shrink-0">{t('modelManage.preview.matchedDef')}:</span>{' '}
              <span className="italic">{t('modelManage.preview.noDefMatch')}</span>
            </div>
          )}

          {/* Row 2: matched rule, or fallback inferral */}
          {matched.rule ? (
            <button
              type="button"
              onClick={() => onPickRule(matched.rule!)}
              className="hover:bg-accent/40 flex w-full items-center gap-2 rounded px-1.5 py-1 text-left">
              <span className="text-muted-foreground shrink-0">
                {t('modelManage.preview.matchedRule')}:
              </span>
              <span className="font-medium">{matched.rule.displayName}</span>
              <span className="text-muted-foreground font-mono">({matched.rule.pattern})</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onPickRule(undefined)}
              className="hover:bg-accent/40 text-muted-foreground flex w-full items-center gap-2 rounded px-1.5 py-1 text-left italic">
              {t('modelManage.preview.fallback', { name: matched.inferred })}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
