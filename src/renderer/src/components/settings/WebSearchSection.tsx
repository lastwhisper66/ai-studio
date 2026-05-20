import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Switch } from '@renderer/components/ui/switch'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import type { WebSearchProviderType, WebSearchTestPayload } from '@shared/types'

type TestState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'ok'; count: number }
  | { kind: 'err'; message: string }

export function WebSearchSection(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const setSetting = (key: string, value: string): void => {
    void saveSettings({ [key]: value })
  }

  const provider = (settings['webSearch.provider'] ?? 'tavily') as WebSearchProviderType
  const maxResults = parseInt(settings['webSearch.maxResults'] ?? '5', 10) || 5
  const rewriteQuery = (settings['webSearch.rewriteQuery'] ?? 'true') === 'true'
  const timeoutSec = Math.round(
    (parseInt(settings['webSearch.timeoutMs'] ?? '15000', 10) || 15000) / 1000,
  )
  const tavilyKey = settings['webSearch.tavilyApiKey'] ?? ''
  const braveKey = settings['webSearch.braveApiKey'] ?? ''
  const exaKey = settings['webSearch.exaApiKey'] ?? ''
  const searxngUrl = settings['webSearch.searxngUrl'] ?? ''
  const searxngUser = settings['webSearch.searxngUsername'] ?? ''
  const searxngPw = settings['webSearch.searxngApiKey'] ?? ''

  const [testState, setTestState] = useState<TestState>({ kind: 'idle' })

  const handleTest = async (): Promise<void> => {
    setTestState({ kind: 'busy' })
    const payload: WebSearchTestPayload = {
      provider,
      apiKey:
        provider === 'tavily'
          ? tavilyKey
          : provider === 'brave'
            ? braveKey
            : provider === 'exa'
              ? exaKey
              : undefined,
      searxngUrl: provider === 'searxng' ? searxngUrl : undefined,
      searxngAuthUser: provider === 'searxng' ? searxngUser : undefined,
      searxngAuthPass: provider === 'searxng' ? searxngPw : undefined,
    }
    const result = await window.api.testWebSearchConnection(payload)
    if (result.success && result.data) {
      setTestState({ kind: 'ok', count: result.data.resultCount })
    } else {
      setTestState({
        kind: 'err',
        message: result.error?.message ?? result.error?.code ?? 'unknown',
      })
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h2 className="text-lg font-semibold">{t('settings.webSearch.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.webSearch.description')}</p>
      </header>

      {/* Provider selector */}
      <div className="space-y-2">
        <Label>{t('settings.webSearch.provider')}</Label>
        <Select value={provider} onValueChange={(v) => setSetting('webSearch.provider', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tavily">Tavily</SelectItem>
            <SelectItem value="brave">Brave Search</SelectItem>
            <SelectItem value="searxng">SearXNG</SelectItem>
            <SelectItem value="exa">Exa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Per-provider credentials */}
      {provider === 'tavily' && (
        <div className="space-y-2">
          <Label>{t('settings.webSearch.apiKey')}</Label>
          <Input
            type="password"
            value={tavilyKey}
            onChange={(e) => setSetting('webSearch.tavilyApiKey', e.target.value)}
            placeholder="tvly-..."
          />
          <p className="text-xs text-muted-foreground">
            <a
              href="https://tavily.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline">
              tavily.com
            </a>
          </p>
        </div>
      )}
      {provider === 'brave' && (
        <div className="space-y-2">
          <Label>{t('settings.webSearch.apiKey')}</Label>
          <Input
            type="password"
            value={braveKey}
            onChange={(e) => setSetting('webSearch.braveApiKey', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            <a
              href="https://brave.com/search/api/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline">
              brave.com/search/api
            </a>
          </p>
        </div>
      )}
      {provider === 'exa' && (
        <div className="space-y-2">
          <Label>{t('settings.webSearch.apiKey')}</Label>
          <Input
            type="password"
            value={exaKey}
            onChange={(e) => setSetting('webSearch.exaApiKey', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            <a
              href="https://exa.ai/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline">
              exa.ai
            </a>
          </p>
        </div>
      )}
      {provider === 'searxng' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{t('settings.webSearch.searxngUrl')}</Label>
            <Input
              value={searxngUrl}
              onChange={(e) => setSetting('webSearch.searxngUrl', e.target.value)}
              placeholder="https://searxng.example.com"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.webSearch.username')}</Label>
            <Input
              value={searxngUser}
              onChange={(e) => setSetting('webSearch.searxngUsername', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.webSearch.password')}</Label>
            <Input
              type="password"
              value={searxngPw}
              onChange={(e) => setSetting('webSearch.searxngApiKey', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Test connection */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={handleTest} disabled={testState.kind === 'busy'}>
          {testState.kind === 'busy'
            ? t('settings.webSearch.testing')
            : t('settings.webSearch.test')}
        </Button>
        {testState.kind === 'ok' && (
          <span className="text-sm text-green-600">
            {t('settings.webSearch.testOk', { count: testState.count })}
          </span>
        )}
        {testState.kind === 'err' && (
          <span className="text-sm text-destructive">
            {t('settings.webSearch.testFailed')}: {testState.message}
          </span>
        )}
      </div>

      {/* Parameters */}
      <div className="space-y-2">
        <Label>{t('settings.webSearch.maxResults')}</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={maxResults}
          onChange={(e) => {
            const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 5))
            setSetting('webSearch.maxResults', String(v))
          }}
          className="w-24"
        />
      </div>
      <div className="space-y-2">
        <Label>{t('settings.webSearch.timeoutSec')}</Label>
        <Input
          type="number"
          min={3}
          max={60}
          value={timeoutSec}
          onChange={(e) => {
            const v = Math.max(3, Math.min(60, parseInt(e.target.value, 10) || 15))
            setSetting('webSearch.timeoutMs', String(v * 1000))
          }}
          className="w-24"
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">{t('settings.webSearch.rewriteQuery')}</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('settings.webSearch.rewriteQueryHint')}
          </p>
        </div>
        <Switch
          checked={rewriteQuery}
          onCheckedChange={(v) => setSetting('webSearch.rewriteQuery', v ? 'true' : 'false')}
        />
      </div>
    </div>
  )
}
