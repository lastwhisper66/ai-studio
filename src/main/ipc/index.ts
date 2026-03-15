import { registerConversationHandlers } from './conversation-handlers'
import { registerMessageHandlers } from './message-handlers'
import { registerSettingsHandlers } from './settings-handlers'
import { registerChatHandlers } from './chat-handlers'
import { registerProviderHandlers } from './provider-handlers'
import { registerAssistantHandlers } from './assistant-handlers'
import { registerWindowHandlers } from './window-handlers'

export function registerAllIpcHandlers(): void {
  registerConversationHandlers()
  registerMessageHandlers()
  registerSettingsHandlers()
  registerChatHandlers()
  registerProviderHandlers()
  registerAssistantHandlers()
  registerWindowHandlers()
}
