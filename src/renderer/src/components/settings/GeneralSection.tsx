import { useEffect, useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { Switch } from '@renderer/components/ui/switch'
import { Label } from '@renderer/components/ui/label'
import { useSettingsStore } from '@renderer/stores/settingsStore'

export function GeneralSection(): React.JSX.Element {
  const { settings, saveSettings } = useSettingsStore()
  const [skipSsl, setSkipSsl] = useState(false)

  useEffect(() => {
    setSkipSsl(settings['app.skipSslVerify'] === 'true')
  }, [settings])

  const handleToggle = (checked: boolean): void => {
    setSkipSsl(checked)
    saveSettings({ 'app.skipSslVerify': String(checked) })
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card/50 p-5">
        <h2 className="text-base font-semibold">通用设置</h2>
        <p className="text-muted-foreground mt-1 text-sm">应用程序通用配置。</p>
      </div>

      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="text-sm font-semibold">网络</h3>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <Label className="text-sm font-medium">跳过 SSL 证书验证</Label>
              <p className="text-muted-foreground mt-0.5 text-xs">
                在企业 VPN 或代理环境下，如果遇到自签名证书导致连接失败，可以开启此选项。
              </p>
            </div>
          </div>
          <Switch checked={skipSsl} onCheckedChange={handleToggle} />
        </div>
      </div>
    </div>
  )
}
