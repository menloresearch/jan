import React from 'react'
import { useRouter } from 'next/router'

const VersionDropdown = () => {
  const router = useRouter()
  const asPath = router.asPath
  const isTauri =
    asPath.startsWith('/docs/tauri') ||
    asPath === '/docs' ||
    asPath === '/docs/'
  const currentVersion = isTauri ? 'tauri' : 'electron'

  return (
    <div className="relative inline-block text-left">
      <select
        value={currentVersion}
        onChange={async (e) => {
          const version = e.target.value
          if (version === 'electron') {
            await router.push('/docs/electron')
          } else {
            await router.push('/docs/tauri')
          }
        }}
        className="block w-full px-4 py-2 text-sm border border-gray-300 rounded-md bg-white dark:bg-gray-800 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="tauri">Tauri</option>
        <option value="electron">Electron</option>
      </select>
    </div>
  )
}

export default VersionDropdown
