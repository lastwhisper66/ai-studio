import type { McpTool } from '@shared/types'

export interface OpenAIFunctionTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export function mcpToolToOpenAIFunction(tool: McpTool, serverId: string): OpenAIFunctionTool {
  return {
    type: 'function',
    function: {
      name: `${serverId}__${tool.name}`,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }
}

export function mcpToolsToOpenAIFunctions(
  tools: { serverId: string; tool: McpTool }[],
): OpenAIFunctionTool[] {
  return tools.map(({ serverId, tool }) => mcpToolToOpenAIFunction(tool, serverId))
}

export function parseToolCallName(name: string): { serverId: string; toolName: string } | null {
  const idx = name.indexOf('__')
  if (idx === -1) return null
  return {
    serverId: name.slice(0, idx),
    toolName: name.slice(idx + 2),
  }
}
