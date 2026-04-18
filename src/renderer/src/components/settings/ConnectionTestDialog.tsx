import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, PlayCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import type { Provider, ProviderConnectionTestPayload } from '@shared/types'

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface ModelTestState {
  status: TestStatus
  message?: string
}

interface ConnectionTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: Provider
  models: { id: string; name: string }[]
}

const STATUS_STYLE: Record<TestStatus, string> = {
  idle: 'text-muted-foreground',
  testing: 'text-blue-500',
  success: 'text-green-600 dark:text-green-400',
  error: 'text-destructive',
}

export function ConnectionTestDialog({
  open,
  onOpenChange,
  provider,
  models,
}: ConnectionTestDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [testStates, setTestStates] = useState<Record<string, ModelTestState>>({})
  const [isTestingAll, setIsTestingAll] = useState(false)

  const updateModelState = useCallback((modelId: string, state: ModelTestState) => {
    setTestStates((prev) => ({ ...prev, [modelId]: state }))
  }, [])

  const testModel = useCallback(
    async (modelName: string, modelId: string) => {
      updateModelState(modelId, { status: 'testing' })
      try {
        const payload: ProviderConnectionTestPayload = {
          type: provider.type,
          apiKey: provider.apiKey,
          baseUrl: provider.baseUrl,
          modelName,
        }
        const res = await window.api.testProviderConnection(payload)
        if (res.success) {
          updateModelState(modelId, {
            status: 'success',
            message: res.data || t('settings.provider.connectionSuccess'),
          })
        } else {
          updateModelState(modelId, {
            status: 'error',
            message: res.error
              ? t(res.error.code, res.error.params ?? {})
              : t('settings.provider.connectionFailed'),
          })
        }
      } catch (e) {
        updateModelState(modelId, {
          status: 'error',
          message: (e as Error).message,
        })
      }
    },
    [provider, updateModelState, t],
  )

  const testAll = useCallback(async () => {
    setIsTestingAll(true)
    const promises = models.map((m) => testModel(m.name, m.id))
    await Promise.allSettled(promises)
    setIsTestingAll(false)
  }, [models, testModel])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTestStates({})
        setIsTestingAll(false)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )

  const STATUS_KEY: Record<TestStatus, string> = {
    idle: 'settings.provider.statusIdle',
    testing: 'settings.provider.statusTesting',
    success: 'settings.provider.statusSuccess',
    error: 'settings.provider.statusError',
  }

  // Summary counts
  const counts = models.reduce(
    (acc, m) => {
      const s = testStates[m.id]?.status || 'idle'
      acc[s] = (acc[s] || 0) + 1
      return acc
    },
    {} as Record<TestStatus, number>,
  )
  const hasResults = (counts.success || 0) + (counts.error || 0) > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.provider.testConnection')}</DialogTitle>
        </DialogHeader>

        {models.length === 0 ? (
          <div className="text-muted-foreground py-6 text-center text-sm">
            {t('settings.provider.noModels')}
          </div>
        ) : (
          <>
            {/* Test All button */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={testAll} disabled={isTestingAll} className="gap-1.5">
                {isTestingAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="h-3.5 w-3.5" />
                )}
                {isTestingAll ? t('settings.provider.testing') : t('settings.provider.testAll')}
              </Button>
              {hasResults && (
                <span className="text-muted-foreground text-xs">
                  {counts.success || 0} {t('settings.provider.passed')} / {counts.error || 0}{' '}
                  {t('settings.provider.failed')}
                </span>
              )}
            </div>

            {/* Model list */}
            <ScrollArea className="max-h-[360px]">
              <div className="space-y-0.5">
                {models.map((model) => {
                  const state = testStates[model.id] || { status: 'idle' as TestStatus }
                  const isTesting = state.status === 'testing'
                  return (
                    <div
                      key={model.id}
                      className="flex items-center gap-2.5 rounded-md px-2 py-2 hover:bg-accent/30">
                      <span className="min-w-0 flex-1 truncate text-sm">{model.name}</span>
                      {/* Status text label */}
                      {state.status === 'error' && state.message ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`shrink-0 cursor-help text-xs ${STATUS_STYLE[state.status]}`}>
                              {t(STATUS_KEY[state.status])}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-60 break-words text-xs">
                            {state.message}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className={`shrink-0 text-xs ${STATUS_STYLE[state.status]}`}>
                          {isTesting && (
                            <Loader2 className="mr-1 inline h-3 w-3 animate-spin align-text-bottom" />
                          )}
                          {t(STATUS_KEY[state.status])}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-xs"
                        disabled={isTesting}
                        onClick={() => testModel(model.name, model.id)}>
                        {t('settings.provider.test')}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
