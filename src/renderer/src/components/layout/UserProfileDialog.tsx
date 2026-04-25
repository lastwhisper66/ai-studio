import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@renderer/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@renderer/components/ui/avatar'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'
import { useUserAvatar } from '@renderer/hooks/useUserAvatar'

interface UserProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UserProfileDialog({
  open,
  onOpenChange,
}: UserProfileDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSettingsStore((s) => s.settings)
  const saveSettings = useSettingsStore((s) => s.saveSettings)

  const avatarPath = settings['user.avatarPath'] ?? ''
  const displayName = settings['user.displayName'] ?? ''

  const [name, setName] = useState(displayName)
  const avatarUrl = useUserAvatar()

  useEffect(() => {
    if (open) setName(displayName)
  }, [open, displayName])

  const handleChangeAvatar = async (): Promise<void> => {
    const result = await window.api.saveUserAvatar(avatarPath || null)
    if (result.success && result.data) {
      await saveSettings({ 'user.avatarPath': result.data })
    }
  }

  const handleRemoveAvatar = async (): Promise<void> => {
    await saveSettings({ 'user.avatarPath': '' })
  }

  const handleNameBlur = (): void => {
    const trimmed = name.trim()
    if (trimmed !== displayName) {
      saveSettings({ 'user.displayName': trimmed })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('userProfile.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <Avatar className="h-20 w-20" key={avatarUrl ?? 'no-avatar'}>
            {avatarUrl && <AvatarImage src={avatarUrl} alt="User" />}
            <AvatarFallback className="bg-foreground/10 text-2xl">
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleChangeAvatar}>
              {t('userProfile.changeAvatar')}
            </Button>
            {avatarPath && (
              <Button variant="ghost" size="sm" onClick={handleRemoveAvatar}>
                {t('userProfile.removeAvatar')}
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">{t('userProfile.displayName')}</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder={t('userProfile.displayNamePlaceholder')}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
