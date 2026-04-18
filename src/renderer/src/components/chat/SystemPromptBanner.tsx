import { useTranslation } from 'react-i18next'

interface SystemPromptBannerProps {
  systemPrompt?: string
  onClick: () => void
}

export function SystemPromptBanner({
  systemPrompt,
  onClick,
}: SystemPromptBannerProps): React.JSX.Element {
  const { t } = useTranslation()
  const hasPrompt = !!systemPrompt?.trim()

  return (
    <button
      className="mb-4 flex w-full items-start rounded-lg border bg-muted/30 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-muted/60"
      onClick={onClick}>
      <div className="min-w-0 flex-1">
        {hasPrompt ? (
          <p className="line-clamp-2 break-all text-sm text-muted-foreground">{systemPrompt}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground/60">
            {t('chat.systemPromptPlaceholder')}
          </p>
        )}
      </div>
    </button>
  )
}
