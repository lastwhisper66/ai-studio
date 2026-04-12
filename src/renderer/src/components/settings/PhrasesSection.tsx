import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Label } from '@renderer/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { usePhraseStore } from '@renderer/stores/phraseStore'
import type { Phrase } from '@shared/types'

export function PhrasesSection(): React.JSX.Element {
  const { t } = useTranslation()
  const { phrases, loadPhrases, createPhrase, updatePhrase, deletePhrase } = usePhraseStore()
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingPhrase, setEditingPhrase] = useState<Phrase | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadPhrases()
  }, [loadPhrases])

  const pendingDeletePhrase = phrases.find((p) => p.id === pendingDeleteId)

  const openCreate = (): void => {
    setEditingPhrase(null)
    setTitle('')
    setContent('')
    setEditDialogOpen(true)
  }

  const openEdit = (phrase: Phrase): void => {
    setEditingPhrase(phrase)
    setTitle(phrase.title)
    setContent(phrase.content)
    setEditDialogOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!content.trim()) return
    const finalTitle = title.trim() || content.trim().slice(0, 20)
    if (editingPhrase) {
      await updatePhrase(editingPhrase.id, { title: finalTitle, content: content.trim() })
    } else {
      await createPhrase(finalTitle, content.trim())
    }
    setEditDialogOpen(false)
  }

  const handleDelete = async (): Promise<void> => {
    if (!pendingDeleteId) return
    await deletePhrase(pendingDeleteId)
    setPendingDeleteId(null)
    setDeleteDialogOpen(false)
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="flex items-start justify-between rounded-xl border bg-card/50 p-5">
        <div>
          <h2 className="text-base font-semibold">{t('settings.phrases.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t('settings.phrases.description')}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('settings.phrases.addPhrase')}
        </Button>
      </div>

      {/* Phrase list */}
      {phrases.length === 0 ? (
        <div className="rounded-xl border bg-card/50 p-8 text-center">
          <p className="text-muted-foreground text-sm">{t('settings.phrases.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {phrases.map((phrase) => (
            <div
              key={phrase.id}
              className="group flex items-center justify-between gap-4 rounded-xl border bg-card/50 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{phrase.title}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">{phrase.content}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => openEdit(phrase)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => {
                    setPendingDeleteId(phrase.id)
                    setDeleteDialogOpen(true)
                  }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Edit/Create Dialog */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) {
            setEditingPhrase(null)
            setTitle('')
            setContent('')
          }
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPhrase ? t('settings.phrases.editPhrase') : t('settings.phrases.addPhrase')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('settings.phrases.titleLabel')}</Label>
              <Input
                placeholder={t('settings.phrases.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.phrases.contentLabel')}</Label>
              <Textarea
                placeholder={t('settings.phrases.contentPlaceholder')}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-24 resize-none"
              />
              <p className="text-muted-foreground text-xs">{t('settings.phrases.contentHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!content.trim()}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.phrases.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.phrases.deleteDescription', {
                name: pendingDeletePhrase?.title ?? '',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
