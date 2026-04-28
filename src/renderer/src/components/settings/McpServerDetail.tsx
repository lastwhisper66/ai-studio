import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plug, Trash2, RefreshCw, Unplug, Zap, FileText, Eye } from 'lucide-react'
import { Label } from '@renderer/components/ui/label'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { cn } from '@renderer/lib/utils'
import { useMcpStore } from '@renderer/stores/mcpStore'
import type { McpResourceContent } from '@shared/types'

const STATUS_LABELS: Record<string, string> = {
  connected: 'settings.mcp.statusConnected',
  connecting: 'settings.mcp.statusConnecting',
  error: 'settings.mcp.statusError',
  disconnected: 'settings.mcp.statusDisconnected',
}

const STATUS_COLORS: Record<string, string> = {
  connected: 'text-emerald-600 dark:text-emerald-400',
  connecting: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
  disconnected: 'text-muted-foreground',
}

export function McpServerDetail(): React.JSX.Element {
  const { t } = useTranslation()
  const {
    servers,
    tools,
    resources,
    prompts,
    statuses,
    selectedServerId,
    updateServer,
    deleteServer,
    connectServer,
    disconnectServer,
    reconnectServer,
    updateTool,
    loadResources,
    readResource,
    loadPrompts,
    getPrompt,
  } = useMcpStore()

  const server = useMemo(
    () => servers.find((s) => s.id === selectedServerId),
    [servers, selectedServerId],
  )

  const serverTools = useMemo(
    () => tools.filter((t) => t.serverId === selectedServerId),
    [tools, selectedServerId],
  )

  const serverResources = selectedServerId ? (resources.get(selectedServerId) ?? []) : []
  const serverPrompts = selectedServerId ? (prompts.get(selectedServerId) ?? []) : []

  const [resourcePreview, setResourcePreview] = useState<McpResourceContent | null>(null)
  const [promptResult, setPromptResult] = useState<string | null>(null)
  const [promptArgs, setPromptArgs] = useState<Record<string, string>>({})

  const statusInfo = selectedServerId ? statuses.get(selectedServerId) : undefined
  const status = statusInfo?.status ?? 'disconnected'
  const isConnected = status === 'connected'
  const isConnecting = status === 'connecting'

  if (!server) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>{t('settings.mcp.selectServer')}</p>
      </div>
    )
  }

  const handleBlur = (field: string, value: string): void => {
    const current = server[field as keyof typeof server]
    if (value !== current) {
      updateServer(server.id, { [field]: value })
    }
  }

  const handleArgsBlur = (value: string): void => {
    const parsed = value
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0)
    const currentStr = server.args.join(' ')
    if (value.trim() !== currentStr) {
      updateServer(server.id, { args: parsed })
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{server.name}</h2>
              <p className={cn('text-sm', STATUS_COLORS[status])}>
                {t(STATUS_LABELS[status])}
                {statusInfo?.error && <span className="ml-1 text-xs">({statusInfo.error})</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => disconnectServer(server.id)}>
                    <Unplug className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('settings.mcp.disconnect')}</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isConnecting}
                    onClick={() => connectServer(server.id)}>
                    <Zap className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('settings.mcp.connect')}</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isConnecting}
                  onClick={() => reconnectServer(server.id)}>
                  <RefreshCw className={cn('h-4 w-4', isConnecting && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('settings.mcp.reconnect')}</TooltipContent>
            </Tooltip>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('settings.mcp.deleteConfirmTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('settings.mcp.deleteConfirmDesc', {
                      name: server.name,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteServer(server.id)}>
                    {t('common.delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>{t('settings.mcp.serverName')}</Label>
            <Input
              defaultValue={server.name}
              key={server.id + '-name'}
              onBlur={(e) => handleBlur('name', e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label>{t('settings.mcp.serverType')}</Label>
            <Input value={server.type} disabled />
          </div>

          {server.type === 'stdio' ? (
            <>
              <div className="grid gap-2">
                <Label>{t('settings.mcp.command')}</Label>
                <Input
                  defaultValue={server.command}
                  key={server.id + '-cmd'}
                  onBlur={(e) => handleBlur('command', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{t('settings.mcp.args')}</Label>
                <Input
                  defaultValue={server.args.join(' ')}
                  key={server.id + '-args'}
                  onBlur={(e) => handleArgsBlur(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label>URL</Label>
              <Input
                defaultValue={server.url}
                key={server.id + '-url'}
                onBlur={(e) => handleBlur('url', e.target.value)}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>{t('settings.mcp.autoApprove')}</Label>
            <Switch
              checked={server.autoApprove}
              onCheckedChange={(checked) => updateServer(server.id, { autoApprove: checked })}
            />
          </div>
        </div>

        <Tabs
          defaultValue="tools"
          onValueChange={(v) => {
            if (v === 'resources' && selectedServerId) loadResources(selectedServerId)
            if (v === 'prompts' && selectedServerId) loadPrompts(selectedServerId)
          }}>
          <TabsList className="w-full">
            <TabsTrigger value="tools" className="flex-1">
              {t('settings.mcp.tools')} ({serverTools.length})
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex-1">
              {t('settings.mcp.resources')} ({serverResources.length})
            </TabsTrigger>
            <TabsTrigger value="prompts" className="flex-1">
              {t('settings.mcp.prompts')} ({serverPrompts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="space-y-1">
            {serverTools.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('settings.mcp.noTools')}</p>
            ) : (
              serverTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{tool.name}</p>
                    {tool.description && (
                      <p className="text-muted-foreground truncate text-xs">{tool.description}</p>
                    )}
                  </div>
                  <Switch
                    checked={tool.enabled}
                    onCheckedChange={(checked) => updateTool(tool.id, { enabled: checked })}
                  />
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="resources" className="space-y-2">
            {serverResources.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('settings.mcp.noResources')}</p>
            ) : (
              serverResources.map((res) => (
                <div key={res.uri} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{res.name}</p>
                      <p className="text-muted-foreground truncate text-xs">{res.uri}</p>
                      {res.description && (
                        <p className="text-muted-foreground text-xs">{res.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!selectedServerId) return
                        const content = await readResource(selectedServerId, res.uri)
                        if (content) setResourcePreview(content)
                      }}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
            {resourcePreview && (
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">{resourcePreview.uri}</span>
                  <Button variant="ghost" size="sm" onClick={() => setResourcePreview(null)}>
                    ×
                  </Button>
                </div>
                <pre className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs">
                  {resourcePreview.text ?? t('settings.mcp.binaryContent')}
                </pre>
              </div>
            )}
          </TabsContent>

          <TabsContent value="prompts" className="space-y-2">
            {serverPrompts.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('settings.mcp.noPrompts')}</p>
            ) : (
              serverPrompts.map((prompt) => (
                <div key={prompt.name} className="rounded-md border px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{prompt.name}</p>
                      {prompt.description && (
                        <p className="text-muted-foreground text-xs">{prompt.description}</p>
                      )}
                      {prompt.arguments && prompt.arguments.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                          {t('settings.mcp.promptArgs')}:{' '}
                          {prompt.arguments.map((a) => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!selectedServerId) return
                        const msgs = await getPrompt(selectedServerId, prompt.name, promptArgs)
                        if (msgs) {
                          setPromptResult(
                            msgs
                              .map(
                                (m) =>
                                  `[${m.role}] ${typeof m.content === 'object' && 'text' in m.content ? m.content.text : JSON.stringify(m.content)}`,
                              )
                              .join('\n\n'),
                          )
                        }
                      }}>
                      <FileText className="h-4 w-4" />
                    </Button>
                  </div>
                  {prompt.arguments && prompt.arguments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {prompt.arguments.map((arg) => (
                        <Input
                          key={arg.name}
                          placeholder={`${arg.name}${arg.required ? ' *' : ''}`}
                          className="h-7 text-xs"
                          value={promptArgs[arg.name] ?? ''}
                          onChange={(e) =>
                            setPromptArgs((prev) => ({ ...prev, [arg.name]: e.target.value }))
                          }
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
            {promptResult && (
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium">{t('settings.mcp.promptResult')}</span>
                  <Button variant="ghost" size="sm" onClick={() => setPromptResult(null)}>
                    ×
                  </Button>
                </div>
                <pre className="bg-muted max-h-60 overflow-auto whitespace-pre-wrap rounded p-2 text-xs">
                  {promptResult}
                </pre>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  )
}
