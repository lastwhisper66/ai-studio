import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Lock } from 'lucide-react'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { LOCKED_PARAM_KEYS } from '@shared/locked-param-keys'
import { duplicateKeys, type ParamRow } from './extra-params-rows'

interface ExtraParamsEditorProps {
  rows: ParamRow[]
  onChange: (rows: ParamRow[]) => void
}

export function ExtraParamsEditor({ rows, onChange }: ExtraParamsEditorProps): React.JSX.Element {
  const { t } = useTranslation()
  const dupes = duplicateKeys(rows)

  const update = (index: number, patch: Partial<ParamRow>): void => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const remove = (index: number): void => {
    onChange(rows.filter((_, i) => i !== index))
  }

  const add = (): void => {
    onChange([...rows, { key: '', value: '' }])
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{t('editModel.extraParams.label')}</Label>
      <p className="text-muted-foreground text-xs">{t('editModel.extraParams.hint')}</p>

      {rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map((row, index) => {
            const trimmed = row.key.trim()
            const isDupe = dupes.has(trimmed)
            const isLocked = (LOCKED_PARAM_KEYS as readonly string[]).includes(trimmed)
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={row.key}
                    onChange={(e) => update(index, { key: e.target.value })}
                    placeholder={t('editModel.extraParams.keyPlaceholder')}
                    className={`flex-1 font-mono text-xs ${isDupe ? 'border-destructive' : ''}`}
                  />
                  <Input
                    value={row.value}
                    onChange={(e) => update(index, { value: e.target.value })}
                    placeholder={t('editModel.extraParams.valuePlaceholder')}
                    className="flex-1 font-mono text-xs"
                  />
                  {isLocked && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground shrink-0 p-1">
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{t('editModel.extraParams.locked')}</TooltipContent>
                    </Tooltip>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-muted-foreground hover:text-destructive shrink-0 rounded p-1 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {isDupe && (
                  <p className="text-destructive text-xs">{t('editModel.extraParams.duplicate')}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded px-1 py-1 text-xs transition-colors">
        <Plus className="h-3.5 w-3.5" />
        {t('editModel.extraParams.add')}
      </button>
    </div>
  )
}
