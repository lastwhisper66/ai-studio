import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { GroupRulesPanel } from './GroupRulesPanel'
import { ModelDefinitionsPanel, type ModelDefinitionsPanelHandle } from './ModelDefinitionsPanel'
import { MatchPreviewBar } from './MatchPreviewBar'
import { type GroupSelection, SEL_ALL, SEL_UNMATCHED } from './group-selection'

export function ModelManagementSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { isLoaded: defsLoaded, load: loadDefs } = useModelDefinitionStore()
  const groups = useModelGroupStore((s) => s.groups)
  const loadGroups = useModelGroupStore((s) => s.load)

  const [selection, setSelection] = useState<GroupSelection>(SEL_ALL)
  const defsPanelRef = useRef<ModelDefinitionsPanelHandle>(null)

  useEffect(() => {
    if (!defsLoaded) void loadDefs()
    if (groups.length === 0) void loadGroups()
  }, [defsLoaded, groups.length, loadDefs, loadGroups])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{t('settings.sections.modelManagement')}</h2>
            <p className="text-muted-foreground text-sm">{t('modelLibrary.description')}</p>
          </div>
          <div className="w-80">
            <MatchPreviewBar
              onPickDefinition={(def) => {
                // Jump to the rule that covers it (or "unmatched"), then highlight.
                const ruleStore = useModelGroupStore.getState()
                const rule = ruleStore.resolveRule(def.name)
                setSelection(rule ? { kind: 'rule', group: rule } : SEL_UNMATCHED)
                // Defer to next tick so the new list has rendered.
                setTimeout(() => defsPanelRef.current?.highlightDefinition(def.id), 0)
              }}
              onPickRule={(rule) => {
                setSelection(rule ? { kind: 'rule', group: rule } : SEL_UNMATCHED)
              }}
            />
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex min-h-0 flex-1">
        <GroupRulesPanel selection={selection} onSelectionChange={setSelection} />
        <ModelDefinitionsPanel ref={defsPanelRef} selection={selection} />
      </div>
    </div>
  )
}
