import { Notification } from 'electron'
import { getSetting } from '../db'
import { getMainWindow } from '../app-state'
import { t } from '../i18n'

export function showCompletionNotification(type: 'chat' | 'translate'): void {
  if (!Notification.isSupported()) return
  if (getSetting('notification.assistantMessage') !== 'true') return
  if (getMainWindow()?.isFocused()) return

  const body =
    type === 'chat' ? t('notification.chatComplete') : t('notification.translateComplete')

  const notification = new Notification({ title: 'AI Studio', body })
  notification.on('click', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
  notification.show()
}
