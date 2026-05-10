import { ipcMain, dialog, BrowserWindow } from 'electron'
import { writeFileSync, readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { IpcChannels } from '@shared/ipc-channels'
import type {
  IpcResult,
  Assistant,
  ImportPlan,
  ImportResult,
  ImportResolution,
  ConflictItem,
} from '@shared/types'
import { toLocalizedError } from '../errors'
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  reorderTemplates,
  addFromTemplate,
  saveAsTemplate,
  resetBuiltinTemplates,
  type CreateTemplateData,
  type UpdateTemplateData,
  type ResetBuiltinsMode,
} from '../db/templates'

interface ExportPack {
  kind: 'ai-studio-template-pack'
  version: 1
  exportedAt: string
  templates: Array<{
    id: string
    name: string
    icon: string
    description: string
    category: string
    systemPrompt: string
    promptSuggestions: string[]
    recommendedModel: string
    temperature: string
    maxCompletionTokens: string
    topP: string
    contextCount: string
  }>
}

function isExportPack(v: unknown): v is ExportPack {
  if (!v || typeof v !== 'object') return false
  const o = v as { kind?: unknown; version?: unknown; templates?: unknown }
  return o.kind === 'ai-studio-template-pack' && o.version === 1 && Array.isArray(o.templates)
}

