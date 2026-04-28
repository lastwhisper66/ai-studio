import Anthropic from '@anthropic-ai/sdk'
import type { StreamChatOptions, StreamCallbacks, ToolCallFromProvider } from './stream-chat'

/** Stream chat using Anthropic Claude native SDK. */
export async function streamClaudeChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal, tools } = options

  const client = new Anthropic({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl || undefined,
  })

  // Extract system prompt from messages (first system message)
  let systemPrompt: string | undefined
  const claudeMessages: Anthropic.MessageParam[] = []

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    if (msg.role === 'system') {
      systemPrompt = content
    } else if (msg.role === 'user') {
      claudeMessages.push({ role: 'user', content })
    } else if (msg.role === 'assistant') {
      claudeMessages.push({ role: 'assistant', content })
    }
  }

  // Convert OpenAI function tools to Anthropic tool format
  const anthropicTools: Anthropic.Tool[] | undefined =
    tools && tools.length > 0
      ? tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
        }))
      : undefined

  const stream = client.messages.stream(
    {
      model: settings.model,
      max_tokens: settings.maxCompletionTokens ?? 4096,
      messages: claudeMessages,
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
      ...(settings.topP !== undefined ? { top_p: settings.topP } : {}),
      ...(anthropicTools ? { tools: anthropicTools } : {}),
    },
    { signal },
  )

  stream.on('text', (text) => {
    callbacks.onChunk(text)
  })

  stream.on('thinking', (thinking) => {
    callbacks.onChunk(thinking, true)
  })

  const finalMessage = await stream.finalMessage()

  if (finalMessage.stop_reason === 'tool_use') {
    const toolCalls: ToolCallFromProvider[] = finalMessage.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
      .map((block) => ({
        id: block.id,
        functionName: block.name,
        arguments: JSON.stringify(block.input),
      }))
    if (toolCalls.length > 0) {
      callbacks.onToolCalls?.(toolCalls)
      return
    }
  }

  callbacks.onEnd?.()
}
