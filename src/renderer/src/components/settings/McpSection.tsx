import { McpServerList } from './McpServerList'
import { McpServerDetail } from './McpServerDetail'

export function McpSection(): React.JSX.Element {
  return (
    <div className="flex h-full min-w-0 flex-1">
      <McpServerList />
      <McpServerDetail />
    </div>
  )
}
