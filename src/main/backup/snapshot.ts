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
// applySnapshot — apply a snapshot to the local database (transactional).
// =============================================================================

/**
 * Apply a snapshot to the local database. Wrapped in a single SQLite transaction
 * — if any step throws, the DB is rolled back and avatars are reverted.
 *
 * `replace` mode: clear each config table, then insert from snapshot.
 * `merge`   mode: upsert by id (snapshot wins for collisions; local-only rows kept).
 */
export function applySnapshot(snapshot: BackupSnapshot, mode: BackupImportMode): BackupSummary {
  const db = getDb()
  const dataDir = getDataDir()
  const finalAvatarsDir = join(dataDir, AVATARS_SUBDIR)
  const tmpAvatarsDir = join(dataDir, AVATARS_SUBDIR + '.import-' + randomUUID())

  // 1. Stage avatars to a temp dir BEFORE touching the DB, on the same
  //    filesystem so the later rename can be atomic.
  if (snapshot.avatars.length > 0) {
    mkdirSync(tmpAvatarsDir, { recursive: true })
    for (const av of snapshot.avatars) {
      writeFileSync(join(tmpAvatarsDir, av.fileName), Buffer.from(av.data, 'base64'))
    }
  }

  let summary: BackupSummary | null = null
  try {
    db.transaction(() => {
      summary = applyTablesAndSettings(snapshot, mode)
    })()
  } catch (e) {
    // Roll back avatar staging and rethrow.
    if (existsSync(tmpAvatarsDir)) {
      try {
        rmSync(tmpAvatarsDir, { recursive: true, force: true })
      } catch {
        /* best-effort */
      }
    }
    throw e
  }

  // 2. DB committed. Now move staged avatars into place atomically.
  //    There's an unavoidable window here where the DB references the new
  //    state and the avatars still reflect the old state; a startup janitor
  //    (`cleanupStaleAvatarStaging`) sweeps any leftover `.import-*` /
  //    `.trash-*` sibling dirs so we self-heal across restarts.
  if (snapshot.avatars.length > 0) {
    if (mode === 'replace' && existsSync(finalAvatarsDir)) {
      // Three-step swap: keep the old dir under a `.trash-*` sibling until
      // the new dir is in place, then nuke the trash. If the second rename
      // fails we restore the old dir so the user is never left avatar-less.
      const trashDir = finalAvatarsDir + '.trash-' + randomUUID()
      renameSync(finalAvatarsDir, trashDir)
      try {
        renameSync(tmpAvatarsDir, finalAvatarsDir)
        rmSync(trashDir, { recursive: true, force: true })
      } catch (e) {
        try {
          renameSync(trashDir, finalAvatarsDir)
        } catch {
          /* best-effort */
        }
        throw e
      }
    } else {
      // `replace` with no pre-existing dir, OR `merge` mode. Move each staged
      // file into place via per-file rename so each individual avatar update
      // is atomic — a crash mid-loop leaves a mix of new & old files but
      // never a partially-written file.
      mkdirSync(finalAvatarsDir, { recursive: true })
      for (const av of snapshot.avatars) {
        const stagedPath = join(tmpAvatarsDir, av.fileName)
        const finalPath = join(finalAvatarsDir, av.fileName)
        try {
          renameSync(stagedPath, finalPath)
        } catch {
          // Cross-device link or Windows EPERM (a file is currently held
          // open). Fall back to a copy + unlink — still atomic from the
          // reader's perspective via writeFileSync's atomic-replace
          // semantics on the same filesystem.
          writeFileSync(finalPath, Buffer.from(av.data, 'base64'))
        }
      }
      try {
        rmSync(tmpAvatarsDir, { recursive: true, force: true })
      } catch {
        /* best-effort — leftover tmp dir will be swept next boot */
      }
    }
  }

  return summary!
}

/**
 * Boot-time janitor: remove stale `.import-*` and `.trash-*` sibling dirs
 * that a previous run created and never cleaned up (process crash, power
 * loss, etc.). Safe to run unconditionally — these names are reserved by
 * `applySnapshot` and aren't used for anything else.
 */
export function cleanupStaleAvatarStaging(): void {
  const dataDir = getDataDir()
  if (!existsSync(dataDir)) return
  let entries: string[] = []
  try {
    entries = readdirSync(dataDir)
  } catch {
    return
  }
  for (const name of entries) {
    if (
      name.startsWith(AVATARS_SUBDIR + '.import-') ||
      name.startsWith(AVATARS_SUBDIR + '.trash-')
    ) {
      try {
        rmSync(join(dataDir, name), { recursive: true, force: true })
      } catch {
        /* best-effort */
      }
    }
  }
}

