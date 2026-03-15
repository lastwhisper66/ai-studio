import { useEffect } from 'react'
import { useAssistantStore } from '@renderer/stores/assistantStore'
import { AssistantList } from './AssistantList'
import { AssistantEditor } from './AssistantEditor'

export function AssistantsPage(): React.JSX.Element {
  const loadAssistants = useAssistantStore((s) => s.loadAssistants)

  useEffect(() => {
    loadAssistants()
  }, [loadAssistants])

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b px-6">
        <h1 className="text-base font-semibold">助手</h1>
      </div>

      {/* Two-column layout */}
      <div className="flex min-h-0 flex-1">
        <AssistantList />
        <AssistantEditor />
      </div>
    </div>
  )
}
