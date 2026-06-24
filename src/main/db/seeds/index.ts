import { seedDefaultAssistant } from '../assistants'
import { seedAssistantTemplates } from '../templates'
import { seedDefaultProviders } from '../providers'
import { seedQuickActions } from '../quick-actions'
import { seedSelectionActions } from '../selection-actions'

export function seedDatabaseDefaults(): void {
  seedDefaultAssistant()
  seedAssistantTemplates()
  seedDefaultProviders()
  seedQuickActions()
  seedSelectionActions()
}
