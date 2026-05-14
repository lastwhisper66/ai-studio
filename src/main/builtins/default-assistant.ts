export interface BuiltinDefaultAssistant {
  id: string
  name: string
  description: string
  isDefault: true
  sortOrder: number
}

export const DEFAULT_ASSISTANT: BuiltinDefaultAssistant = {
  id: 'default-assistant',
  name: '默认助手',
  description: '使用全局设置的通用 AI 助手',
  isDefault: true,
  sortOrder: -1,
}
