import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'

export function AppLayout(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <ChatPanel />
    </div>
  )
}
