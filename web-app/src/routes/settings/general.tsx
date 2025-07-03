import { createFileRoute } from '@tanstack/react-router'
import { route } from '@/constants/routes'
import SettingsMenu from '@/containers/SettingsMenu'
import HeaderPage from '@/containers/HeaderPage'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Card, CardItem } from '@/containers/Card'
import LanguageSwitcher from '@/containers/LanguageSwitcher'
import { useTranslation } from '@/i18n/react-i18next-compat'
import { useGeneralSetting } from '@/hooks/useGeneralSetting'
import { useAppUpdater } from '@/hooks/useAppUpdater'
import { useEffect, useState, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import ChangeDataFolderLocation from '@/containers/dialogs/ChangeDataFolderLocation'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  factoryReset,
  getJanDataFolder,
} from '@/services/app'
import {
  validateFactoryResetFolder,
  changeAppDataFolderWithValidation,
} from '@/services/validation'
import ValidationDialog from '@/containers/dialogs/ValidationDialog'
import {
  IconBrandDiscord,
  IconBrandGithub,
  IconExternalLink,
  IconFolder,
  IconLogs,
  IconCopy,
  IconCopyCheck,
} from '@tabler/icons-react'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { windowKey } from '@/constants/windows'
import { toast } from 'sonner'
import { isDev } from '@/lib/utils'
import { emit } from '@tauri-apps/api/event'
import { stopAllModels } from '@/services/models'
import { SystemEvent } from '@/types/events'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Route = createFileRoute(route.settings.general as any)({
  component: General,
})

