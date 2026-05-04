import { ipcMain } from 'electron'
import { setSetting } from '../db/settings'

const TRACKED_PREFIX = new Set([
  'provider',
  'model',
  'assistant',
  'phrase',
  'model-definition',
  'model-group',
  'quick-action',
  'selection-action',
  'settings',
])
const TRACKED_VERB = new Set(['create', 'update', 'delete', 'reorder', 'set', 'set-batch'])

let initialized = false

/**
 * Wraps `ipcMain.handle` so that any registered handler whose channel name
 * matches `<tracked-domain>:<tracked-verb>` automatically updates
 * `backup.lastLocalChangeAt` after the original handler returns. Must be
 * called BEFORE `registerAllIpcHandlers` so all tracked handlers go through
 * the wrapper.
 *
 * Why a monkey-patch instead of explicit instrumentation?
 * Twenty-plus handler files would otherwise need a "mark dirty" call appended
 * to each mutation. Centralizing here keeps the cost of adding a new tracked
 * domain to one Set entry instead of N handler edits.
 */
export function installDirtyTracker(): void {
  if (initialized) return
  initialized = true
  const original = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = ((channel: string, listener: Parameters<typeof original>[1]) => {
    if (shouldTrack(channel)) {
      const wrapped: typeof listener = async (event, ...args) => {
        const result = await listener(event, ...args)
        try {
          // Don't mark dirty for our own backup.* settings changes — would
          // cause loops once Phase 5's sync-service starts writing
          // backup.lastSyncedAt / backup.lastRemoteSeenAt back to settings.
          if (channel === 'settings:set' || channel === 'settings:set-batch') {
            const firstArg = args[0]
            if (looksLikeBackupOnly(firstArg)) return result
          }
          setSetting('backup.lastLocalChangeAt', new Date().toISOString())
        } catch {
          /* best-effort — never let a tracker failure break the original
             IPC response. */
        }
        return result
      }
      return original(channel, wrapped)
    }
    return original(channel, listener)
  }) as typeof ipcMain.handle
}

function shouldTrack(channel: string): boolean {
  const colon = channel.indexOf(':')
  if (colon < 0) return false
  const domain = channel.slice(0, colon)
  const verb = channel.slice(colon + 1)
  if (!TRACKED_PREFIX.has(domain)) return false
  return TRACKED_VERB.has(verb)
}

function looksLikeBackupOnly(arg: unknown): boolean {
  if (typeof arg === 'string') return arg.startsWith('backup.')
  if (arg && typeof arg === 'object') {
    const keys = Object.keys(arg as Record<string, unknown>)
    return keys.length > 0 && keys.every((k) => k.startsWith('backup.'))
  }
  return false
}