export function registerAssistantTemplateHandlers(): void {
  ipcMain.handle(IpcChannels.ASSISTANT_TEMPLATE_LIST, (): IpcResult<Assistant[]> => {
    try {
      return { success: true, data: listTemplates() }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_GET,
    (_, id: string): IpcResult<Assistant | undefined> => {
      try {
        return { success: true, data: getTemplate(id) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_CREATE,
    (_, data: CreateTemplateData): IpcResult<Assistant> => {
      try {
        return { success: true, data: createTemplate(data) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_UPDATE,
    (_, id: string, data: UpdateTemplateData): IpcResult<Assistant | undefined> => {
      try {
        return { success: true, data: updateTemplate(id, data) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(IpcChannels.ASSISTANT_TEMPLATE_DELETE, (_, id: string): IpcResult<void> => {
    try {
      deleteTemplate(id)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(IpcChannels.ASSISTANT_TEMPLATE_REORDER, (_, ids: string[]): IpcResult<void> => {
    try {
      reorderTemplates(ids)
      return { success: true }
    } catch (e) {
      return { success: false, error: toLocalizedError(e) }
    }
  })

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_ADD_FROM_TEMPLATE,
    (_, templateId: string): IpcResult<Assistant> => {
      try {
        return { success: true, data: addFromTemplate(templateId) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_SAVE_AS_TEMPLATE,
    (_, assistantId: string): IpcResult<Assistant> => {
      try {
        return { success: true, data: saveAsTemplate(assistantId) }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_EXPORT_PACK,
    async (event, templateIds: string[]): Promise<IpcResult<{ filePath: string } | null>> => {
      try {
        const templates = templateIds
          .map((id) => getTemplate(id))
          .filter((t): t is Assistant => !!t)
        if (templates.length === 0) {
          return {
            success: false,
            error: { code: 'NOT_FOUND', message: 'No templates to export' },
          }
        }

        const pack: ExportPack = {
          kind: 'ai-studio-template-pack',
          version: 1,
          exportedAt: new Date().toISOString(),
          templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            icon: t.icon,
            description: t.description,
            category: t.category,
            systemPrompt: t.systemPrompt,
            promptSuggestions: t.promptSuggestions,
            recommendedModel: t.recommendedModel,
            temperature: t.temperature,
            maxCompletionTokens: t.maxCompletionTokens,
            topP: t.topP,
            contextCount: t.contextCount,
          })),
        }

        const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
        const defaultName =
          templates.length === 1
            ? `${templates[0].name || 'template'}.json`
            : `assistant-templates-${Date.now()}.json`
        const result = await dialog.showSaveDialog(win!, {
          defaultPath: defaultName,
          filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        if (result.canceled || !result.filePath) return { success: true, data: null }

        writeFileSync(result.filePath, JSON.stringify(pack, null, 2), 'utf-8')
        return { success: true, data: { filePath: result.filePath } }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_IMPORT_PACK,
    async (event): Promise<IpcResult<ImportPlan | null>> => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender) ?? undefined
        const result = await dialog.showOpenDialog(win!, {
          properties: ['openFile'],
          filters: [{ name: 'JSON', extensions: ['json'] }],
        })
        if (result.canceled || result.filePaths.length === 0) {
          return { success: true, data: null }
        }

        const raw = readFileSync(result.filePaths[0], 'utf-8')
        const parsed = JSON.parse(raw) as unknown
        if (!isExportPack(parsed)) {
          return {
            success: false,
            error: { code: 'INVALID_PACK', message: 'Not an AI Studio template pack' },
          }
        }

        const existingTemplates = listTemplates()
        const existingById = new Map(existingTemplates.map((t) => [t.id, t]))
        const existingByName = new Map(existingTemplates.map((t) => [t.name, t]))

        const ok: Assistant[] = []
        const conflicts: ConflictItem[] = []

        for (const p of parsed.templates) {
          const synthetic: Assistant = {
            id: p.id,
            kind: 'template',
            name: p.name,
            icon: p.icon,
            description: p.description,
            systemPrompt: p.systemPrompt,
            promptSuggestions: p.promptSuggestions,
            providerId: null,
            model: '',
            isDefault: false,
            group: '',
            category: p.category,
            recommendedModel: p.recommendedModel,
            isBuiltin: false,
            source: 'imported',
            sourceTemplateId: null,
            temperature: p.temperature,
            maxCompletionTokens: p.maxCompletionTokens,
            topP: p.topP,
            contextCount: p.contextCount,
            sortOrder: 0,
            createdAt: '',
            updatedAt: '',
          }

          const byId = existingById.get(p.id)
          if (byId) {
            conflicts.push({ template: synthetic, existingId: byId.id, reason: 'id' })
            continue
          }
          const byName = existingByName.get(p.name)
          if (byName) {
            conflicts.push({ template: synthetic, existingId: byName.id, reason: 'name' })
            continue
          }
          ok.push(synthetic)
        }

        return { success: true, data: { ok, conflicts } }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_APPLY_IMPORT,
    (_, payload: { ok: Assistant[]; resolutions: ImportResolution[] }): IpcResult<ImportResult> => {
      try {
        let imported = 0
        let skipped = 0
        let overwritten = 0

        // Plain insert path: any template in `ok` (no conflict) is inserted as-is.
        for (const t of payload.ok) {
          createTemplate({
            id: t.id,
            name: t.name,
            icon: t.icon,
            description: t.description,
            systemPrompt: t.systemPrompt,
            promptSuggestions: t.promptSuggestions,
            category: t.category,
            recommendedModel: t.recommendedModel,
            temperature: t.temperature,
            maxCompletionTokens: t.maxCompletionTokens,
            topP: t.topP,
            contextCount: t.contextCount,
            source: 'imported',
            isBuiltin: false,
          })
          imported++
        }

        // Resolutions for conflicting templates:
        for (const res of payload.resolutions) {
          if (res.action === 'skip') {
            skipped++
            continue
          }
          // The renderer carries the conflicting template's full data on the resolution.
          const incoming = (res as ImportResolution & { template?: Assistant }).template
          if (!incoming) {
            skipped++
            continue
          }
          if (res.action === 'overwrite') {
            const existing = getTemplate(res.templateId)
            if (existing) {
              updateTemplate(res.templateId, {
                name: incoming.name,
                icon: incoming.icon,
                description: incoming.description,
                systemPrompt: incoming.systemPrompt,
                promptSuggestions: incoming.promptSuggestions,
                category: incoming.category,
                recommendedModel: incoming.recommendedModel,
                temperature: incoming.temperature,
                maxCompletionTokens: incoming.maxCompletionTokens,
                topP: incoming.topP,
                contextCount: incoming.contextCount,
              })
              overwritten++
            } else {
              // Template was deleted between detect and apply → fall through to asCopy.
              createTemplate({
                id: randomUUID(),
                name: incoming.name,
                icon: incoming.icon,
                description: incoming.description,
                systemPrompt: incoming.systemPrompt,
                promptSuggestions: incoming.promptSuggestions,
                category: incoming.category,
                recommendedModel: incoming.recommendedModel,
                temperature: incoming.temperature,
                maxCompletionTokens: incoming.maxCompletionTokens,
                topP: incoming.topP,
                contextCount: incoming.contextCount,
                source: 'imported',
                isBuiltin: false,
              })
              imported++
            }
          } else if (res.action === 'asCopy') {
            createTemplate({
              id: randomUUID(),
              name: incoming.name,
              icon: incoming.icon,
              description: incoming.description,
              systemPrompt: incoming.systemPrompt,
              promptSuggestions: incoming.promptSuggestions,
              category: incoming.category,
              recommendedModel: incoming.recommendedModel,
              temperature: incoming.temperature,
              maxCompletionTokens: incoming.maxCompletionTokens,
              topP: incoming.topP,
              contextCount: incoming.contextCount,
              source: 'imported',
              isBuiltin: false,
            })
            imported++
          }
        }

        return { success: true, data: { imported, skipped, overwritten } }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )

  ipcMain.handle(
    IpcChannels.ASSISTANT_TEMPLATE_RESET_BUILTINS,
    (_, mode: ResetBuiltinsMode): IpcResult<void> => {
      try {
        resetBuiltinTemplates(mode)
        return { success: true }
      } catch (e) {
        return { success: false, error: toLocalizedError(e) }
      }
    },
  )
}
