import { Switch } from '@renderer/components/ui/switch'
import { Slider } from '@renderer/components/ui/slider'
import { Tooltip, TooltipTrigger, TooltipContent } from '@renderer/components/ui/tooltip'
import { Textarea } from '@renderer/components/ui/textarea'
import { HelpCircle, RotateCcw } from 'lucide-react'
import { useProviderStore } from '@renderer/stores/providerStore'
import { getTemplateByType } from './provider-templates'
import { cn } from '@renderer/lib/utils'
import type { SettingsFormState } from './types'

interface ModelSettingsProps {
  formState: SettingsFormState
  onChange: (field: keyof SettingsFormState, value: string) => void
  onCommit: (field: keyof SettingsFormState, value: string) => void
  onReset: () => void
}

function SettingLabel({ label, tooltip }: { label: string; tooltip?: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm">{label}</span>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground/50" />
          </TooltipTrigger>
          <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function SliderMarks({ marks }: { marks: string[] }): React.JSX.Element {
  return (
    <div className="mt-1.5 flex justify-between px-0.5">
      {marks.map((mark) => (
        <span key={mark} className="text-[11px] text-muted-foreground/50">
          {mark}
        </span>
      ))}
    </div>
  )
}

export function ModelSettings({
  formState,
  onChange,
  onCommit,
  onReset,
}: ModelSettingsProps): React.JSX.Element {
  const activeProviderId = useProviderStore((s) => s.activeProviderId)
  const providers = useProviderStore((s) => s.providers)

  const activeProvider = providers.find((p) => p.id === activeProviderId)
  const template = activeProvider ? getTemplateByType(activeProvider.type) : null

  const temperatureEnabled = formState.temperatureEnabled === 'true'
  const topPEnabled = formState.topPEnabled === 'true'
  const maxCompletionTokensEnabled = formState.maxCompletionTokensEnabled === 'true'
  const streaming = formState.streaming === 'true'
  const temperatureValue = parseFloat(formState.temperature) || 0.7
  const topPValue = parseFloat(formState.topP) || 1
  const contextCount = parseInt(formState.contextCount) || 5
  const maxCompletionTokensValue = parseInt(formState.maxCompletionTokens) || 4096

  return (
    <div className="space-y-5">
      {/* 模型参数卡片 */}
      <div className="rounded-xl border bg-card/50 px-5">
        {/* 默认模型 */}
        <div className="flex items-center justify-between border-b border-border/40 py-4">
          <span className="text-sm">默认模型</span>
          {activeProvider ? (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-1.5">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-sm"
                style={{ backgroundColor: template?.color || '#6b7280' }}
              />
              <span className="text-sm">{activeProvider.model || '未设置模型'}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">未配置服务商</span>
          )}
        </div>

        {/* 模型温度 */}
        <div className={cn('border-b border-border/40', temperatureEnabled && 'pb-4')}>
          <div className="flex items-center justify-between py-4">
            <SettingLabel
              label="模型温度"
              tooltip="控制回复的随机性。值越高越有创造性，值越低越确定。"
            />
            <div className="flex items-center gap-3">
              {temperatureEnabled && (
                <span className="font-mono text-xs text-muted-foreground">
                  {temperatureValue.toFixed(1)}
                </span>
              )}
              <Switch
                checked={temperatureEnabled}
                onCheckedChange={(checked) => onCommit('temperatureEnabled', String(checked))}
              />
            </div>
          </div>
          {temperatureEnabled && (
            <div>
              <Slider
                min={0}
                max={2}
                step={0.1}
                value={[temperatureValue]}
                onValueChange={([v]) => onChange('temperature', v.toString())}
                onValueCommit={([v]) => onCommit('temperature', v.toString())}
              />
              <SliderMarks marks={['0', '0.5', '1.0', '1.5', '2.0']} />
            </div>
          )}
        </div>

        {/* Top-P */}
        <div className={cn('border-b border-border/40', topPEnabled && 'pb-4')}>
          <div className="flex items-center justify-between py-4">
            <SettingLabel
              label="Top-P"
              tooltip="核采样参数。控制模型考虑的词汇概率累积范围，值越小回复越集中。"
            />
            <div className="flex items-center gap-3">
              {topPEnabled && (
                <span className="font-mono text-xs text-muted-foreground">
                  {topPValue.toFixed(2)}
                </span>
              )}
              <Switch
                checked={topPEnabled}
                onCheckedChange={(checked) => onCommit('topPEnabled', String(checked))}
              />
            </div>
          </div>
          {topPEnabled && (
            <div>
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[topPValue]}
                onValueChange={([v]) => onChange('topP', v.toString())}
                onValueCommit={([v]) => onCommit('topP', v.toString())}
              />
              <SliderMarks marks={['0', '0.25', '0.5', '0.75', '1.0']} />
            </div>
          )}
        </div>

        {/* 上下文数 */}
        <div className="border-b border-border/40 pb-4">
          <div className="flex items-center justify-between py-4">
            <SettingLabel
              label="上下文数"
              tooltip="发送给模型的历史消息数量。设为「不限」将发送所有历史消息。"
            />
            <span className="text-sm">{contextCount >= 100 ? '不限' : contextCount}</span>
          </div>
          <div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={[contextCount]}
              onValueChange={([v]) => onChange('contextCount', v.toString())}
              onValueCommit={([v]) => onCommit('contextCount', v.toString())}
            />
            <SliderMarks marks={['0', '25', '50', '75', '不限']} />
          </div>
        </div>

        {/* 最大 Token 数 */}
        <div className={cn('border-b border-border/40', maxCompletionTokensEnabled && 'pb-4')}>
          <div className="flex items-center justify-between py-4">
            <SettingLabel
              label="最大 Token 数"
              tooltip="模型单次回复的最大 Token 数量。关闭时使用模型默认值。"
            />
            <div className="flex items-center gap-3">
              {maxCompletionTokensEnabled && (
                <span className="font-mono text-xs text-muted-foreground">
                  {maxCompletionTokensValue}
                </span>
              )}
              <Switch
                checked={maxCompletionTokensEnabled}
                onCheckedChange={(checked) =>
                  onCommit('maxCompletionTokensEnabled', String(checked))
                }
              />
            </div>
          </div>
          {maxCompletionTokensEnabled && (
            <div>
              <Slider
                min={256}
                max={128000}
                step={256}
                value={[maxCompletionTokensValue]}
                onValueChange={([v]) => onChange('maxCompletionTokens', v.toString())}
                onValueCommit={([v]) => onCommit('maxCompletionTokens', v.toString())}
              />
              <SliderMarks marks={['256', '32K', '64K', '96K', '128K']} />
            </div>
          )}
        </div>

        {/* 流式输出 */}
        <div className="flex items-center justify-between py-4">
          <span className="text-sm">流式输出</span>
          <Switch
            checked={streaming}
            onCheckedChange={(checked) => onCommit('streaming', String(checked))}
          />
        </div>

        {/* 重置按钮 */}
        <div className="flex justify-end border-t border-border/40 py-3">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-1.5 text-sm text-red-500 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10">
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </button>
        </div>
      </div>

      {/* 系统提示词卡片 */}
      <div className="rounded-xl border bg-card/50 p-5">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          系统提示词
        </h3>
        <Textarea
          rows={6}
          value={formState.systemPrompt}
          onChange={(e) => onChange('systemPrompt', e.target.value)}
          onBlur={(e) => onCommit('systemPrompt', e.target.value)}
          placeholder="你是一个有用的助手..."
        />
        <p className="mt-1.5 text-xs text-muted-foreground">用于引导模型行为的系统级提示词。</p>
      </div>
    </div>
  )
}
