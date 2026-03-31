import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Label } from '@renderer/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'
import { useModelGroupStore } from '@renderer/stores/modelGroupStore'
import type { ModelGroup } from '@shared/types'

export function ModelGroupSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { groups, add, update, remove } = useModelGroupStore()
  const [editingGroup, setEditingGroup] = useState<ModelGroup | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<ModelGroup | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const confirmDelete = async (): Promise<void> => {
    if (deletingGroup) {
      await remove(deletingGroup.id)
      setDeletingGroup(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold">{t('modelGroup.title')}</h2>
          <p className="text-muted-foreground text-sm">{t('modelGroup.description')}</p>
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t('modelGroup.addGroup')}
        </Button>
      </div>

      {/* Group list */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {groups.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center text-sm">
              {t('modelGroup.empty')}
            </div>
          ) : (
            <div className="space-y-1">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{group.displayName}</div>
                    <div className="text-muted-foreground truncate text-xs font-mono">
                      {group.pattern}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingGroup(group)}
                    className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingGroup(group)}
                    className="text-muted-foreground hover:text-destructive rounded p-1 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Add dialog */}
      <ModelGroupDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSave={async (data) => {
          await add(data)
          setShowAddDialog(false)
        }}
      />

      {/* Edit dialog */}
      {editingGroup && (
        <ModelGroupDialog
          open={!!editingGroup}
          onOpenChange={(open) => !open && setEditingGroup(null)}
          initialData={editingGroup}
          onSave={async (data) => {
            await update(editingGroup.id, data)
            setEditingGroup(null)
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingGroup} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('modelGroup.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('modelGroup.deleteDescription', { name: deletingGroup?.displayName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/* ─── Add / Edit Dialog ─── */

interface ModelGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: { pattern: string; displayName: string }
  onSave: (data: { pattern: string; displayName: string }) => Promise<void>
}

function ModelGroupDialog({
  open,
  onOpenChange,
  initialData,
  onSave,
}: ModelGroupDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [pattern, setPattern] = useState(initialData?.pattern ?? '')
  const [displayName, setDisplayName] = useState(initialData?.displayName ?? '')

  const handleSave = async (): Promise<void> => {
    if (!pattern.trim() || !displayName.trim()) return
    await onSave({ pattern: pattern.trim(), displayName: displayName.trim() })
  }

  // Reset form when dialog opens with new data
  const handleOpenChange = (v: boolean): void => {
    if (v) {
      setPattern(initialData?.pattern ?? '')
      setDisplayName(initialData?.displayName ?? '')
    }
    onOpenChange(v)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? t('modelGroup.editGroup') : t('modelGroup.addGroup')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('modelGroup.pattern')}</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t('modelGroup.patternPlaceholder')}
              className="font-mono text-sm"
            />
            <p className="text-muted-foreground text-xs">{t('modelGroup.patternHint')}</p>
          </div>
          <div className="space-y-2">
            <Label>{t('modelGroup.displayName')}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('modelGroup.displayNamePlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!pattern.trim() || !displayName.trim()}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
