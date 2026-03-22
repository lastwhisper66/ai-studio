import { registerConversationHandlers } from './conversation-handlers'
import { registerMessageHandlers } from './message-handlers'
import { registerSettingsHandlers } from './settings-handlers'
import { registerChatHandlers } from './chat-handlers'
import { registerProviderHandlers } from './provider-handlers'
import { registerModelHandlers } from './model-handlers'
import { registerAssistantHandlers } from './assistant-handlers'
import { registerWindowHandlers } from './window-handlers'
import { registerTranslateHandlers } from './translate-handlers'
import { registerPhraseHandlers } from './phrase-handlers'
import { registerFileHandlers } from './file-handlers'

export function registerAllIpcHandlers(): void {
  registerConversationHandlers()
  registerMessageHandlers()
  registerSettingsHandlers()
  registerChatHandlers()
  registerProviderHandlers()
  registerModelHandlers()
  registerAssistantHandlers()
  registerWindowHandlers()
  registerTranslateHandlers()
  registerPhraseHandlers()
  registerFileHandlers()
}
