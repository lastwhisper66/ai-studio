import { useState, useRef, useEffect } from 'react'
import type { TestConnectionPayload } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import type { SettingsFormState } from './types'

interface ConnectionTestProps {
  formState: SettingsFormState
}

export function ConnectionTest({ formState }: ConnectionTestProps): React.JSX.Element {
  const [isTesting, setIsTesting] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleTest = async (): Promise<void> => {
    setIsTesting(true)
    setResult(null)

    const payload: TestConnectionPayload = {
      provider: formState.provider,
      apiKey: formState.apiKey,
      baseUrl: formState.baseUrl || undefined,
      endpoint: formState.endpoint || undefined,
      apiVersion: formState.apiVersion || undefined,
      deploymentName: formState.deploymentName || undefined,
      model: formState.model,
    }

    try {
      const res = await window.api.testConnection(payload)
      if (!mountedRef.current) return
      if (res.success) {
        setResult({ success: true, message: res.data || 'Connection successful!' })
      } else {
        setResult({ success: false, message: res.error || 'Connection failed' })
      }
    } catch (e) {
      if (!mountedRef.current) return
      setResult({ success: false, message: (e as Error).message })
    } finally {
      if (mountedRef.current) setIsTesting(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={isTesting || !formState.apiKey || !formState.model}>
        {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Test Connection
      </Button>
      {result && (
        <div
          className={`flex items-center gap-1.5 text-sm ${result.success ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
          {result.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <span className="max-w-[300px] truncate">{result.message}</span>
        </div>
      )}
    </div>
  )
}
