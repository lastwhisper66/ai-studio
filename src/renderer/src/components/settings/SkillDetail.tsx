import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Trash2 } from 'lucide-react'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Switch } from '@renderer/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useSkillStore } from '@renderer/stores/skillStore'
import { useProviderStore } from '@renderer/stores/providerStore'
import { useMcpStore } from '@renderer/stores/mcpStore'

export function SkillDetail(): React.JSX.Element {
  const { t } = useTranslation()
  const { skills, selectedSkillId, updateSkill, deleteSkill } = useSkillStore()
  const providers = useProviderStore((s) => s.providers)
  const models = useProviderStore((s) => s.models)
  const mcpServers = useMcpStore((s) => s.servers)

  const skill = useMemo(
    () => skills.find((s) => s.id === selectedSkillId),
    [skills, selectedSkillId],
  )

  const providerModels = useMemo(() => {
    if (!skill?.providerId) return []
    return models.filter((m) => m.providerId === skill.providerId)
  }, [models, skill?.providerId])

  if (!skill) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>{t('settings.skill.selectServer')}</p>
      </div>
    )
  }

  const handleBlur = (field: string, value: string): void => {
    const current = skill[field as keyof typeof skill]
    if (value !== current) {
      updateSkill(skill.id, { [field]: value })
    }
  }

  const handleServerToggle = (serverId: string, checked: boolean): void => {
    const current = skill.toolServerIds
    const next = checked ? [...current, serverId] : current.filter((id) => id !== serverId)
    updateSkill(skill.id, { toolServerIds: next })
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{skill.name}</h2>
              {skill.description && (
                <p className="text-sm text-muted-foreground">{skill.description}</p>
              )}
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('settings.skill.deleteConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('settings.skill.deleteConfirmDesc', { name: skill.name })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteSkill(skill.id)}>
                  {t('common.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>{t('settings.skill.skillName')}</Label>
            <Input
              defaultValue={skill.name}
              key={skill.id + '-name'}
              onBlur={(e) => handleBlur('name', e.target.value)}
              placeholder={t('settings.skill.skillNamePlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('settings.skill.description')}</Label>
            <Input
              defaultValue={skill.description}
              key={skill.id + '-desc'}
              onBlur={(e) => handleBlur('description', e.target.value)}
              placeholder={t('settings.skill.descriptionPlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('settings.skill.icon')}</Label>
            <Input
              defaultValue={skill.icon}
              key={skill.id + '-icon'}
              onBlur={(e) => handleBlur('icon', e.target.value)}
              placeholder={t('settings.skill.iconPlaceholder')}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t('settings.skill.systemPrompt')}</Label>
            <Textarea
              defaultValue={skill.systemPrompt}
              key={skill.id + '-prompt'}
              onBlur={(e) => handleBlur('systemPrompt', e.target.value)}
              placeholder={t('settings.skill.systemPromptPlaceholder')}
              rows={5}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>{t('settings.skill.provider')}</Label>
            <Select
              value={skill.providerId ?? ''}
              onValueChange={(v) => updateSkill(skill.id, { providerId: v || null, model: '' })}>
              <SelectTrigger>
                <SelectValue placeholder={t('settings.skill.selectProvider')} />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {skill.providerId && (
            <div className="grid gap-2">
              <Label>{t('settings.skill.model')}</Label>
              <Select
                value={skill.model}
                onValueChange={(v) => updateSkill(skill.id, { model: v })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.skill.selectModel')} />
                </SelectTrigger>
                <SelectContent>
                  {providerModels.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            {t('settings.skill.toolServers')} ({skill.toolServerIds.length})
          </h3>
          {mcpServers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.skill.noToolServers')}</p>
          ) : (
            <div className="space-y-1">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{server.name}</p>
                    <p className="text-xs text-muted-foreground">{server.type}</p>
                  </div>
                  <Switch
                    checked={skill.toolServerIds.includes(server.id)}
                    onCheckedChange={(checked) => handleServerToggle(server.id, checked)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
