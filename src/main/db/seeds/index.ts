import { seedDefaultAssistant } from '../assistants'
import { seedModelDefinitions } from '../model-definitions'
import { seedModelGroups } from '../model-groups'
import { seedDefaultProviders } from '../providers'
import { seedQuickActions } from '../quick-actions'
import { seedSelectionActions } from '../selection-actions'

export function seedDatabaseDefaults(): void {
  seedDefaultAssistant()
  seedModelDefinitions()
  seedModelGroups()
  seedDefaultProviders()
  seedQuickActions()
  seedSelectionActions()
}
