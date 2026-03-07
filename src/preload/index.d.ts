import type { ElectronAPI } from '@electron-toolkit/preload'
import type { ApiType } from './index'

declare global {
  interface Window {
    electron: ElectronAPI
    api: ApiType
  }
}
