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
import { useProviderStore } from '@renderer/stores/providerStore'
import { PROVIDER_TEMPLATES } from './provider-templates'
import { ProviderIcon } from './ProviderIcon'

interface AddProviderDialogProps {
  children: React.ReactNode
}

export function AddProviderDialog({ children }: AddProviderDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const addProvider = useProviderStore((s) => s.addProvider)

  const selectedTemplate = PROVIDER_TEMPLATES.find((tpl) => tpl.type === selectedType)
  const isValid = name.trim().length > 0 && selectedType.length > 0

  const resetForm = (): void => {
    setName('')
    setSelectedType('')
  }

  const handleOpenChange = (value: boolean): void => {
    setOpen(value)
    if (!value) resetForm()
  }

  const handleTypeChange = (type: string): void => {
    setSelectedType(type)
    const template = PROVIDER_TEMPLATES.find((tpl) => tpl.type === type)
    if (template && !name.trim()) {
      setName(template.name)
    }
  }

  const handleConfirm = async (): Promise<void> => {
    if (!isValid || !selectedTemplate) return
    setOpen(false)
    await addProvider({
      type: selectedTemplate.type,
      name: name.trim(),
      baseUrl: selectedTemplate.defaultBaseUrl,
    })
    resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.provider.addProvider')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleConfirm()
          }}>
          <div className="grid gap-4 py-2">
            {/* Provider name */}
            <div className="grid gap-2">
              <Label htmlFor="provider-name">{t('settings.provider.providerName')}</Label>
              <Input
                id="provider-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.provider.providerNamePlaceholder')}
                autoFocus
              />
            </div>

            {/* Provider type */}
            <div className="grid gap-2">
              <Label>{t('settings.provider.providerType')}</Label>
              <Select value={selectedType} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('settings.provider.selectTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_TEMPLATES.map((template) => (
                    <SelectItem key={template.type} value={template.type}>
                      <span className="flex items-center gap-2">
                        <ProviderIcon
                          type={template.type}
                          name={template.name}
                          color={template.color}
                          size="sm"
                        />
                        {template.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
