import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2, LogOut, ShieldAlert } from 'lucide-react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { MiniApp } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { SortableItem } from '@renderer/components/ui/sortable-item'
import { useMiniAppStore } from '@renderer/stores/miniAppStore'
import { BuiltinUpdateBanner } from '@renderer/components/settings/BuiltinUpdateBanner'
import { MiniAppIcon } from '@renderer/components/mini-app'
import { MiniAppEditDialog } from './MiniAppEditDialog'
import { ConfirmDialog } from './MiniAppConfirmDialog'

export function MiniAppSettings(): React.JSX.Element {
  const { t } = useTranslation()

  const apps = useMiniAppStore((s) => s.apps)
  const isLoaded = useMiniAppStore((s) => s.isLoaded)
  const loadApps = useMiniAppStore((s) => s.loadApps)
  const updateApp = useMiniAppStore((s) => s.updateApp)
  const deleteApp = useMiniAppStore((s) => s.deleteApp)
  const reorderApps = useMiniAppStore((s) => s.reorderApps)
  const clearSession = useMiniAppStore((s) => s.clearSession)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<MiniApp | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MiniApp | null>(null)
  const [logoutTarget, setLogoutTarget] = useState<MiniApp | null>(null)
  const [logoutAllOpen, setLogoutAllOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoaded) loadApps()
  }, [isLoaded, loadApps])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = apps.findIndex((a) => a.id === active.id)
    const newIndex = apps.findIndex((a) => a.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(apps, oldIndex, newIndex)
    await reorderApps(reordered.map((a) => a.id))
  }

  const showToast = (message: string): void => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleLogout = async (app: MiniApp): Promise<void> => {
    const ok = await clearSession(app.id)
    showToast(
      ok
        ? t('settings.miniApps.logoutSuccess', { name: app.name })
        : t('settings.miniApps.logoutFailed', { name: app.name }),
    )
  }

  const handleLogoutAll = async (): Promise<void> => {
    const results = await Promise.all(apps.map((a) => clearSession(a.id)))
    const failed = results.filter((r) => !r).length
    showToast(
      failed === 0
        ? t('settings.miniApps.logoutAllSuccess', { count: results.length })
        : t('settings.miniApps.logoutAllPartial', { failed }),
    )
  }

  return (
    <div className="space-y-5">
      <BuiltinUpdateBanner category="miniApps" />

      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">{t('settings.miniApps.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('settings.miniApps.description')}</p>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{t('settings.miniApps.appList')}</h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setLogoutAllOpen(true)}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              {t('settings.miniApps.logoutAll')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditTarget(null)
                setEditorOpen(true)
              }}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('settings.miniApps.addApp')}
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}>
            <SortableContext items={apps.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              {apps.map((app) => (
                <SortableItem
                  key={app.id}
                  id={app.id}
                  className="gap-2 rounded-lg border bg-card/30 p-3"
                  handleClassName="mr-1">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <MiniAppIcon app={app} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{app.name}</p>
                        {app.isBuiltin && (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {t('settings.miniApps.builtin')}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{app.url}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={app.enabled}
                      aria-label={t('settings.miniApps.toggleEnabled')}
                      onCheckedChange={(checked) => updateApp(app.id, { enabled: checked })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={t('settings.miniApps.logout')}
                      title={t('settings.miniApps.logout')}
                      onClick={() => setLogoutTarget(app)}>
                      <LogOut className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      aria-label={t('common.edit')}
                      onClick={() => {
                        setEditTarget(app)
                        setEditorOpen(true)
                      }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {!app.isBuiltin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t('common.delete')}
                        onClick={() => setDeleteTarget(app)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>

          {apps.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('settings.miniApps.emptyList')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs text-muted-foreground">{t('settings.miniApps.privacyNote')}</p>
      </div>

      {toast && (
        <div className="rounded-lg border bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {toast}
        </div>
      )}

      <MiniAppEditDialog open={editorOpen} onOpenChange={setEditorOpen} app={editTarget} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('settings.miniApps.deleteTitle')}
        description={t('settings.miniApps.deleteDescription', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={async () => {
          if (deleteTarget) await deleteApp(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />

      <ConfirmDialog
        open={logoutTarget !== null}
        onOpenChange={(o) => !o && setLogoutTarget(null)}
        title={t('settings.miniApps.logoutTitle')}
        description={t('settings.miniApps.logoutDescription', { name: logoutTarget?.name ?? '' })}
        confirmLabel={t('settings.miniApps.logout')}
        destructive
        onConfirm={async () => {
          if (logoutTarget) await handleLogout(logoutTarget)
          setLogoutTarget(null)
        }}
      />

      <ConfirmDialog
        open={logoutAllOpen}
        onOpenChange={setLogoutAllOpen}
        title={t('settings.miniApps.logoutAllTitle')}
        description={t('settings.miniApps.logoutAllDescription')}
        confirmLabel={t('settings.miniApps.logoutAll')}
        destructive
        onConfirm={async () => {
          await handleLogoutAll()
          setLogoutAllOpen(false)
        }}
      />
    </div>
  )
}
