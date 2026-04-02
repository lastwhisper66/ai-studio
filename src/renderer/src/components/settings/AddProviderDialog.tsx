import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useProviderStore } from '@renderer/stores/providerStore'
import { PROVIDER_TEMPLATES } from './provider-templates'

interface AddProviderDialogProps {
  children: React.ReactNode
}

export function AddProviderDialog({ children }: AddProviderDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const addProvider = useProviderStore((s) => s.addProvider)

  const handleAdd = async (templateIndex: number): Promise<void> => {
    const template = PROVIDER_TEMPLATES[templateIndex]
    setOpen(false)
    await addProvider({
      type: template.type,
      name: template.name,
      baseUrl: template.defaultBaseUrl,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.provider.addProvider')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="-mx-2 max-h-72">
          {PROVIDER_TEMPLATES.map((template, index) => (
            <button
              key={template.type}
              onClick={() => handleAdd(index)}
              className="hover:bg-accent flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full border border-white/20"
                style={{ backgroundColor: template.color }}
              />
              {template.name}
            </button>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
