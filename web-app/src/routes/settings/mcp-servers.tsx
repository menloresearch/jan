import { createFileRoute } from '@tanstack/react-router'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute('/settings/mcp-servers' as any)({
  component: MCPServers,
})

function MCPServers() {
  // MCP functionality is disabled
  return (
    <div className="p-4">
      <h1>MCP Servers</h1>
      <p>MCP functionality has been disabled.</p>
    </div>
  )
}

// All MCP-related code has been commented out since MCP functionality is disabled