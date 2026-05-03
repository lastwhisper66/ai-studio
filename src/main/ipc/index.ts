import { registerConversationHandlers } from './conversation-handlers'
import { registerMessageHandlers } from './message-handlers'
import { registerSettingsHandlers } from './settings-handlers'
import { registerChatHandlers } from './chat-handlers'
import { registerProviderHandlers } from './provider-handlers'
import { registerModelHandlers } from './model-handlers'
import { registerModelDefinitionHandlers } from './model-definition-handlers'
import { registerModelGroupHandlers } from './model-group-handlers'
import { registerAssistantHandlers } from './assistant-handlers'
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

export function registerAllIpcHandlers(): void {
  registerConversationHandlers()
  registerMessageHandlers()
  registerSettingsHandlers()
  registerChatHandlers()
  registerProviderHandlers()
  registerModelHandlers()
  registerModelDefinitionHandlers()
  registerModelGroupHandlers()
  registerAssistantHandlers()
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
