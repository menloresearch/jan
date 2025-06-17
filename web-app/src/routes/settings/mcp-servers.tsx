import { createFileRoute } from '@tanstack/react-router'

// Function to mask sensitive values
const maskSensitiveValue = (value: string) => {
  if (!value) return value
  if (value.length <= 8) return '*'.repeat(value.length)
  return value.slice(0, 4) + '*'.repeat(value.length - 8) + value.slice(-4)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute('/settings/mcp-servers' as any)({
  component: MCPServers,
})

function MCPServers() {
  // MCP functionality is disabled
  return (
    <div className="flex flex-col h-full">
      <HeaderPage>
        <h1 className="font-medium">{t('common.settings')}</h1>
      </HeaderPage>
      <div className="flex h-full w-full">
        <SettingsMenu />
        <div className="p-4 w-full h-[calc(100%-32px)] overflow-y-auto">
          <div className="flex flex-col justify-between gap-4 gap-y-3 w-full">
            <Card
              header={
                <div className="flex flex-col mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h1 className="text-main-view-fg font-medium text-base">
                        MCP Servers
                      </h1>
                      <div className="text-xs bg-main-view-fg/10 border border-main-view-fg/20 text-main-view-fg/70 rounded-full py-0.5 px-2">
                        <span>Experimental</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                      <div
                        className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out"
                        onClick={() => handleOpenJsonEditor()}
                        title="Edit All Servers JSON"
                      >
                        <IconCodeCircle
                          size={18}
                          className="text-main-view-fg/50"
                        />
                      </div>
                      <div
                        className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out"
                        onClick={() => handleOpenDialog()}
                        title="Add Server"
                      >
                        <IconPlus size={18} className="text-main-view-fg/50" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-main-view-fg/70 mt-1">
                    Find more MCP servers at{' '}
                    <a
                      href="https://mcp.so/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      mcp.so
                    </a>
                  </p>
                </div>
              }
            >
              <CardItem
                title="Allow All MCP Tool Permissions"
                description="When enabled, all MCP tool calls will be automatically
                      approved without showing permission dialogs."
                actions={
                  <div className="flex-shrink-0 ml-4">
                    <Switch
                      checked={allowAllMCPPermissions}
                      onCheckedChange={setAllowAllMCPPermissions}
                    />
                  </div>
                }
              />
            </Card>

            {Object.keys(mcpServers).length === 0 ? (
              <div className="py-4 text-center font-medium text-main-view-fg/50">
                No MCP servers found
              </div>
            ) : (
              Object.entries(mcpServers).map(([key, config], index) => (
                <Card key={`${key}-${index}`}>
                  <CardItem
                    align="start"
                    title={
                      <div className="flex items-center gap-x-2">
                        <div
                          className={twMerge(
                            'size-2 rounded-full',
                            connectedServers.includes(key)
                              ? 'bg-accent'
                              : 'bg-main-view-fg/50'
                          )}
                        />
                        <h1 className="text-main-view-fg text-base capitalize">
                          {key}
                        </h1>
                      </div>
                    }
                    description={
                      <div className="text-sm text-main-view-fg/70">
                        <div>Command: {config.command}</div>
                        <div className="my-1 break-all">
                          Args: {config?.args?.join(', ')}
                        </div>
                        {config.env && Object.keys(config.env).length > 0 && (
                          <div className="break-all">
                            Env:{' '}
                            {Object.entries(config.env)
                              .map(
                                ([key, value]) =>
                                  `${key}=${maskSensitiveValue(value)}`
                              )
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    }
                    actions={
                      <div className="flex items-center gap-0.5">
                        <div
                          className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out"
                          onClick={() => handleOpenJsonEditor(key)}
                          title="Edit JSON"
                        >
                          <IconCodeCircle
                            size={18}
                            className="text-main-view-fg/50"
                          />
                        </div>
                        <div
                          className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out"
                          onClick={() => handleEdit(key)}
                          title="Edit Server"
                        >
                          <IconPencil
                            size={18}
                            className="text-main-view-fg/50"
                          />
                        </div>
                        <div
                          className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out"
                          onClick={() => handleDeleteClick(key)}
                          title="Delete Server"
                        >
                          <IconTrash
                            size={18}
                            className="text-main-view-fg/50"
                          />
                        </div>
                        <div className="ml-2">
                          <Switch
                            checked={config.active}
                            loading={!!loadingServers[key]}
                            onCheckedChange={(checked) =>
                              toggleServer(key, checked)
                            }
                          />
                        </div>
                      </div>
                    }
                  />
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Use the AddEditMCPServer component */}
      <AddEditMCPServer
        open={open}
        onOpenChange={setOpen}
        editingKey={editingKey}
        initialData={currentConfig}
        onSave={handleSaveServer}
      />

      {/* Delete confirmation dialog */}
      <DeleteMCPServerConfirm
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        serverName={serverToDelete || ''}
        onConfirm={handleConfirmDelete}
      />

      {/* JSON editor dialog */}
      <EditJsonMCPserver
        open={jsonEditorOpen}
        onOpenChange={setJsonEditorOpen}
        serverName={jsonServerName}
        initialData={
          jsonEditorData as MCPServerConfig | Record<string, MCPServerConfig>
        }
        onSave={handleSaveJson}
      />
    </div>
  )
}

// All MCP-related code has been commented out since MCP functionality is disabled
