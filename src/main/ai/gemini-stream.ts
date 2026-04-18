import { GoogleGenAI } from '@google/genai'
import type { StreamChatOptions, StreamCallbacks } from './stream-chat'

/** Stream chat using Google Gemini native SDK. */
export async function streamGeminiChat(
  options: StreamChatOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { settings, messages, signal } = options

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
  })

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts
    if (parts) {
      for (const part of parts) {
        if (part.text) {
          // Gemini thinking models include a `thought` boolean on reasoning parts;
          // the SDK types don't expose it yet, so we use a type assertion.
          callbacks.onChunk(part.text, (part as Record<string, unknown>).thought === true)
        }
      }
    }
  }

  callbacks.onEnd?.()
}
