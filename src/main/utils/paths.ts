import { app } from 'electron'
import { join } from 'path'

export function getDataDir(): string {
  const appDir = app.isPackaged ? app.getPath('userData') : app.getAppPath()
  return join(appDir, 'data')
}

/**
 * Path to the reset self-heal marker. Must live *outside* `data/` so it
 * survives the `rmSync(data/)` step and can be read on next boot to retry
 * cleanup if the first attempt was interrupted (e.g. by AV scanning).
 *
 * - Dev: `<repo>/.reset-pending` (alongside `data/`; ignored by git)
 * - Prod: `<userData>/.reset-pending`
 */
export function getResetMarkerPath(): string {
  const appDir = app.isPackaged ? app.getPath('userData') : app.getAppPath()
  return join(appDir, '.reset-pending')
}
