import { isDev } from '@/lib/utils'
import { check, Update } from '@tauri-apps/plugin-updater'
import { useState, useCallback, useEffect } from 'react'
import { events, AppEvent } from '@janhq/core'
import { emit } from '@tauri-apps/api/event'
import { SystemEvent } from '@/types/events'
import { stopAllModels } from '@/services/models'

// Type declaration for Tauri API
declare global {
  interface Window {
    __TAURI__?: {
      process?: {
        relaunch?: () => Promise<void>
      }
    }
  }
}

export interface UpdateState {
  isUpdateAvailable: boolean
  updateInfo: Update | null
  isDownloading: boolean
  downloadProgress: number
  downloadedBytes: number
  totalBytes: number
  remindMeLater: boolean
}

export const useAppUpdater = () => {
  const [updateState, setUpdateState] = useState<UpdateState>({
    isUpdateAvailable: false,
    updateInfo: null,
    isDownloading: false,
    downloadProgress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    remindMeLater: false,
  })

  // Listen for app update state sync events
  useEffect(() => {
    const handleUpdateStateSync = (newState: Partial<UpdateState>) => {
      setUpdateState((prev) => ({
        ...prev,
        ...newState,
      }))
    }

    events.on('onAppUpdateStateSync', handleUpdateStateSync)

    return () => {
      events.off('onAppUpdateStateSync', handleUpdateStateSync)
    }
  }, [])

  const syncStateToOtherInstances = useCallback(
    (partialState: Partial<UpdateState>) => {
      // Emit event to sync state across all useAppUpdater instances
      events.emit('onAppUpdateStateSync', partialState)
    },
    []
  )

  const checkForUpdate = useCallback(
    async (resetRemindMeLater = false) => {
      try {
        // Reset remindMeLater if requested (e.g., when called from settings)
        if (resetRemindMeLater) {
          const newState = {
            remindMeLater: false,
          }
          setUpdateState((prev) => ({
            ...prev,
            ...newState,
          }))
          // Sync to other instances
          syncStateToOtherInstances(newState)
        }

        if (!isDev()) {
          // Production mode - use actual Tauri updater
          const update = await check()

          if (update) {
            const newState = {
              isUpdateAvailable: true,
              remindMeLater: false,
              updateInfo: update,
            }
            setUpdateState((prev) => ({
              ...prev,
              ...newState,
            }))
            // Sync to other instances
            syncStateToOtherInstances(newState)
            console.log('Update available:', update.version)
            return update
          } else {
            // No update available - reset state
            const newState = {
              isUpdateAvailable: false,
              updateInfo: null,
            }
            setUpdateState((prev) => ({
              ...prev,
              ...newState,
            }))
            // Sync to other instances
            syncStateToOtherInstances(newState)
            return null
          }
        } else {
          const newState = {
            isUpdateAvailable: false,
            updateInfo: null,
            ...(resetRemindMeLater && { remindMeLater: false }),
          }
          setUpdateState((prev) => ({
            ...prev,
            ...newState,
          }))
          // Sync to other instances
          syncStateToOtherInstances(newState)
          return null
        }
      } catch (error) {
        console.error('Error checking for updates:', error)
        // Reset state on error
        const newState = {
          isUpdateAvailable: false,
          updateInfo: null,
        }
        setUpdateState((prev) => ({
          ...prev,
          ...newState,
        }))
        // Sync to other instances
        syncStateToOtherInstances(newState)
        return null
      }
    },
    [syncStateToOtherInstances]
  )

  const setRemindMeLater = useCallback(
    (remind: boolean) => {
      const newState = {
        remindMeLater: remind,
      }
      setUpdateState((prev) => ({
        ...prev,
        ...newState,
      }))
      // Sync to other instances
      syncStateToOtherInstances(newState)
    },
    [syncStateToOtherInstances]
  )

  const downloadAndInstallUpdate = useCallback(async () => {
    if (!updateState.updateInfo) return

    try {
      setUpdateState((prev) => ({
        ...prev,
        isDownloading: true,
      }))

      let downloaded = 0
      let contentLength = 0
      let isDownloadComplete = false
      await stopAllModels()
      emit(SystemEvent.KILL_SIDECAR)
      await new Promise((resolve) => setTimeout(resolve, 1000))

      await updateState.updateInfo.downloadAndInstall((event) => {
        // Prevent processing events after download is complete
        if (isDownloadComplete) {
          console.log('Ignoring event after download completion:', event.event)
          return
        }

        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0
            setUpdateState((prev) => ({
              ...prev,
              totalBytes: contentLength,
            }))
            console.log(`Started downloading ${contentLength} bytes`)

            // Emit app update download started event
            events.emit(AppEvent.onAppUpdateDownloadUpdate, {
              progress: 0,
              downloadedBytes: 0,
              totalBytes: contentLength,
            })
            break
          case 'Progress': {
            downloaded += event.data.chunkLength
            const progress = contentLength > 0 ? downloaded / contentLength : 0
            setUpdateState((prev) => ({
              ...prev,
              downloadProgress: progress,
              downloadedBytes: downloaded,
            }))
            console.log(`Downloaded ${downloaded} from ${contentLength}`)

            // Emit app update download progress event
            events.emit(AppEvent.onAppUpdateDownloadUpdate, {
              progress: progress,
              downloadedBytes: downloaded,
              totalBytes: contentLength,
            })
            break
          }
          case 'Finished':
            isDownloadComplete = true
            console.log('Download finished - setting completion flag')
            setUpdateState((prev) => ({
              ...prev,
              isDownloading: false,
              downloadProgress: 1,
            }))

            // Emit app update download success event
            events.emit(AppEvent.onAppUpdateDownloadSuccess, {})
            break
        }
      })

      // Platform-specific relaunch handling for Linux AppImage
      try {
        // Check if we're on Linux (AppImage has specific requirements)
        const isLinux = navigator.userAgent.toLowerCase().includes('linux')

        if (isLinux) {
          console.log(
            'Linux platform detected, using delayed relaunch for AppImage'
          )
          // Give the system more time to complete the AppImage update process
          await new Promise((resolve) => setTimeout(resolve, 3000))

          // Try multiple relaunch methods for Linux
          try {
            await window.core?.api?.relaunch()
          } catch (primaryRelaunchError) {
            console.warn(
              'Primary relaunch failed, trying alternative method:',
              primaryRelaunchError
            )

            // Alternative relaunch using Tauri's process API
            if (window.__TAURI__?.process?.relaunch) {
              await window.__TAURI__.process.relaunch()
            } else {
              throw new Error('No relaunch method available')
            }
          }
        } else {
          // Windows and macOS - use standard relaunch
          await window.core?.api?.relaunch()
        }

        console.log('Update installed and app relaunched')
      } catch (relaunchError) {
        console.error('Error during relaunch:', relaunchError)

        // For Linux AppImage, the update might have succeeded even if relaunch failed
        const isLinux = navigator.userAgent.toLowerCase().includes('linux')
        if (isLinux) {
          console.log(
            'Linux AppImage update completed, but automatic restart failed'
          )

          // Ensure download state is properly reset
          setUpdateState((prev) => ({
            ...prev,
            isDownloading: false,
            downloadProgress: 1,
          }))

          // Don't treat this as a download error - the update was successful
          events.emit(AppEvent.onAppUpdateDownloadSuccess, {})

          // Show a different message for manual restart
          setTimeout(() => {
            events.emit(AppEvent.onAppUpdateDownloadError, {
              message:
                'Update downloaded successfully! Please restart the application manually to complete the update.',
            })
          }, 1000)
          return
        } else {
          // For other platforms, relaunch failure is a real error
          throw relaunchError
        }
      }

      console.log('Update installed')
    } catch (error) {
      console.error('Error downloading update:', error)
      setUpdateState((prev) => ({
        ...prev,
        isDownloading: false,
      }))

      // Emit app update download error event
      events.emit(AppEvent.onAppUpdateDownloadError, {
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [updateState.updateInfo])

  return {
    updateState,
    checkForUpdate,
    downloadAndInstallUpdate,
    setRemindMeLater,
  }
}
