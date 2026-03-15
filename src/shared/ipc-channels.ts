export const IpcChannels = {
  // Conversation
  CONVERSATION_LIST: 'conversation:list',
  CONVERSATION_GET: 'conversation:get',
  CONVERSATION_CREATE: 'conversation:create',
  CONVERSATION_UPDATE: 'conversation:update',
  CONVERSATION_DELETE: 'conversation:delete',
  // Message
  MESSAGE_LIST: 'message:list',
  MESSAGE_LIST_PAGINATED: 'message:list-paginated',
  MESSAGE_CREATE: 'message:create',
  MESSAGE_DELETE: 'message:delete',
  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_SET_BATCH: 'settings:set-batch',
  // Provider
  PROVIDER_LIST: 'provider:list',
  PROVIDER_GET: 'provider:get',
  PROVIDER_CREATE: 'provider:create',
  PROVIDER_UPDATE: 'provider:update',
  PROVIDER_DELETE: 'provider:delete',
  PROVIDER_TEST_CONNECTION: 'provider:test-connection',
  // Assistant
  ASSISTANT_LIST: 'assistant:list',
  ASSISTANT_GET: 'assistant:get',
  ASSISTANT_CREATE: 'assistant:create',
  ASSISTANT_UPDATE: 'assistant:update',
  ASSISTANT_DELETE: 'assistant:delete',
  // Chat (streaming)
  CHAT_SEND_MESSAGE: 'chat:send-message',
  CHAT_STREAM_CHUNK: 'chat:stream-chunk',
  CHAT_STREAM_END: 'chat:stream-end',
  CHAT_STREAM_ERROR: 'chat:stream-error',
  CHAT_STOP_GENERATION: 'chat:stop-generation',
  CHAT_TITLE_UPDATED: 'chat:title-updated',
} as const
