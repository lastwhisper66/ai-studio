import { useState } from 'react'
import type { WebSearchProviderType, WebSearchTestPayload } from '@shared/types'
import { useLocalizedError } from '@renderer/hooks/useLocalizedError'

export type TestState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; count: number }
  | { kind: 'err'; message: string }

export interface TestCredentials {
  apiKey?: string
  searxngUrl?: string
  searxngAuthUser?: string
  searxngAuthPass?: string
}

export function useWebSearchTestConnection(provider: WebSearchProviderType): {
  state: TestState
  run: (creds: TestCredentials) => Promise<void>
  reset: () => void
} {
  const [state, setState] = useState<TestState>({ kind: 'idle' })
  const resolveError = useLocalizedError()

  const run = async (creds: TestCredentials): Promise<void> => {
    setState({ kind: 'busy' })
    const payload: WebSearchTestPayload = {
      provider,
      apiKey: creds.apiKey,
      searxngUrl: creds.searxngUrl,
      searxngAuthUser: creds.searxngAuthUser,
      searxngAuthPass: creds.searxngAuthPass,
    }
    const result = await window.api.testWebSearchConnection(payload)
    if (result.success && result.data) {
      setState({ kind: 'ok', count: result.data.resultCount })
    } else {
      setState({
        kind: 'err',
        message: resolveError(result.error) || 'unknown',
      })
    }
  }

  const reset = (): void => setState({ kind: 'idle' })

  return { state, run, reset }
}
