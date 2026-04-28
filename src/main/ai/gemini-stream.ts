import { GoogleGenAI } from '@google/genai'
import type { StreamChatOptions, StreamCallbacks, ToolCallFromProvider } from './stream-chat'

/** Stream chat using Google Gemini native SDK. */
export async function streamGeminiChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal, tools } = options

  const ai = new GoogleGenAI({
    apiKey: settings.apiKey,
    ...(settings.baseUrl ? { httpOptions: { baseUrl: settings.baseUrl } } : {}),
  })

  // Extract system instruction from messages (first system message)
  let systemInstruction: string | undefined
  const chatMessages: { role: 'user' | 'model'; text: string }[] = []

  for (const msg of messages) {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    if (msg.role === 'system') {
      systemInstruction = content
    } else if (msg.role === 'user') {
      chatMessages.push({ role: 'user', text: content })
    } else if (msg.role === 'assistant') {
      chatMessages.push({ role: 'model', text: content })
    }
  }

  // Build contents in Gemini format
  const contents = chatMessages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }))

  // Convert OpenAI function tools to Gemini format
  const geminiTools =
    tools && tools.length > 0
      ? [
          {
            functionDeclarations: tools.map((t) => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            })),
          },
        ]
      : undefined

  const response = await ai.models.generateContentStream({
    model: settings.model,
    contents,
    config: {
      abortSignal: signal,
      systemInstruction: systemInstruction || undefined,
      ...(settings.temperature !== undefined ? { temperature: settings.temperature } : {}),
      ...(settings.maxCompletionTokens !== undefined
        ? { maxOutputTokens: settings.maxCompletionTokens }
        : {}),
      ...(settings.topP !== undefined ? { topP: settings.topP } : {}),
    },
    ...(geminiTools ? { tools: geminiTools } : {}),
  })

  const pendingFunctionCalls: ToolCallFromProvider[] = []

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts
    if (parts) {
      for (const part of parts) {
        if (part.text) {
          callbacks.onChunk(part.text, (part as Record<string, unknown>).thought === true)
        }
        if (part.functionCall) {
          pendingFunctionCalls.push({
            id: `gemini-${Date.now()}-${pendingFunctionCalls.length}`,
            functionName: part.functionCall.name || '',
            arguments: JSON.stringify(part.functionCall.args || {}),
          })
        }
      }
    }
  }

  if (pendingFunctionCalls.length > 0) {
    callbacks.onToolCalls?.(pendingFunctionCalls)
    return
  }

  callbacks.onEnd?.()
}
