import { ProviderList } from './ProviderList'
import { ProviderDetail } from './ProviderDetail'

export function ProviderSection(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <ProviderList />
      <ProviderDetail />
    </div>
  )
}
