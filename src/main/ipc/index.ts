import { registerConversationHandlers } from './conversation-handlers'
import { registerMessageHandlers } from './message-handlers'
import { registerSettingsHandlers } from './settings-handlers'
import { registerChatHandlers } from './chat-handlers'
import { registerProviderHandlers } from './provider-handlers'
import { registerModelHandlers } from './model-handlers'
import { registerModelDefinitionHandlers } from './model-definition-handlers'
import { registerModelGroupHandlers } from './model-group-handlers'
import { registerAssistantHandlers } from './assistant-handlers'
import { registerAssistantTemplateHandlers } from './assistant-template-handlers'
import { registerWindowHandlers } from './window-handlers'
import { registerTranslateHandlers } from './translate-handlers'
import { registerPhraseHandlers } from './phrase-handlers'
import { registerFileHandlers } from './file-handlers'
import { registerTranslationHistoryHandlers } from './translation-history-handlers'
import { registerAppHandlers } from './app-handlers'
import { registerQuickActionHandlers } from './quick-action-handlers'
import { registerQuickAssistantHandlers } from './quick-assistant-handlers'
import { registerSelectionActionHandlers } from './selection-action-handlers'
import { registerSelectionHandlers } from './selection-handlers'
import { registerUserHandlers } from './user-handlers'
import { registerUpdaterHandlers } from './updater-handlers'
import { registerBackupHandlers } from './backup-handlers'
import { registerBuiltinsHandlers } from './builtins-handlers'
import { registerWebSearchHandlers } from './web-search-handlers'
import { installDirtyTracker } from '../backup/dirty-tracker'

export function registerAllIpcHandlers(): void {
  // Must run BEFORE any registerXxxHandlers() so the wrapper sees them all.
  installDirtyTracker()
  registerConversationHandlers()
  registerMessageHandlers()
  registerSettingsHandlers()
  registerBuiltinsHandlers()
  registerChatHandlers()
  registerWebSearchHandlers()
  registerProviderHandlers()
  registerModelHandlers()
  registerModelDefinitionHandlers()
  registerModelGroupHandlers()
  registerAssistantHandlers()
  registerAssistantTemplateHandlers()
  registerWindowHandlers()
  registerTranslateHandlers()
  registerPhraseHandlers()
  registerFileHandlers()
  registerTranslationHistoryHandlers()
  registerAppHandlers()
  registerQuickActionHandlers()
  registerQuickAssistantHandlers()
  registerSelectionActionHandlers()
  registerSelectionHandlers()
  registerUserHandlers()
  registerUpdaterHandlers()
  registerBackupHandlers()
}
