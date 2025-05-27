import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'

const VersionDropdown = () => {
  const router = useRouter()
  const asPath = router.asPath
  const isTauri =
    asPath.startsWith('/docs/tauri') ||
    asPath === '/docs' ||
    asPath === '/docs/'
  const currentVersion = isTauri ? 'tauri' : 'electron'

  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const versions = [
    { value: 'tauri', label: 'Tauri' },
    { value: 'electron', label: 'Electron' },
  ]

  const currentVersionLabel = versions.find(
    (v) => v.value === currentVersion
  )?.label

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleVersionChange = async (version: string) => {
    setIsOpen(false)
    if (version === 'electron') {
      await router.push('/docs/electron')
    } else {
      await router.push('/docs/tauri')
    }
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex justify-between items-center w-full px-4 py-1.5 text-sm font-medium border border-gray-300 rounded-md bg-white dark:bg-black dark:border-gray-900 text-gray-700 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors duration-200"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {currentVersionLabel}
        <svg
          className={`ml-2 h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-full origin-top-right rounded-md bg-white dark:bg-black shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-900 focus:outline-none">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {versions.map((version) => (
              <button
                key={version.value}
                onClick={() => handleVersionChange(version.value)}
                className={`block w-full px-4 py-2 text-left text-sm transition-colors duration-200 ${
                  currentVersion === version.value
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-100'
                }`}
                role="menuitem"
              >
                <div className="flex items-center justify-between">
                  {version.label}
                  {currentVersion === version.value && (
                    <svg
                      className="h-4 w-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default VersionDropdown
