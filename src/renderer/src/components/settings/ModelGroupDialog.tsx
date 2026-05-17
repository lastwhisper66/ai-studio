import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@renderer/components/ui/input'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@renderer/components/ui/dialog'

export interface ModelGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: { pattern: string; displayName: string }
  onSave: (data: { pattern: string; displayName: string }) => Promise<void>
}

export function ModelGroupDialog({
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
