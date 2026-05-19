import {
  Cloud,
  Library,
  Settings2,
  Globe,
  Monitor,
  Keyboard,
  Database,
  TextQuote,
  Zap,
  TextSelect,
  Search,
  Info,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@renderer/lib/utils'
import { Separator } from '@renderer/components/ui/separator'

export type SettingsSection =
  | 'provider'
  | 'model-management'
  | 'general'
  | 'network'
  | 'display'
  | 'data'
  | 'phrases'
  | 'keyboard-shortcuts'
  | 'quick-assistant'
  | 'selection-assistant'
  | 'web-search'
  | 'about'

interface SettingsSidebarProps {
  activeSection: SettingsSection
  onSectionChange: (section: SettingsSection) => void
}

type SectionItem = { id: SettingsSection; labelKey: string; icon: React.ElementType }

const sectionGroups: SectionItem[][] = [
  [
    { id: 'provider', labelKey: 'settings.sections.provider', icon: Cloud },
    { id: 'model-management', labelKey: 'settings.sections.modelManagement', icon: Library },
  ],
  [
    { id: 'general', labelKey: 'settings.sections.general', icon: Settings2 },
    { id: 'network', labelKey: 'settings.sections.network', icon: Globe },
    { id: 'display', labelKey: 'settings.sections.display', icon: Monitor },
    { id: 'data', labelKey: 'settings.sections.data', icon: Database },
  ],
  [
    { id: 'phrases', labelKey: 'settings.sections.phrases', icon: TextQuote },
    { id: 'keyboard-shortcuts', labelKey: 'settings.sections.keyboardShortcuts', icon: Keyboard },
  ],
  [
    { id: 'quick-assistant', labelKey: 'settings.sections.quickAssistant', icon: Zap },
    {
      id: 'selection-assistant',
      labelKey: 'settings.sections.selectionAssistant',
      icon: TextSelect,
    },
    { id: 'web-search', labelKey: 'settings.sections.webSearch', icon: Search },
  ],
  [{ id: 'about', labelKey: 'settings.sections.about', icon: Info }],
]

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  const renderSectionButton = ({ id, labelKey, icon: Icon }: SectionItem): React.JSX.Element => (
    <button
      key={id}
      onClick={() => onSectionChange(id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors',
        activeSection === id
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
      )}>
      <Icon className="h-4 w-4" />
      {t(labelKey)}
    </button>
  )

  return (
    <nav className="flex h-full w-52 shrink-0 flex-col border-r p-3">
      <div>
        {sectionGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {groupIndex > 0 && <Separator className="my-2" />}
            <div className="space-y-1">{group.map(renderSectionButton)}</div>
          </div>
        ))}
      </div>
    </nav>
  )
}
