import { seedDefaultAssistant } from '../assistants'
import { seedAssistantTemplates } from '../templates'
import { seedModelDefinitions } from '../model-definitions'
import { seedModelGroups } from '../model-groups'
import { seedDefaultProviders } from '../providers'
import { seedQuickActions } from '../quick-actions'
import { seedSelectionActions } from '../selection-actions'

export function seedDatabaseDefaults(): void {
  seedDefaultAssistant()
  seedAssistantTemplates()
  seedModelDefinitions()
  seedModelGroups()
  seedDefaultProviders()
  seedQuickActions()
  seedSelectionActions()
}
