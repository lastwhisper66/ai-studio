import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useModelDefinitionStore } from '@renderer/stores/modelDefinitionStore'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import { GroupRulesPanel } from './GroupRulesPanel'
import { ModelDefinitionsPanel } from './ModelDefinitionsPanel'
import { type GroupSelection, SEL_ALL } from './group-selection'

export function ModelManagementSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { isLoaded: defsLoaded, load: loadDefs } = useModelDefinitionStore()
  const groups = useModelGroupStore((s) => s.groups)
  const loadGroups = useModelGroupStore((s) => s.load)

  const [selection, setSelection] = useState<GroupSelection>(SEL_ALL)

  useEffect(() => {
    if (!defsLoaded) void loadDefs()
    if (groups.length === 0) void loadGroups()
  }, [defsLoaded, groups.length, loadDefs, loadGroups])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{t('settings.sections.modelManagement')}</h2>
        <p className="text-muted-foreground text-sm">{t('modelLibrary.description')}</p>
      </div>

      {/* Two-column body */}
      <div className="flex min-h-0 flex-1">
        <GroupRulesPanel selection={selection} onSelectionChange={setSelection} />
        <ModelDefinitionsPanel selection={selection} />
      </div>
    </div>
  )
}
