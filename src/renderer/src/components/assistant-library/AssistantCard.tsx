import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, MoreVertical, Star, AlertTriangle, Trash2 } from 'lucide-react'
import type { Assistant } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useSeedTranslator } from '@renderer/hooks/useSeedTranslator'
import { useProviderStore } from '@renderer/stores/providerStore'
import { AgentCardChassis } from './AgentCardChassis'

interface AssistantCardProps {
  assistant: Assistant
  onGoToChat: (assistantId: string) => void
  onEdit: (assistant: Assistant) => void
  onDuplicate: (assistant: Assistant) => void
  onSaveAsTemplate: (assistant: Assistant) => void
  onSetDefault: (assistant: Assistant) => void
  onDelete: (assistant: Assistant) => void
}

export function AssistantCard({
  assistant,
  onGoToChat,
  onEdit,
  onDuplicate,
  onSaveAsTemplate,
  onSetDefault,
  onDelete,
}: AssistantCardProps): React.JSX.Element {
  const { t } = useTranslation()
  const st = useSeedTranslator()
  const providers = useProviderStore((s) => s.providers)

  const providerName = useMemo(() => {
    if (!assistant.providerId) return null
    return providers.find((p) => p.id === assistant.providerId)?.name ?? null
  }, [providers, assistant.providerId])

  const needsConfig = !assistant.providerId || !assistant.model

  const primaryAction = (
    <Button
      size="sm"
      className="w-full justify-between"
      variant={needsConfig ? 'outline' : 'default'}
      onClick={() => (needsConfig ? onEdit(assistant) : onGoToChat(assistant.id))}>
      <span>
        {needsConfig ? t('library.warning.needsConfiguration') : t('library.card.goToChat')}
      </span>
      <ArrowRight className="h-3.5 w-3.5" />
    </Button>
  )

  const overflowMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(assistant)}>
          {t('library.card.editTemplate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(assistant)}>
          {t('library.card.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSaveAsTemplate(assistant)}>
          {t('library.card.saveAsTemplate')}
        </DropdownMenuItem>
        {!assistant.isDefault && (
          <DropdownMenuItem onClick={() => onSetDefault(assistant)}>
            {t('library.card.setAsDefault')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={assistant.isDefault}
          onClick={() => !assistant.isDefault && onDelete(assistant)}>
          <Trash2 className="h-3.5 w-3.5" />
          {t('library.card.delete')}
          {assistant.isDefault && (
            <span className="ml-1 text-[10px] opacity-60">
              ({t('library.card.cannotDeleteDefault')})
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <AgentCardChassis
      icon={assistant.icon}
      name={st(assistant.name)}
      topRightBadge={
        <div className="flex items-center gap-1">
          {assistant.isDefault && <Star className="h-3.5 w-3.5 fill-current text-amber-500" />}
          {assistant.group && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {assistant.group}
            </Badge>
          )}
        </div>
      }
      description={st(assistant.description)}
      metaSlot={
        needsConfig ? (
          <Badge variant="destructive" className="gap-1 text-[10px]">
            <AlertTriangle className="h-3 w-3" />
            {t('library.warning.needsConfiguration')}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            {providerName ?? '?'} · {assistant.model}
          </Badge>
        )
      }
      primaryAction={primaryAction}
      secondaryAction={overflowMenu}
    />
  )
}
