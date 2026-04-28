import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { McpServer, McpServerStatus, McpResource, McpPrompt } from '@shared/types'
import type { UpsertMcpToolData } from '../db/mcp-tools'

export interface McpClientEvents {
  onStatusChange: (status: McpServerStatus, error?: string) => void
  onToolsChanged: (tools: UpsertMcpToolData[]) => void
  onResourcesChanged: (resources: McpResource[]) => void
  onPromptsChanged: (prompts: McpPrompt[]) => void
}

export class McpClientWrapper {
  private client: Client | null = null
  private transport:
    | StdioClientTransport
    | SSEClientTransport
    | StreamableHTTPClientTransport
    | null = null
  private _status: McpServerStatus = 'disconnected'

  constructor(
    private server: McpServer,
    private events: McpClientEvents,
  ) {}

  get status(): McpServerStatus {
    return this._status
  }

  get serverId(): string {
    return this.server.id
  }

  private setStatus(status: McpServerStatus, error?: string): void {
    this._status = status
    this.events.onStatusChange(status, error)
  }

  async connect(): Promise<void> {
    if (this._status === 'connected' || this._status === 'connecting') return

    this.setStatus('connecting')

    try {
      this.transport = this.createTransport()
      this.client = new Client({ name: 'ai-studio', version: '1.0.0' })

      this.transport.onclose = (): void => {
        this.setStatus('disconnected')
      }
      this.transport.onerror = (err: Error): void => {
        this.setStatus('error', err.message)
      }

      await this.client.connect(this.transport)
      this.setStatus('connected')

      await this.refreshTools()
      await this.refreshResources()
      await this.refreshPrompts()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.setStatus('error', message)
      throw err
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client?.close()
    } catch {
      // ignore close errors
    }
    this.client = null
    this.transport = null
    this.setStatus('disconnected')
  }

  async reconnect(): Promise<void> {
    await this.disconnect()
    await this.connect()
  }

  async refreshTools(): Promise<UpsertMcpToolData[]> {
    if (!this.client || this._status !== 'connected') return []

    const result = await this.client.listTools()
    const tools: UpsertMcpToolData[] = result.tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema ?? {}) as Record<string, unknown>,
    }))

    this.events.onToolsChanged(tools)
    return tools
  }

  async refreshResources(): Promise<McpResource[]> {
    if (!this.client || this._status !== 'connected') return []

    try {
      const caps = this.client.getServerCapabilities()
      if (!caps?.resources) return []

      const result = await this.client.listResources()
      const resources: McpResource[] = result.resources.map((r) => ({
        uri: r.uri,
        name: r.name ?? r.uri,
        description: r.description,
        mimeType: r.mimeType,
        serverId: this.server.id,
        serverName: this.server.name,
      }))

      this.events.onResourcesChanged(resources)
      return resources
    } catch {
      return []
    }
  }

  async readResource(
    uri: string,
  ): Promise<{ uri: string; mimeType?: string; text?: string; blob?: string }> {
    if (!this.client || this._status !== 'connected') {
      throw new Error(`MCP server "${this.server.name}" is not connected`)
    }

    const result = await this.client.readResource({ uri })
    const content = result.contents[0]
    return {
      uri: content?.uri ?? uri,
      mimeType: content?.mimeType,
      text: 'text' in content ? (content.text as string) : undefined,
      blob: 'blob' in content ? (content.blob as string) : undefined,
    }
  }

  async refreshPrompts(): Promise<McpPrompt[]> {
    if (!this.client || this._status !== 'connected') return []

    try {
      const caps = this.client.getServerCapabilities()
      if (!caps?.prompts) return []

      const result = await this.client.listPrompts()
      const prompts: McpPrompt[] = result.prompts.map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments?.map((a) => ({
          name: a.name,
          description: a.description,
          required: a.required,
        })),
        serverId: this.server.id,
        serverName: this.server.name,
      }))

      this.events.onPromptsChanged(prompts)
      return prompts
    } catch {
      return []
    }
  }

  async getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<{ messages: Array<{ role: string; content: unknown }> }> {
    if (!this.client || this._status !== 'connected') {
      throw new Error(`MCP server "${this.server.name}" is not connected`)
    }

    const result = await this.client.getPrompt({ name, arguments: args })
    return {
      messages: result.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: unknown[]; isError?: boolean }> {
    if (!this.client || this._status !== 'connected') {
      throw new Error(`MCP server "${this.server.name}" is not connected`)
    }

    const result = await this.client.callTool({ name, arguments: args })
    return {
      content: result.content as unknown[],
      isError: result.isError === true,
    }
  }

  private createTransport():
    | StdioClientTransport
    | SSEClientTransport
    | StreamableHTTPClientTransport {
    switch (this.server.type) {
      case 'stdio':
        return new StdioClientTransport({
          command: this.server.command,
          args: this.server.args,
          env: {
            ...process.env,
            ...this.server.env,
          } as Record<string, string>,
          stderr: 'pipe',
        })
      case 'sse':
        return new SSEClientTransport(new URL(this.server.url), {
          requestInit: {
            headers: this.server.headers,
          },
        })
      case 'streamable-http':
        return new StreamableHTTPClientTransport(new URL(this.server.url), {
          requestInit: {
            headers: this.server.headers,
          },
        })
    }
  }
}
