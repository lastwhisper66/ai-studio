import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ArrowRight, MoreVertical } from 'lucide-react'
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
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { AgentCardChassis } from './AgentCardChassis'

interface TemplateCardProps {
  template: Assistant
  onAdd: (template: Assistant) => void
  onGoToChat: (assistantId: string) => void
  onEdit: (template: Assistant) => void
  onDuplicate: (template: Assistant) => void
  onExport: (template: Assistant) => void
  onDelete: (template: Assistant) => void
}

export function TemplateCard({
  template,
  onAdd,
  onGoToChat,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
}: TemplateCardProps): React.JSX.Element {
  const { t } = useTranslation()
  const st = useSeedTranslator()
  const assistants = useAssistantStore((s) => s.assistants)

  const derived = useMemo(
    () => assistants.filter((a) => a.kind === 'assistant' && a.sourceTemplateId === template.id),
    [assistants, template.id],
  )

  const sourceLabel =
    template.source === 'builtin'
      ? t('library.card.source.builtin')
      : template.source === 'imported'
        ? t('library.card.source.imported')
        : t('library.card.source.user')

  const primaryAction =
    derived.length === 0 ? (
      <Button size="sm" className="w-full" onClick={() => onAdd(template)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t('library.card.add')}
      </Button>
    ) : (
      <Button
        size="sm"
        variant="secondary"
        className="w-full justify-between"
        onClick={() => onGoToChat(derived[0].id)}>
        <span>{t('library.card.added', { count: derived.length })}</span>
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
        <DropdownMenuItem onClick={() => onEdit(template)}>
          {t('library.card.editTemplate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(template)}>
          {t('library.card.duplicate')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport(template)}>
          {t('library.card.exportJson')}
        </DropdownMenuItem>
        {!template.isBuiltin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(template)}>
              {t('library.card.delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <AgentCardChassis
      icon={template.icon}
      name={st(template.name)}
      topRightBadge={
        template.category ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {t(`library.categories.${template.category}`, { defaultValue: template.category })}
          </Badge>
        ) : undefined
      }
      description={st(template.description)}
      metaSlot={
        <>
          {template.recommendedModel && (
            <Badge variant="secondary" className="text-[10px]">
              {template.recommendedModel}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px]">
            {sourceLabel}
          </Badge>
        </>
      }
      primaryAction={primaryAction}
      secondaryAction={overflowMenu}
    />
  )
}
