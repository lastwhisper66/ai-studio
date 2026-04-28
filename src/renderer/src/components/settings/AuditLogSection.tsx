import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Badge } from '@renderer/components/ui/badge'
import { Trash2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { useAuditLogStore } from '@renderer/stores/auditLogStore'
import { cn } from '@renderer/lib/utils'

export function AuditLogSection(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    entries,
    total,
    filter,
    isLoaded,
    expandedEntryId,
    loadEntries,
    setFilter,
    clearLog,
    setExpandedEntryId,
  } = useAuditLogStore()

  useEffect(() => {
    if (!isLoaded) loadEntries()
  }, [isLoaded, loadEntries])

  const statusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/15 text-green-700 dark:text-green-400'
      case 'error':
        return 'bg-red-500/15 text-red-700 dark:text-red-400'
      case 'rejected':
        return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400'
      default:
        return ''
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <div className="flex items-center gap-3">
          <Input
            placeholder={t('auditLog.filterToolName')}
            value={filter.toolName ?? ''}
            onChange={(e) => setFilter({ toolName: e.target.value || undefined, offset: 0 })}
            className="h-8 w-40"
          />
          <Select
            value={filter.status ?? 'all'}
            onValueChange={(v) => setFilter({ status: v === 'all' ? undefined : v, offset: 0 })}>
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('auditLog.allStatuses')}</SelectItem>
              <SelectItem value="completed">{t('auditLog.completed')}</SelectItem>
              <SelectItem value="error">{t('auditLog.error')}</SelectItem>
              <SelectItem value="rejected">{t('auditLog.rejected')}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-xs">
            {t('auditLog.totalEntries', { count: total })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => loadEntries()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => clearLog()} className="text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="divide-y">
          {entries.map((entry) => {
            const isExpanded = expandedEntryId === entry.id
            return (
              <div key={entry.id} className="px-6">
                <button
                  className="flex w-full items-center gap-3 py-2.5 text-left text-sm"
                  onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}>
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="font-mono text-xs">{entry.toolName}</span>
                  <Badge
                    variant="secondary"
                    className={cn('text-[10px]', statusColor(entry.status))}>
                    {entry.status}
                  </Badge>
                  {entry.durationMs != null && (
                    <span className="text-muted-foreground text-xs">{entry.durationMs}ms</span>
                  )}
                  <span className="text-muted-foreground ml-auto text-xs">
                    {entry.serverName || entry.serverId}
                  </span>
                  <span className="text-muted-foreground text-xs">{entry.createdAt}</span>
                </button>
                {isExpanded && (
                  <div className="mb-3 ml-7 space-y-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">{t('auditLog.arguments')}:</span>
                      <pre className="bg-muted mt-1 max-h-40 overflow-auto rounded p-2">
                        {JSON.stringify(entry.arguments, null, 2)}
                      </pre>
                    </div>
                    {entry.result && (
                      <div>
                        <span className="text-muted-foreground">{t('auditLog.result')}:</span>
                        <pre className="bg-muted mt-1 max-h-40 overflow-auto rounded p-2">
                          {JSON.stringify(entry.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="text-muted-foreground flex gap-4">
                      <span>Round: {entry.roundIndex}</span>
                      <span>Conversation: {entry.conversationId.slice(0, 8)}...</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {entries.length === 0 && isLoaded && (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {t('auditLog.empty')}
            </div>
          )}
        </div>

        {total > (filter.limit ?? 50) && (
          <div className="flex justify-center gap-2 py-4">
            <Button
              variant="outline"
              size="sm"
              disabled={(filter.offset ?? 0) === 0}
              onClick={() =>
                setFilter({ offset: Math.max(0, (filter.offset ?? 0) - (filter.limit ?? 50)) })
              }>
              {t('auditLog.prev')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(filter.offset ?? 0) + (filter.limit ?? 50) >= total}
              onClick={() => setFilter({ offset: (filter.offset ?? 0) + (filter.limit ?? 50) })}>
              {t('auditLog.next')}
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
