import { useState, useEffect } from 'react'
import { useSettingsStore } from '@renderer/stores/settingsStore'

const cache = new Map<string, string>()

export function useUserAvatar(): string | null {
  const avatarPath = useSettingsStore((s) => s.settings['user.avatarPath'] ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => cache.get(avatarPath) ?? null)

  useEffect(() => {
    if (!avatarPath) {
      setAvatarUrl(null)
      return
    }
    const cached = cache.get(avatarPath)
    if (cached) {
      setAvatarUrl(cached)
      return
    }
    let cancelled = false
    window.api.readUserAvatar(avatarPath).then((result) => {
      if (!cancelled && result.success && result.data) {
        cache.set(avatarPath, result.data)
        setAvatarUrl(result.data)
      }
    })
    return () => {
      cancelled = true
    }
  }, [avatarPath])

  return avatarUrl
}
