import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MiniApp } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { useMiniAppStore } from '@renderer/stores/miniAppStore'
import { MiniAppIcon } from '@renderer/components/mini-app'

interface MiniAppEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null creates a new app. */
  app: MiniApp | null
}

const DEFAULT_COLOR = '#6366f1'

/** Accepts only http(s) — anything else cannot load in a webview. */
function isValidUrl(raw: string): boolean {
  try {
    const { protocol } = new URL(raw.trim())
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

export function MiniAppEditDialog({
  open,
  onOpenChange,
  app,
}: MiniAppEditDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Keyed so each open mounts a fresh form: initial values come from
            props at mount time, instead of being reset by an effect. */}
        <MiniAppForm
          key={`${open}:${app?.id ?? 'new'}`}
          app={app}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function MiniAppForm({
  app,
  onDone,
}: {
  app: MiniApp | null
  onDone: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const createApp = useMiniAppStore((s) => s.createApp)
  const updateApp = useMiniAppStore((s) => s.updateApp)

  const [name, setName] = useState(app?.name ?? '')
  const [url, setUrl] = useState(app?.url ?? '')
  const [icon, setIcon] = useState(app?.icon ?? '')
  const [color, setColor] = useState(app?.color || DEFAULT_COLOR)
  const [userAgent, setUserAgent] = useState(app?.userAgent ?? '')
  const [busy, setBusy] = useState(false)

  const urlTouched = url.trim().length > 0
  const urlInvalid = urlTouched && !isValidUrl(url)
  const canSave = name.trim().length > 0 && urlTouched && !urlInvalid && !busy

  const handleSave = async (): Promise<void> => {
    if (!canSave) return
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        url: url.trim(),
        icon: icon.trim(),
        color: color.trim() || DEFAULT_COLOR,
        userAgent: userAgent.trim(),
      }
      if (app) {
        await updateApp(app.id, payload)
      } else {
        await createApp(payload)
      }
      onDone()
    } finally {
      setBusy(false)
    }
  }

  const previewGlyph = icon.trim() || name.trim().charAt(0).toUpperCase() || '?'

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {app ? t('settings.miniApps.editTitle') : t('settings.miniApps.addTitle')}
        </DialogTitle>
        <DialogDescription>{t('settings.miniApps.editDescription')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="mini-app-name">{t('settings.miniApps.field.name')}</Label>
          <Input
            id="mini-app-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.miniApps.field.namePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mini-app-url">{t('settings.miniApps.field.url')}</Label>
          <Input
            id="mini-app-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/chat"
            aria-invalid={urlInvalid}
          />
          {urlInvalid && (
            <p className="text-xs text-destructive">{t('settings.miniApps.field.urlInvalid')}</p>
          )}
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="mini-app-icon">{t('settings.miniApps.field.icon')}</Label>
            <Input
              id="mini-app-icon"
              value={icon}
              maxLength={2}
              onChange={(e) => setIcon(e.target.value)}
              placeholder={t('settings.miniApps.field.iconPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mini-app-color">{t('settings.miniApps.field.color')}</Label>
            <Input
              id="mini-app-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-16 cursor-pointer p-1"
            />
          </div>
          <MiniAppIcon
            app={{ name: name || '?', icon: previewGlyph, color }}
            size="lg"
            className="mb-0.5"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mini-app-ua">{t('settings.miniApps.field.userAgent')}</Label>
          <Input
            id="mini-app-ua"
            value={userAgent}
            onChange={(e) => setUserAgent(e.target.value)}
            placeholder={t('settings.miniApps.field.userAgentPlaceholder')}
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.miniApps.field.userAgentHint')}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {t('common.save')}
        </Button>
      </DialogFooter>
    </>
  )
}
