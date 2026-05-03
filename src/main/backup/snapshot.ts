import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { BackupAvatar, BackupImportMode, BackupSnapshot, BackupSummary } from '@shared/types'
import {
  listProviders,
  listAssistants,
  listPhrases,
  listModelDefinitions,
  listModelGroups,
  listQuickActions,
  listSelectionActions,
  listAllModels,
} from '../db'
import { encrypt as encryptSetting, getAllSettings, setSettingsBatch } from '../db/settings'
import { getDb } from '../db/database'
import { getDataDir } from '../utils/paths'
import { buildSnapshotEnvelope } from './codec'

const AVATARS_SUBDIR = 'avatars'

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
}

function mimeLookup(name: string): string {
  const ext = name.toLowerCase().split('.').pop()
  return (ext && MIME_BY_EXT[ext]) || 'application/octet-stream'
}

/** Collect all "config-like" data into a plaintext snapshot ready for encryption. */
export function collectSnapshot(): BackupSnapshot {
  const settings = getAllSettings() // already decrypted
  const providers = listProviders() // apiKey already decrypted by db/providers.ts
  const models = listAllModels()
  const modelDefinitions = listModelDefinitions()
  const modelGroups = listModelGroups()
  const assistants = listAssistants()
  const phrases = listPhrases()
  const quickActions = listQuickActions()
  const selectionActions = listSelectionActions()
  const avatars = readAllAvatars()

  return buildSnapshotEnvelope({
    settings,
    providers,
    models,
    modelDefinitions,
    modelGroups,
    assistants,
    phrases,
    quickActions,
    selectionActions,
    avatars,
  })
}

function readAllAvatars(): BackupAvatar[] {
  const dir = join(getDataDir(), AVATARS_SUBDIR)
  if (!existsSync(dir)) return []
  const out: BackupAvatar[] = []
  for (const fileName of readdirSync(dir)) {
    if (fileName.startsWith('.')) continue
    const full = join(dir, fileName)
    try {
      const data = readFileSync(full).toString('base64')
      out.push({ fileName, mimeType: mimeLookup(fileName), data })
    } catch {
      // skip unreadable file silently — backup is best-effort for avatars
    }
  }
  return out
}

// =============================================================================
// applySnapshot — implemented in Task 7
// =============================================================================
export function applySnapshot(_snapshot: BackupSnapshot, _mode: BackupImportMode): BackupSummary {
  throw new Error('applySnapshot not implemented yet — see Task 7')
}

// Internal exports — used by Task 7 to share helpers / re-encrypt API keys.
export const _backupInternal = {
  AVATARS_SUBDIR,
  encryptSetting,
  getDb,
  setSettingsBatch,
  randomUUID,
  mkdirSync,
  rmSync,
  renameSync,
  writeFileSync,
  existsSync,
  Buffer,
  join,
  getDataDir,
}
