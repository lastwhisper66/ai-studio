import { ProviderList } from './ProviderList'
import { ProviderDetail } from './ProviderDetail'

export function ProviderSection(): React.JSX.Element {
  return (
    <div className="flex h-full flex-1 min-w-0">
      <ProviderList />
      <ProviderDetail />
    </div>
  )
}
