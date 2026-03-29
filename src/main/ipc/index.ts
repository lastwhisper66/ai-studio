import { registerConversationHandlers } from './conversation-handlers'
import { registerMessageHandlers } from './message-handlers'
import { registerSettingsHandlers } from './settings-handlers'
import { registerChatHandlers } from './chat-handlers'
import { registerProviderHandlers } from './provider-handlers'
import { registerModelHandlers } from './model-handlers'
import { registerModelDefinitionHandlers } from './model-definition-handlers'
import { registerAssistantHandlers } from './assistant-handlers'
import { registerWindowHandlers } from './window-handlers'
import { registerTranslateHandlers } from './translate-handlers'
import { registerPhraseHandlers } from './phrase-handlers'
import { registerFileHandlers } from './file-handlers'
import { registerTranslationHistoryHandlers } from './translation-history-handlers'

export function registerAllIpcHandlers(): void {
  registerConversationHandlers()
  registerMessageHandlers()
  registerSettingsHandlers()
  registerChatHandlers()
  registerProviderHandlers()
  registerModelHandlers()
  registerModelDefinitionHandlers()
  registerAssistantHandlers()
  registerWindowHandlers()
  registerTranslateHandlers()
  registerPhraseHandlers()
  registerFileHandlers()
  registerTranslationHistoryHandlers()
}
