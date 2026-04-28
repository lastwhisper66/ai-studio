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
import { useSkillStore } from '@renderer/stores/skillStore'

interface AddSkillDialogProps {
  children: React.ReactNode
}

export function AddSkillDialog({ children }: AddSkillDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const addSkill = useSkillStore((s) => s.addSkill)

  const isValid = name.trim().length > 0

  const resetForm = (): void => {
    setName('')
    setDescription('')
  }

  const handleOpenChange = (value: boolean): void => {
    setOpen(value)
    if (!value) resetForm()
  }

  const handleConfirm = async (): Promise<void> => {
    if (!isValid) return
    setOpen(false)
    await addSkill({
      name: name.trim(),
      description: description.trim(),
    })
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.skill.addSkill')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirm()
          }}>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="skill-name">{t('settings.skill.skillName')}</Label>
              <Input
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.skill.skillNamePlaceholder')}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="skill-desc">{t('settings.skill.description')}</Label>
              <Input
                id="skill-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('settings.skill.descriptionPlaceholder')}
              />
            </div>
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
