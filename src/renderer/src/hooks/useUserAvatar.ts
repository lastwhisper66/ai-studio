import { useState, useEffect } from 'react'
import { useSettingsStore } from '@renderer/stores/settingsStore'

const cache = new Map<string, string>()

export function useUserAvatar(): string | null {
  const avatarPath = useSettingsStore((s) => s.settings['user.avatarPath'] ?? '')
  const [fetchResult, setFetchResult] = useState<{ path: string; url: string } | null>(null)

  useEffect(() => {
    if (!avatarPath || cache.has(avatarPath)) return
    let cancelled = false
    window.api.readUserAvatar(avatarPath).then((result) => {
      if (!cancelled && result.success && result.data) {
        cache.set(avatarPath, result.data)
        setFetchResult({ path: avatarPath, url: result.data })
      }
    })
    return () => {
      cancelled = true
    }
  }, [avatarPath])

  if (!avatarPath) return null
  return cache.get(avatarPath) ?? (fetchResult?.path === avatarPath ? fetchResult.url : null)
}
