import { app } from 'electron'
import { join } from 'path'

export function getDataDir(): string {
  const appDir = app.isPackaged ? app.getPath('userData') : app.getAppPath()
  return join(appDir, 'data')
}
