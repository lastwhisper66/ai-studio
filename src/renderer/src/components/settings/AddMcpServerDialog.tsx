import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { useMcpStore } from '@renderer/stores/mcpStore'
import type { McpServerType } from '@shared/types'

interface AddMcpServerDialogProps {
  children: React.ReactNode
}

export function AddMcpServerDialog({ children }: AddMcpServerDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<McpServerType>('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [url, setUrl] = useState('')
  const addServer = useMcpStore((s) => s.addServer)

  const isStdio = type === 'stdio'
  const isValid =
    name.trim().length > 0 && (isStdio ? command.trim().length > 0 : url.trim().length > 0)

  const resetForm = (): void => {
    setName('')
    setType('stdio')
    setCommand('')
    setArgs('')
    setUrl('')
  }

  const handleOpenChange = (value: boolean): void => {
    setOpen(value)
    if (!value) resetForm()
  }

  const handleConfirm = async (): Promise<void> => {
    if (!isValid) return
    setOpen(false)

    const parsedArgs = args
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0)

    await addServer({
      name: name.trim(),
      type,
      command: isStdio ? command.trim() : undefined,
      args: isStdio ? parsedArgs : undefined,
      url: !isStdio ? url.trim() : undefined,
    })
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.mcp.addServer')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirm()
          }}>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="mcp-name">{t('settings.mcp.serverName')}</Label>
              <Input
                id="mcp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.mcp.serverNamePlaceholder')}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label>{t('settings.mcp.serverType')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as McpServerType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stdio">stdio</SelectItem>
                  <SelectItem value="sse">SSE</SelectItem>
                  <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isStdio ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="mcp-command">{t('settings.mcp.command')}</Label>
                  <Input
                    id="mcp-command"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="npx"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mcp-args">{t('settings.mcp.args')}</Label>
                  <Input
                    id="mcp-args"
                    value={args}
                    onChange={(e) => setArgs(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                  />
                </div>
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="mcp-url">URL</Label>
                <Input
                  id="mcp-url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={!isValid}>
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
