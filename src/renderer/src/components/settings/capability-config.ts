import { Brain, Eye, Globe, Wrench } from 'lucide-react'
import type { ModelCapability } from '@shared/types'

export const CAPABILITY_CONFIG: Record<
  ModelCapability,
  {
    labelKey: string
    color: string
    icon: React.FC<{ className?: string; style?: React.CSSProperties }>
  }
> = {
  reasoning: { labelKey: 'modelManage.cap.reasoning', color: '#3b82f6', icon: Brain },
  vision: { labelKey: 'modelManage.cap.vision', color: '#22c55e', icon: Eye },
  web: { labelKey: 'modelManage.cap.web', color: '#06b6d4', icon: Globe },
  tools: { labelKey: 'modelManage.cap.tools', color: '#ef4444', icon: Wrench },
}

/** Primary capabilities for filter tabs */
export const ALL_CAPABILITIES: ModelCapability[] = ['reasoning', 'vision', 'web', 'tools']

/** Full capability list for AddModelDialog picker */
export const FULL_CAPABILITIES: ModelCapability[] = ['reasoning', 'vision', 'web', 'tools']
