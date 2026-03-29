import { Cloud, Settings2, Monitor, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'

export type SettingsSection = 'provider' | 'general' | 'display' | 'language'

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

const sections: { id: SettingsSection; labelKey: string; icon: React.ElementType }[] = [
  { id: 'provider', labelKey: 'settings.sections.provider', icon: Cloud },
  { id: 'general', labelKey: 'settings.sections.general', icon: Settings2 },
  { id: 'display', labelKey: 'settings.sections.display', icon: Monitor },
  { id: 'language', labelKey: 'settings.sections.language', icon: Globe },
]

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <nav className="w-48 shrink-0 space-y-1 border-r p-3">
      {sections.map(({ id, labelKey, icon: Icon }) => (
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
    </nav>
  )
}
