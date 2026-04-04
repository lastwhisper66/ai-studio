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
      temperature: settings.temperature,
      maxOutputTokens: settings.maxCompletionTokens,
      topP: settings.topP,
    },
  })

  for await (const chunk of response) {
    const text = chunk.text
    if (text) {
      callbacks.onChunk(text)
    }
  }

  callbacks.onEnd?.()
}
