import { createOpenAIClient } from './openai-client'
import type { StreamChatOptions, StreamCallbacks, ToolCallFromProvider } from './stream-chat'

/** Stream chat using OpenAI Responses API (client.responses.create). */
export async function streamOpenAIResponse(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal, tools } = options
  const client = createOpenAIClient(settings)

  // Convert ChatCompletionMessageParam[] to Responses API input format
  const input = messages.map((msg) => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
  }))

  // Convert tools to Responses API format
  const responseTools = tools?.map((t) => ({
    type: 'function' as const,
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
    strict: false,
  }))

  const stream = await client.responses.create(
    {
      model: settings.model,
      input,
      stream: true,
      ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
      ...(settings.topP !== undefined ? { top_p: settings.topP } : {}),
      ...(settings.maxCompletionTokens !== undefined
        ? { max_output_tokens: settings.maxCompletionTokens }
        : {}),
      ...(responseTools && responseTools.length > 0 ? { tools: responseTools } : {}),
    },
    { signal },
  )

  const pendingFunctionCalls = new Map<
    string,
    { id: string; name: string; args: string; callId: string }
  >()

  for await (const event of stream) {
    if (
      event.type === 'response.output_text.delta' &&
      'delta' in event &&
      typeof event.delta === 'string'
    ) {
      callbacks.onChunk(event.delta)
    }

    const eventType = (event as { type: string }).type
    if (eventType === 'response.reasoning.delta') {
      const delta = (event as { delta?: string }).delta
      if (typeof delta === 'string') {
        callbacks.onChunk(delta, true)
      }
    }

    if (eventType === 'response.function_call_arguments.delta') {
      const e = event as { item_id?: string; delta?: string }
      if (e.item_id && e.delta) {
        const existing = pendingFunctionCalls.get(e.item_id)
        if (existing) {
          existing.args += e.delta
        }
      }
    }

    if (eventType === 'response.output_item.added') {
      const e = event as { item?: { id?: string; type?: string; name?: string; call_id?: string } }
      if (e.item?.type === 'function_call' && e.item.id) {
        pendingFunctionCalls.set(e.item.id, {
          id: e.item.id,
          name: e.item.name || '',
          args: '',
          callId: e.item.call_id || e.item.id,
        })
      }
    }

    if (eventType === 'response.completed') {
      if (pendingFunctionCalls.size > 0) {
        const toolCalls: ToolCallFromProvider[] = [...pendingFunctionCalls.values()].map((tc) => ({
          id: tc.callId,
          functionName: tc.name,
          arguments: tc.args,
        }))
        callbacks.onToolCalls?.(toolCalls)
        return
      }
    }
  }

  callbacks.onEnd?.()
}
