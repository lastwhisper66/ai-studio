import { useMemo } from 'react'
import { Search, Tag, type LucideIcon } from 'lucide-react'
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
  icon: LucideIcon
  nameKey: string
  hintKey: string
  providerSetting: string
  modelSetting: string
}

const TASKS: TaskRow[] = [
  {
    key: 'title',
    icon: Tag,
    nameKey: 'settings.utilityModels.tasks.titleName',
    hintKey: 'settings.utilityModels.tasks.titleHint',
    providerSetting: 'utilityModel.titleProviderId',
    modelSetting: 'utilityModel.titleModelId',
  },
  {
    key: 'searchRewrite',
    icon: Search,
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

  // Only surface providers that actually have an enabled model — selecting a
  // provider with no usable model would leave the model dropdown empty.
  const configuredProviders = useMemo(
    () =>
      providers.filter(
        (p) => p.enabled && allModels.some((m) => m.providerId === p.id && m.enabled),
      ),
    [providers, allModels],
  )

  const handleProviderChange = (task: TaskRow, value: string): void => {
    if (value === '__none__') {
      // "Use assistant model" — clear both slots.
      void saveSettings({ [task.providerSetting]: '', [task.modelSetting]: '' })
      return
    }
    // Auto-select the provider's first enabled model so the model slot isn't
    // left on the empty placeholder.
    const firstModel = allModels.find((m) => m.providerId === value && m.enabled)
    void saveSettings({ [task.providerSetting]: value, [task.modelSetting]: firstModel?.id ?? '' })
  }

  const handleModelChange = (task: TaskRow, value: string): void => {
    void saveSettings({ [task.modelSetting]: value })
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
        const Icon = task.icon

        return (
          <div key={task.key} className="rounded-xl border bg-card/50 p-5">
            <header className="flex items-start gap-2.5">
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold">{t(task.nameKey)}</h3>
                <p className="text-muted-foreground mt-1 text-xs">{t(task.hintKey)}</p>
              </div>
            </header>

            <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('settings.utilityModels.provider')}</Label>
                <Select
                  value={providerId || '__none__'}
                  onValueChange={(v) => handleProviderChange(task, v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {t('settings.utilityModels.useAssistantModel')}
                    </SelectItem>
                    {configuredProviders.map((p) => (
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
                  value={modelId || undefined}
                  disabled={!providerId}
                  onValueChange={(v) => handleModelChange(task, v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('settings.utilityModels.noProvider')} />
                  </SelectTrigger>
                  <SelectContent>
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
