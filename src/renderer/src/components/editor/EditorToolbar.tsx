import { Save, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { useEditorStore } from '@renderer/stores/editorStore'

interface EditorToolbarProps {
  onSave: () => void
  onSaveAs: () => void
  saveStatus: 'idle' | 'saved' | 'error'
}

export function EditorToolbar({
  onSave,
  onSaveAs,
  saveStatus,
}: EditorToolbarProps): React.JSX.Element {
  const { t } = useTranslation()
  const currentPath = useEditorStore((s) => s.currentPath)
  const isDirty = useEditorStore((s) => s.isDirty)
  const fileName = currentPath ? currentPath.split(/[\\/]/).pop() : ''

  return (
    <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
      <div className="flex flex-1 items-center gap-2">
        {fileName && (
          <>
            <span className="text-sm font-medium">{fileName}</span>
            {isDirty && (
              <span className="h-2 w-2 rounded-full bg-orange-500" title={t('editor.unsaved')} />
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-muted-foreground">{t('editor.saved')}</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-destructive">{t('editor.saveFailed')}</span>
            )}
          </>
        )}
      </div>
      <Button onClick={onSave} variant="outline" size="sm" disabled={!currentPath}>
        <Save size={16} className="mr-1" />
        {t('editor.save')}
      </Button>
      <Button onClick={onSaveAs} variant="outline" size="sm">
        <FileDown size={16} className="mr-1" />
        {t('editor.saveAs')}
      </Button>
    </div>
  )
}
