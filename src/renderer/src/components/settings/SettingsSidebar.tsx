import {
  Cloud,
  Library,
  FolderTree,
  Settings2,
  ShieldCheck,
  Monitor,
  Keyboard,
  Database,
  TextQuote,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { Separator } from '@renderer/components/ui/separator'

export type SettingsSection =
  | 'provider'
  | 'model-library'
  | 'model-group'
  | 'general'
  | 'security'
  | 'display'
  | 'data'
  | 'phrases'
  | 'keyboard-shortcuts'

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

type SectionItem = { id: SettingsSection; labelKey: string; icon: React.ElementType }

const sectionGroups: SectionItem[][] = [
  [
    { id: 'provider', labelKey: 'settings.sections.provider', icon: Cloud },
    { id: 'model-library', labelKey: 'settings.sections.modelLibrary', icon: Library },
    { id: 'model-group', labelKey: 'settings.sections.modelGroup', icon: FolderTree },
  ],
  [
    { id: 'general', labelKey: 'settings.sections.general', icon: Settings2 },
    { id: 'security', labelKey: 'settings.sections.security', icon: ShieldCheck },
    { id: 'display', labelKey: 'settings.sections.display', icon: Monitor },
    { id: 'data', labelKey: 'settings.sections.data', icon: Database },
  ],
  [
    { id: 'phrases', labelKey: 'settings.sections.phrases', icon: TextQuote },
    { id: 'keyboard-shortcuts', labelKey: 'settings.sections.keyboardShortcuts', icon: Keyboard },
  ],
]

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <nav className="w-48 shrink-0 border-r p-3">
      {sectionGroups.map((group, groupIndex) => (
        <div key={groupIndex}>
          {groupIndex > 0 && <Separator className="my-2" />}
          <div className="space-y-1">
            {group.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onSectionChange(id)}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                  activeSection === id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                )}>
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}
