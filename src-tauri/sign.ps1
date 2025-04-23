param (
  [string]$Target
)

Write-Host "=== DEBUG: Environment Variables ==="
Write-Host "AZURE_CERT_NAME     = $env:AZURE_CERT_NAME"
Write-Host "Target File         = $Target"
Write-Host "====================================="

AzureSignTool-x64.exe sign `
  -tr http://timestamp.digicert.com `
  -kvu $env:AZURE_KEY_VAULT_URI `
  -kvi $env:AZURE_CLIENT_ID `
  -kvt $env:AZURE_TENANT_ID `
  -kvs $env:AZURE_CLIENT_SECRET `
  -kvc $env:AZURE_CERT_NAME `
  -v $Target