import type { ApiSettings } from '@shared/types'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { streamOpenAIChat } from './openai-stream'
import { streamOpenAIResponse } from './openai-response-stream'
import { streamGeminiChat } from './gemini-stream'
import { streamClaudeChat } from './claude-stream'

/** Callbacks for streaming chat responses. */
export interface StreamCallbacks {
  onChunk: (delta: string, isReasoning?: boolean) => void
  onEnd?: () => void
}

/** Provider types that use the OpenAI-compatible chat completions API. */
export const OPENAI_COMPATIBLE_TYPES = new Set(['openai', 'azure', 'deepseek', 'silicon', 'newapi'])

export interface StreamChatOptions {
  settings: ApiSettings
  messages: ChatCompletionMessageParam[]
  signal: AbortSignal
  reasoningEffort?: string
}

/**
 * Unified streaming chat function that dispatches to the correct provider SDK.
 * Content accumulation is handled by the caller via onChunk callback.
 */
export async function streamChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings } = options

  if (OPENAI_COMPATIBLE_TYPES.has(settings.provider)) {
    return streamOpenAIChat(options, callbacks)
  }

  switch (settings.provider) {
    case 'openai-response':
      return streamOpenAIResponse(options, callbacks)
    case 'gemini':
      return streamGeminiChat(options, callbacks)
    case 'anthropic':
    case 'claude':
      return streamClaudeChat(options, callbacks)
    default:
      // Fallback: treat unknown providers as OpenAI-compatible (covers legacy 'custom' type)
      return streamOpenAIChat(options, callbacks)
  }
}