function General() {
  const { t } = useTranslation()
  const {
    spellCheckChatInput,
    setSpellCheckChatInput,
    experimentalFeatures,
    setExperimentalFeatures,
  } = useGeneralSetting()

  const openFileTitle = (): string => {
    if (IS_MACOS) {
      return t('settings:general.showInFinder')
    } else if (IS_WINDOWS) {
      return t('settings:general.showInFileExplorer')
    } else {
      return t('settings:general.openContainingFolder')
    }
  }
  const { checkForUpdate } = useAppUpdater()
  const [janDataFolder, setJanDataFolder] = useState<string | undefined>()
  const [isCopied, setIsCopied] = useState(false)
  const [selectedNewPath, setSelectedNewPath] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  
  // Validation states
  interface FolderValidationResult {
    is_valid_jan_folder: boolean
    is_empty: boolean
    has_important_data: boolean
    jan_specific_files: string[]
    folder_size_mb: number
    permissions_ok: boolean
    error_message?: string
    warnings: string[]
  }
  
  const [factoryResetValidation, setFactoryResetValidation] = useState<FolderValidationResult | null>(null)
  const [showFactoryResetValidation, setShowFactoryResetValidation] = useState(false)
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    const fetchDataFolder = async () => {
      const path = await getJanDataFolder()
      setJanDataFolder(path)
    }

    fetchDataFolder()
  }, [])

  const resetApp = async () => {
    try {
      setIsValidating(true)
      const validation = await validateFactoryResetFolder()
      setFactoryResetValidation(validation)
      setShowFactoryResetValidation(true)
    } catch (error) {
      console.error('Failed to validate factory reset:', error)
      toast.error('Failed to validate factory reset. Please try again.')
    } finally {
      setIsValidating(false)
    }
  }

  const confirmFactoryReset = async () => {
    try {
      setShowFactoryResetValidation(false)
      await factoryReset(false) // Don't skip validation
    } catch (error) {
      console.error('Factory reset failed:', error)
      toast.error('Factory reset failed. Please try again.')
    }
  }

  const handleOpenLogs = async () => {
    try {
      // Check if logs window already exists
      const existingWindow = await WebviewWindow.getByLabel(
        windowKey.logsAppWindow
      )

      if (existingWindow) {
        // If window exists, focus it
        await existingWindow.setFocus()
        console.log('Focused existing logs window')
      } else {
        // Create a new logs window using Tauri v2 WebviewWindow API
        const logsWindow = new WebviewWindow(windowKey.logsAppWindow, {
          url: route.appLogs,
          title: 'App Logs - Jan',
          width: 800,
          height: 600,
          resizable: true,
          center: true,
        })

        // Listen for window creation
        logsWindow.once('tauri://created', () => {
          console.log('Logs window created')
        })

        // Listen for window errors
        logsWindow.once('tauri://error', (e) => {
          console.error('Error creating logs window:', e)
        })
      }
    } catch (error) {
      console.error('Failed to open logs window:', error)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000) // Reset after 2 seconds
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const handleDataFolderChange = async () => {
    const selectedPath = await open({
      multiple: false,
      directory: true,
      defaultPath: janDataFolder,
    })

    if (selectedPath === janDataFolder) return
    if (selectedPath !== null) {
      try {
        await stopAllModels()
        emit(SystemEvent.KILL_SIDECAR)
        setTimeout(async () => {
          try {
            // Use integrated validation - this will validate and change the folder in one operation
            await changeAppDataFolderWithValidation(selectedPath, false)
            setJanDataFolder(selectedPath)
            // Only relaunch if relocation was successful
            window.core?.api?.relaunch()
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : t('settings:general.failedToRelocateDataFolder')
            )
            // Revert the data folder path on error
            const originalPath = await getJanDataFolder()
            setJanDataFolder(originalPath)
          }
        }, 1000)
      } catch (error) {
        console.error('Failed to relocate data folder:', error)
        toast.error(t('settings:general.failedToRelocateDataFolderDesc'))
      }
    }
  }

  const handleCheckForUpdate = useCallback(async () => {
    setIsCheckingUpdate(true)
    try {
      if (isDev()) return toast.info(t('settings:general.devVersion'))
      const update = await checkForUpdate(true)
      if (!update) {
        toast.info(t('settings:general.noUpdateAvailable'))
      }
      // If update is available, the AppUpdater dialog will automatically show
    } catch (error) {
      console.error('Failed to check for updates:', error)
      toast.error(t('settings:general.updateError'))
    } finally {
      setIsCheckingUpdate(false)
    }
  }, [t, checkForUpdate])

  return (
    <div className="flex flex-col h-full">
      <HeaderPage>
        <h1 className="font-medium">{t('common:settings')}</h1>
      </HeaderPage>
      <div className="flex h-full w-full flex-col sm:flex-row">
        <SettingsMenu />
        <div className="p-4 w-full h-[calc(100%-32px)] overflow-y-auto">
          <div className="flex flex-col justify-between gap-4 gap-y-3 w-full">
            {/* General */}
            <Card title={t('common:general')}>
              <CardItem
                title={t('settings:general.appVersion')}
                actions={
                  <span className="text-main-view-fg/80 font-medium">
                    v{VERSION}
                  </span>
                }
              />
              <CardItem
                title={t('settings:general.checkForUpdates')}
                description={t('settings:general.checkForUpdatesDesc')}
                className="flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-y-2"
                actions={
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0"
                    onClick={handleCheckForUpdate}
                    disabled={isCheckingUpdate}
                  >
                    <div className="cursor-pointer rounded-sm hover:bg-main-view-fg/15 bg-main-view-fg/10 transition-all duration-200 ease-in-out px-2 py-1 gap-1">
                      {isCheckingUpdate
                        ? t('settings:general.checkingForUpdates')
                        : t('settings:general.checkForUpdates')}
                    </div>
                  </Button>
                }
              />
              <CardItem
                title={t('common:language')}
                actions={<LanguageSwitcher />}
              />
            </Card>

            {/* Advanced */}
            <Card title="Advanced">
              <CardItem
                title="Experimental Features"
                description="Enable experimental features. They may be unstable or change at any time."
                actions={
                  <Switch
                    checked={experimentalFeatures}
                    onCheckedChange={(e) => setExperimentalFeatures(e)}
                  />
                }
              />
            </Card>

            {/* Data folder */}
            <Card title={t('common:dataFolder')}>
              <CardItem
                title={t('settings:dataFolder.appData', {
                  ns: 'settings',
                })}
                align="start"
                className="flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-y-2"
                description={
                  <>
                    <span>
                      {t('settings:dataFolder.appDataDesc', {
                        ns: 'settings',
                      })}
                      &nbsp;
                    </span>
                    <div className="flex items-center gap-2 mt-1 ">
                      <div className="">
                        <span
                          title={janDataFolder}
                          className="bg-main-view-fg/10 text-xs px-1 py-0.5 rounded-sm text-main-view-fg/80 line-clamp-1 w-fit"
                        >
                          {janDataFolder}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          janDataFolder && copyToClipboard(janDataFolder)
                        }
                        className="cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/15 bg-main-view-fg/10 transition-all duration-200 ease-in-out p-1"
                        title={
                          isCopied
                            ? t('settings:general.copied')
                            : t('settings:general.copyPath')
                        }
                      >
                        {isCopied ? (
                          <div className="flex items-center gap-1">
                            <IconCopyCheck size={12} className="text-accent" />
                            <span className="text-xs leading-0">
                              {t('settings:general.copied')}
                            </span>
                          </div>
                        ) : (
                          <IconCopy
                            size={12}
                            className="text-main-view-fg/50"
                          />
                        )}
                      </button>
                    </div>
                  </>
                }
                actions={
                  <>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0"
                      title={t('settings:dataFolder.appData')}
                      onClick={handleDataFolderChange}
                    >
                      <div className="cursor-pointer flex items-center justify-center rounded-sm hover:bg-main-view-fg/15 bg-main-view-fg/10 transition-all duration-200 ease-in-out px-2 py-1 gap-1">
                        <IconFolder
                          size={12}
                          className="text-main-view-fg/50"
                        />
                        <span>{t('settings:general.changeLocation')}</span>
                      </div>
                    </Button>
                    {selectedNewPath && (
                      <ChangeDataFolderLocation
                        currentPath={janDataFolder || ''}
                        newPath={selectedNewPath}
                        onConfirm={handleDataFolderChange}
                        open={isDialogOpen}
                        onOpenChange={(open) => {
                          setIsDialogOpen(open)
                          if (!open) {
                            setSelectedNewPath(null)
                          }
                        }}
                      >
                        <div />
                      </ChangeDataFolderLocation>
                    )}
                  </>
                }
              />
              <CardItem
                title={t('settings:dataFolder.appLogs', {
                  ns: 'settings',
                })}
                description={t('settings:dataFolder.appLogsDesc')}
                className="flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-y-2"
                actions={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0"
                      onClick={handleOpenLogs}
                      title={t('settings:dataFolder.appLogs')}
                    >
                      <div className="cursor-pointer flex items-center justify-center rounded-sm hover:bg-main-view-fg/15 bg-main-view-fg/10 transition-all duration-200 ease-in-out px-2 py-1 gap-1">
                        <IconLogs size={12} className="text-main-view-fg/50" />
                        <span>{t('settings:general.openLogs')}</span>
                      </div>
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0"
                      onClick={async () => {
                        if (janDataFolder) {
                          try {
                            const logsPath = `${janDataFolder}/logs`
                            await revealItemInDir(logsPath)
                          } catch (error) {
                            console.error(
                              'Failed to reveal logs folder:',
                              error
                            )
                          }
                        }
                      }}
                      title={t('settings:general.revealLogs')}
                    >
                      <div className="cursor-pointer flex items-center justify-center rounded-sm hover:bg-main-view-fg/15 bg-main-view-fg/10 transition-all duration-200 ease-in-out px-2 py-1 gap-1">
                        <IconFolder
                          size={12}
                          className="text-main-view-fg/50"
                        />
                        <span>{openFileTitle()}</span>
                      </div>
                    </Button>
                  </div>
                }
              />
            </Card>

            {/* Other */}
            <Card title={t('common:others')}>
              <CardItem
                title={t('settings:others.spellCheck', {
                  ns: 'settings',
                })}
                description={t('settings:others.spellCheckDesc', {
                  ns: 'settings',
                })}
                actions={
                  <Switch
                    checked={spellCheckChatInput}
                    onCheckedChange={(e) => setSpellCheckChatInput(e)}
                  />
                }
              />
              <CardItem
                title={t('settings:others.resetFactory', {
                  ns: 'settings',
                })}
                description={t('settings:others.resetFactoryDesc', {
                  ns: 'settings',
                })}
                actions={
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        {t('common:reset')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {t('settings:general.factoryResetTitle')}
                        </DialogTitle>
                        <DialogDescription>
                          {t('settings:general.factoryResetDesc')}
                        </DialogDescription>
                        <DialogFooter className="mt-2 flex items-center">
                          <DialogClose asChild>
                            <Button
                              variant="link"
                              size="sm"
                              className="hover:no-underline"
                            >
                              {t('settings:general.cancel')}
                            </Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button
                              variant="destructive"
                              onClick={() => resetApp()}
                            >
                              {t('settings:general.reset')}
                            </Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogHeader>
                    </DialogContent>
                  </Dialog>
                }
              />
            </Card>

            {/* Resources */}
            <Card title={t('settings:general.resources')}>
              <CardItem
                title={t('settings:general.documentation')}
                description={t('settings:general.documentationDesc')}
                actions={
                  <a
                    href="https://jan.ai/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="flex items-center gap-1">
                      <span>{t('settings:general.viewDocs')}</span>
                      <IconExternalLink size={14} />
                    </div>
                  </a>
                }
              />
              <CardItem
                title={t('settings:general.releaseNotes')}
                description={t('settings:general.releaseNotesDesc')}
                actions={
                  <a
                    href="https://github.com/menloresearch/jan/releases"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="flex items-center gap-1">
                      <span>{t('settings:general.viewReleases')}</span>
                      <IconExternalLink size={14} />
                    </div>
                  </a>
                }
              />
            </Card>

            {/* Community */}
            <Card title={t('settings:general.community')}>
              <CardItem
                title={t('settings:general.github')}
                description={t('settings:general.githubDesc')}
                actions={
                  <a
                    href="https://github.com/menloresearch/jan"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/15 bg-main-view-fg/10 transition-all duration-200 ease-in-out">
                      <IconBrandGithub
                        size={18}
                        className="text-main-view-fg/50"
                      />
                    </div>
                  </a>
                }
              />
              <CardItem
                title={t('settings:general.discord')}
                description={t('settings:general.discordDesc')}
                actions={
                  <a
                    href="https://discord.com/invite/FTk2MvZwJH"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/15 bg-main-view-fg/10 transition-all duration-200 ease-in-out">
                      <IconBrandDiscord
                        size={18}
                        className="text-main-view-fg/50"
                      />
                    </div>
                  </a>
                }
              />
            </Card>

            {/* Support */}
            <Card title={t('settings:general.support')}>
              <CardItem
                title={t('settings:general.reportAnIssue')}
                description={t('settings:general.reportAnIssueDesc')}
                actions={
                  <a
                    href="https://github.com/menloresearch/jan/issues/new"
                    target="_blank"
                  >
                    <div className="flex items-center gap-1">
                      <span>{t('settings:general.reportIssue')}</span>
                      <IconExternalLink size={14} />
                    </div>
                  </a>
                }
              />
            </Card>

            {/* Credits */}
            <Card title={t('settings:general.credits')}>
              <CardItem
                align="start"
                description={
                  <div className="text-main-view-fg/70 -mt-2">
                    <p>{t('settings:general.creditsDesc1')}</p>
                    <p className="mt-2">{t('settings:general.creditsDesc2')}</p>
                  </div>
                }
              />
            </Card>
          </div>
        </div>
      </div>

      {/* Validation Dialogs */}
      <ValidationDialog
        open={showFactoryResetValidation}
        onOpenChange={setShowFactoryResetValidation}
        title="Factory Reset Validation"
        description="Please review the validation results before proceeding with factory reset."
        validation={factoryResetValidation}
        onConfirm={confirmFactoryReset}
        onCancel={() => setShowFactoryResetValidation(false)}
        confirmText="Reset to Factory Settings"
        cancelText="Cancel"
        loading={isValidating}
      />

    </div>
  )
}