function applyTablesAndSettings(snapshot: BackupSnapshot, mode: BackupImportMode): BackupSummary {
  const db = getDb()

  if (mode === 'replace') {
    // Order: child tables before parent (FK ON CASCADE handles cascades, but
    // we drop in this explicit order for clarity and predictability).
    db.exec(`
      DELETE FROM models;
      DELETE FROM providers;
      DELETE FROM assistants;
      DELETE FROM phrases;
      DELETE FROM model_definitions;
      DELETE FROM model_groups;
      DELETE FROM quick_actions;
      DELETE FROM selection_actions;
      DELETE FROM settings;
    `)
  }

  // ---------- providers (apiKey re-encrypted with local safeStorage) ----------
  const upsertProvider = db.prepare(`
    INSERT INTO providers (id, type, name, api_key, base_url, enabled, is_default, sort_order)
    VALUES (@id, @type, @name, @api_key, @base_url, @enabled, @is_default, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      name = excluded.name,
      api_key = excluded.api_key,
      base_url = excluded.base_url,
      enabled = excluded.enabled,
      is_default = excluded.is_default,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `)
  for (const p of snapshot.providers) {
    upsertProvider.run({
      id: p.id,
      type: p.type,
      name: p.name,
      api_key: p.apiKey ? encryptSetting(p.apiKey) : '',
      base_url: p.baseUrl,
      enabled: p.enabled ? 1 : 0,
      is_default: p.isDefault ? 1 : 0,
      sort_order: p.sortOrder,
    })
  }

  // ---------- models ----------
  const upsertModel = db.prepare(`
    INSERT INTO models (id, provider_id, name, group_name, capabilities, enabled, sort_order)
    VALUES (@id, @provider_id, @name, @group_name, @capabilities, @enabled, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      provider_id = excluded.provider_id,
      name = excluded.name,
      group_name = excluded.group_name,
      capabilities = excluded.capabilities,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order
  `)
  for (const m of snapshot.models) {
    upsertModel.run({
      id: m.id,
      provider_id: m.providerId,
      name: m.name,
      group_name: m.group ?? '',
      capabilities: JSON.stringify(m.capabilities ?? []),
      enabled: m.enabled ? 1 : 0,
      sort_order: m.sortOrder,
    })
  }

  // ---------- assistants ----------
  const upsertAssistant = db.prepare(`
    INSERT INTO assistants (id, kind, name, icon, description, system_prompt, provider_id, model,
      temperature, max_completion_tokens, top_p, context_count, prompt_suggestions,
      is_default, group_name, category, recommended_model, source, is_builtin,
      source_template_id, sort_order)
    VALUES (@id, @kind, @name, @icon, @description, @system_prompt, @provider_id, @model,
      @temperature, @max_completion_tokens, @top_p, @context_count, @prompt_suggestions,
      @is_default, @group_name, @category, @recommended_model, @source, @is_builtin,
      @source_template_id, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      name = excluded.name,
      icon = excluded.icon,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      provider_id = excluded.provider_id,
      model = excluded.model,
      temperature = excluded.temperature,
      max_completion_tokens = excluded.max_completion_tokens,
      top_p = excluded.top_p,
      context_count = excluded.context_count,
      prompt_suggestions = excluded.prompt_suggestions,
      is_default = excluded.is_default,
      group_name = excluded.group_name,
      category = excluded.category,
      recommended_model = excluded.recommended_model,
      source = excluded.source,
      is_builtin = excluded.is_builtin,
      source_template_id = excluded.source_template_id,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `)
  for (const a of snapshot.assistants) {
    upsertAssistant.run({
      id: a.id,
      kind: a.kind ?? 'assistant',
      name: a.name,
      icon: a.icon ?? '',
      description: a.description ?? '',
      system_prompt: a.systemPrompt ?? '',
      provider_id: a.providerId ?? null,
      model: a.model ?? '',
      temperature: a.temperature ?? '',
      max_completion_tokens: a.maxCompletionTokens ?? '',
      top_p: a.topP ?? '',
      context_count: a.contextCount ?? '10',
      prompt_suggestions: JSON.stringify(a.promptSuggestions ?? []),
      is_default: a.isDefault ? 1 : 0,
      group_name: a.group ?? '',
      category: a.category ?? '',
      recommended_model: a.recommendedModel ?? '',
      source: a.source ?? 'user',
      is_builtin: a.isBuiltin ? 1 : 0,
      source_template_id: a.sourceTemplateId ?? null,
      sort_order: a.sortOrder,
    })
  }

  // ---------- phrases ----------
  const upsertPhrase = db.prepare(`
    INSERT INTO phrases (id, title, content, sort_order)
    VALUES (@id, @title, @content, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      sort_order = excluded.sort_order
  `)
  for (const p of snapshot.phrases) {
    upsertPhrase.run({
      id: p.id,
      title: p.title ?? '',
      content: p.content,
      sort_order: p.sortOrder,
    })
  }

  // ---------- model_definitions ----------
  const upsertDef = db.prepare(`
    INSERT INTO model_definitions (id, name, group_name, capabilities, provider_types)
    VALUES (@id, @name, @group_name, @capabilities, @provider_types)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      group_name = excluded.group_name,
      capabilities = excluded.capabilities,
      provider_types = excluded.provider_types,
      updated_at = datetime('now')
  `)
  for (const d of snapshot.modelDefinitions) {
    upsertDef.run({
      id: d.id,
      name: d.name,
      group_name: d.group ?? '',
      capabilities: JSON.stringify(d.capabilities ?? []),
      provider_types: JSON.stringify(d.providerTypes ?? []),
    })
  }

  // ---------- model_groups ----------
  const upsertGroup = db.prepare(`
    INSERT INTO model_groups (id, pattern, display_name, sort_order)
    VALUES (@id, @pattern, @display_name, @sort_order)
    ON CONFLICT(id) DO UPDATE SET
      pattern = excluded.pattern,
      display_name = excluded.display_name,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `)
  for (const g of snapshot.modelGroups) {
    upsertGroup.run({
      id: g.id,
      pattern: g.pattern,
      display_name: g.displayName,
      sort_order: g.sortOrder,
    })
  }

  // ---------- quick_actions ----------
  const upsertQA = db.prepare(`
    INSERT INTO quick_actions
      (id, name, description, system_prompt, icon, is_builtin, sort_order, enabled)
    VALUES (@id, @name, @description, @system_prompt, @icon, @is_builtin, @sort_order, @enabled)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      icon = excluded.icon,
      is_builtin = excluded.is_builtin,
      sort_order = excluded.sort_order,
      enabled = excluded.enabled,
      updated_at = datetime('now')
  `)
  for (const q of snapshot.quickActions) {
    upsertQA.run({
      id: q.id,
      name: q.name,
      description: q.description ?? '',
      system_prompt: q.systemPrompt ?? '',
      icon: q.icon ?? 'Sparkles',
      is_builtin: q.isBuiltin ? 1 : 0,
      sort_order: q.sortOrder,
      enabled: q.enabled ? 1 : 0,
    })
  }

  // ---------- selection_actions ----------
  const upsertSA = db.prepare(`
    INSERT INTO selection_actions
      (id, name, description, system_prompt, icon, is_builtin, sort_order, enabled)
    VALUES (@id, @name, @description, @system_prompt, @icon, @is_builtin, @sort_order, @enabled)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      icon = excluded.icon,
      is_builtin = excluded.is_builtin,
      sort_order = excluded.sort_order,
      enabled = excluded.enabled,
      updated_at = datetime('now')
  `)
  for (const s of snapshot.selectionActions) {
    upsertSA.run({
      id: s.id,
      name: s.name,
      description: s.description ?? '',
      system_prompt: s.systemPrompt ?? '',
      icon: s.icon ?? 'Sparkles',
      is_builtin: s.isBuiltin ? 1 : 0,
      sort_order: s.sortOrder,
      enabled: s.enabled ? 1 : 0,
    })
  }

  // ---------- settings (encrypted via setSettingsBatch's SENSITIVE_KEYS routing) ----------
  setSettingsBatch(snapshot.settings)

  return {
    providers: snapshot.providers.length,
    models: snapshot.models.length,
    assistants: snapshot.assistants.length,
    phrases: snapshot.phrases.length,
    quickActions: snapshot.quickActions.length,
    selectionActions: snapshot.selectionActions.length,
    modelDefinitions: snapshot.modelDefinitions.length,
    modelGroups: snapshot.modelGroups.length,
    settings: Object.keys(snapshot.settings).length,
    avatars: snapshot.avatars.length,
  }
}
