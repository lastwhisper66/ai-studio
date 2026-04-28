import { seedDefaultAssistant } from '../assistants'
import { seedModelDefinitions } from '../model-definitions'
import { seedModelGroups } from '../model-groups'
import { seedDefaultProviders } from '../providers'
import { seedQuickActions, migrateBuiltinTranslatePrompts } from '../quick-actions'
import { seedSelectionActions, migrateBuiltinSelectionTranslatePrompts } from '../selection-actions'

export function seedDatabaseDefaults(): void {
  seedDefaultAssistant()
  seedModelDefinitions()
  seedModelGroups()
  seedDefaultProviders()
  seedQuickActions()
  seedSelectionActions()
  migrateBuiltinTranslatePrompts()
  migrateBuiltinSelectionTranslatePrompts()
}
