import { useTranslation } from 'react-i18next'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import type { Model } from '@shared/types'

type Task = 'title' | 'searchRewrite'

interface TaskRow {
  key: Task
  nameKey: string
  hintKey: string
  providerSetting: string
  modelSetting: string
}

const TASKS: TaskRow[] = [
  {
    key: 'title',
    nameKey: 'settings.utilityModels.tasks.titleName',
    hintKey: 'settings.utilityModels.tasks.titleHint',
    providerSetting: 'utilityModel.titleProviderId',
    modelSetting: 'utilityModel.titleModelId',
  },
  {
    key: 'searchRewrite',
    nameKey: 'settings.utilityModels.tasks.searchRewriteName',
    hintKey: 'settings.utilityModels.tasks.searchRewriteHint',
    providerSetting: 'utilityModel.searchRewriteProviderId',
    modelSetting: 'utilityModel.searchRewriteModelId',
  },
]

export function UtilityModelsSection(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)
  const providers = useProviderStore((s) => s.providers)
  const allModels = useProviderStore((s) => s.models)

  const handleProviderChange = (task: TaskRow, value: string): void => {
    const next = value === '__none__' ? '' : value
    // Switching provider invalidates the previously chosen model
    void saveSettings({ [task.providerSetting]: next, [task.modelSetting]: '' })
  }

  const handleModelChange = (task: TaskRow, value: string): void => {
    const next = value === '__none__' ? '' : value
    void saveSettings({ [task.modelSetting]: next })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.utilityModels.title')}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t('settings.utilityModels.description')}
        </p>
      </div>

      {TASKS.map((task) => {
        const providerId = settings[task.providerSetting] ?? ''
        const modelId = settings[task.modelSetting] ?? ''
        const providerModels: Model[] = providerId
          ? allModels.filter((m) => m.providerId === providerId && m.enabled)
          : []

        return (
          <div key={task.key} className="rounded-xl border bg-card/50 p-5">
            <header>
              <h3 className="text-sm font-semibold">{t(task.nameKey)}</h3>
              <p className="text-muted-foreground mt-1 text-xs">{t(task.hintKey)}</p>
            </header>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.utilityModels.provider')}</Label>
                <Select
                  value={providerId || '__none__'}
                  onValueChange={(v) => handleProviderChange(task, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t('settings.utilityModels.useAssistantModel')}
                    </SelectItem>
                    {providers
                      .filter((p) => p.enabled)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.utilityModels.model')}</Label>
                <Select
                  value={modelId || '__none__'}
                  disabled={!providerId}
                  onValueChange={(v) => handleModelChange(task, v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t('settings.utilityModels.noProvider')}
                    </SelectItem>
                    {providerModels.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
