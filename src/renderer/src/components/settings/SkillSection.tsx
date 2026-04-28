import { SkillList } from './SkillList'
import { SkillDetail } from './SkillDetail'

export function SkillSection(): React.JSX.Element {
  return (
    <div className="flex h-full min-w-0 flex-1">
      <SkillList />
      <SkillDetail />
    </div>
  )
}
