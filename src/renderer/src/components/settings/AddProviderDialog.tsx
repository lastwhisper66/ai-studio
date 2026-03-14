import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useProviderStore } from '@renderer/stores/providerStore'
import { PROVIDER_TEMPLATES } from './provider-templates'

interface AddProviderDialogProps {
  children: React.ReactNode
}

export function AddProviderDialog({ children }: AddProviderDialogProps): React.JSX.Element {
  const addProvider = useProviderStore((s) => s.addProvider)

  const handleAdd = async (templateIndex: number): Promise<void> => {
    const template = PROVIDER_TEMPLATES[templateIndex]
    await addProvider({
      type: template.type,
      name: template.name,
      baseUrl: template.defaultBaseUrl,
      model: template.defaultModels[0] ?? '',
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {PROVIDER_TEMPLATES.map((template, index) => (
          <DropdownMenuItem key={template.type} onClick={() => handleAdd(index)}>
            <span
              className="mr-2 inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: template.color }}
            />
            {template.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
