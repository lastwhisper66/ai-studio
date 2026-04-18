import {
  BookOpen,
  FileText,
  Languages,
  MessageCircle,
  ScanText,
  Sparkles,
  Wand2,
} from 'lucide-react'

/** Icon name (stored in DB) → lucide component. Keep in sync with seed & settings picker. */
export const selectionActionIconMap: Record<string, React.ElementType> = {
  BookOpen,
  FileText,
  Languages,
  MessageCircle,
  ScanText,
  Sparkles,
  Wand2,
}

export const defaultSelectionActionIcon = Sparkles
