/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createFileRoute,
  Link,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { route } from '@/constants/routes'
import { useModelSources } from '@/hooks/useModelSources'
import { cn, toGigabytes } from '@/lib/utils'
import { highlightFzfMatch } from '@/utils/highlight'
import { extractModelRepo } from '@/lib/models'
import {
  useState,
  useMemo,
  useEffect,
  ChangeEvent,
  useCallback,
  useRef,
} from 'react'
import debounce from 'lodash.debounce'
import { Fzf } from 'fzf'
import { Button } from '@/components/ui/button'
import { useModelProvider } from '@/hooks/useModelProvider'
import { Card, CardItem } from '@/containers/Card'
import { RenderMarkdown } from '@/containers/RenderMarkdown'
import { extractModelName, extractDescription } from '@/lib/models'
import { IconDownload, IconFileCode, IconSearch } from '@tabler/icons-react'
import { Switch } from '@/components/ui/switch'
import Joyride, { CallBackProps, STATUS } from 'react-joyride'
import { CustomTooltipJoyRide } from '@/containers/CustomeTooltipJoyRide'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { addModelSource, downloadModel, fetchModelHub } from '@/services/models'
import { useDownloadStore } from '@/hooks/useDownloadStore'
import { Progress } from '@/components/ui/progress'
import HeaderPage from '@/containers/HeaderPage'
import { Loader } from 'lucide-react'
import { useTranslation } from '@/i18n/react-i18next-compat'

type ModelProps = {
  model: {
    id: string
    metadata?: any
    models: {
      id: string
    }[]
  }
}
type SearchParams = {
  repo: string
}
const defaultModelQuantizations = ['iq4_xs.gguf', 'q4_k_m.gguf']

export const Route = createFileRoute(route.hub as any)({
  component: Hub,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    repo: search.repo as SearchParams['repo'],
  }),
})

function Hub() {
  const { t } = useTranslation()
  const sortOptions = [
    { value: 'newest', name: t('hub:sortNewest') },
    { value: 'most-downloaded', name: t('hub:sortMostDownloaded') },
  ]
  const { sources, fetchSources, loading } = useModelSources()
  const search = useSearch({ from: route.hub as any })
  const [searchValue, setSearchValue] = useState('')
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('')
  const [sortSelected, setSortSelected] = useState('newest')
  const [expandedModels, setExpandedModels] = useState<Record<string, boolean>>(
    {}
  )
  const [isSearching, setIsSearching] = useState(false)
  const [showOnlyDownloaded, setShowOnlyDownloaded] = useState(false)
  const [joyrideReady, setJoyrideReady] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const addModelSourceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const downloadButtonRef = useRef<HTMLButtonElement>(null)
  const hasTriggeredDownload = useRef(false)

  const { getProviderByName } = useModelProvider()
  const llamaProvider = getProviderByName('llama.cpp')

  // Debounce search for performance
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchValue(value)
    }, 300),
    []
  )

  useEffect(() => {
    debouncedSetSearch(searchValue)
    return () => {
      debouncedSetSearch.cancel()
    }
  }, [searchValue, debouncedSetSearch])

  const toggleModelExpansion = (modelId: string) => {
    setExpandedModels((prev) => ({
      ...prev,
      [modelId]: !prev[modelId],
    }))
  }

  useEffect(() => {
    if (search.repo) {
      setSearchValue(search.repo ?? '')
      setIsSearching(true)
      addModelSourceTimeoutRef.current = setTimeout(() => {
        addModelSource(search.repo)
          .then(() => {
            fetchSources()
          })
          .finally(() => {
            setIsSearching(false)
          })
      }, 500)
    }
  }, [fetchSources, search])

  // Sorting functionality
  const sortedModels = useMemo(() => {
    return [...sources].sort((a, b) => {
      if (sortSelected === 'most-downloaded') {
        return (b.metadata?.downloads || 0) - (a.metadata?.downloads || 0)
      } else {
        return (
          new Date(b.metadata?.createdAt || 0).getTime() -
          new Date(a.metadata?.createdAt || 0).getTime()
        )
      }
    })
  }, [sortSelected, sources])

  // Create searchable items for fzf
  const searchableItems = useMemo(() => {
    return sortedModels.map((source) => {
      const modelName = extractModelName(source.metadata?.id) ?? source.id
      // Extract repo format for searching with full URLs
      const repoFormat =
        extractModelRepo(source.metadata?.id) || source.metadata?.id || ''
      // Create full HF URL format for searching
      const fullUrl = source.metadata?.id
        ? `https://huggingface.co/${source.metadata.id}`
        : ''

      return {
        source,
        modelName,
        searchStr: `${modelName} ${source.id} ${source.metadata?.id || ''} ${repoFormat} ${fullUrl} ${source.models.map((m) => m.id).join(' ')}`,
      }
    })
  }, [sortedModels])

  // Use useRef to cache the Fzf instance for performance
  const fzfInstanceRef = useRef<Fzf<typeof searchableItems> | null>(null)
  const searchableItemsRef = useRef<typeof searchableItems>([])

  // Only recreate Fzf instance when searchableItems actually change
  useEffect(() => {
    if (searchableItemsRef.current !== searchableItems) {
      searchableItemsRef.current = searchableItems
      fzfInstanceRef.current = new Fzf(searchableItems, {
        selector: (item) => item.searchStr,
      })
    }
  }, [searchableItems])

  // Pre-compute downloaded model IDs for performance
  const downloadedModelIds = useMemo(() => {
    if (!llamaProvider?.models) return new Set<string>()
    return new Set(llamaProvider.models.map((m: { id: string }) => m.id))
  }, [llamaProvider?.models])

  // Filtered models using fzf with performance optimizations
  const filteredModels = useMemo(() => {
    let filtered = sortedModels

    // Apply search filter using fzf (debounced)
    if (debouncedSearchValue.length && fzfInstanceRef.current) {
      // Normalize search value - if it's a HuggingFace URL, extract the repo path
      const normalizedSearchValue = debouncedSearchValue.startsWith(
        'https://huggingface.co/'
      )
        ? extractModelRepo(debouncedSearchValue) || debouncedSearchValue
        : debouncedSearchValue

      const fzfResults = fzfInstanceRef.current.find(normalizedSearchValue)
      filtered = fzfResults.map((result: any) => {
        // Use FZF's built-in positions for more efficient highlighting
        const modelName = result.item.modelName
        const positions = Array.from(result.positions ?? []) as number[]

        // Map positions to model name positions (FZF positions are for the full search string)
        const modelNamePositions = positions.filter(
          (pos: number) => pos < modelName.length
        )

        const highlightedModelName = highlightFzfMatch(
          modelName,
          modelNamePositions,
          'text-accent'
        )

        return {
          ...result.item.source,
          highlightedModelName,
        }
      })
    }

    // Apply downloaded filter with pre-computed Set for O(1) lookups
    if (showOnlyDownloaded) {
      filtered = filtered?.filter((model) =>
        model.models.some((variant) => downloadedModelIds.has(variant.id))
      )
    }

    return filtered
  }, [
    debouncedSearchValue,
    sortedModels,
    showOnlyDownloaded,
    downloadedModelIds,
  ])

  useEffect(() => {
    fetchModelHub()
    fetchSources()
  }, [fetchSources])

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setIsSearching(false)
    setSearchValue(e.target.value)
    if (addModelSourceTimeoutRef.current) {
      clearTimeout(addModelSourceTimeoutRef.current)
    }
    if (
      e.target.value.length &&
      (e.target.value.includes('/') || e.target.value.startsWith('http'))
    ) {
      setIsSearching(true)
      addModelSourceTimeoutRef.current = setTimeout(() => {
        addModelSource(e.target.value)
          .then(() => {
            fetchSources()
          })
          .finally(() => {
            setIsSearching(false)
          })
      }, 500)
    }
  }

  const { downloads, localDownloadingModels, addLocalDownloadingModel } =
    useDownloadStore()

  const downloadProcesses = useMemo(
    () =>
      Object.values(downloads).map((download) => ({
        id: download.name,
        name: download.name,
        progress: download.progress,
        current: download.current,
        total: download.total,
      })),
    [downloads]
  )

  const navigate = useNavigate()

  const isRecommendedModel = useCallback((modelId: string) => {
    return (extractModelName(modelId)?.toLowerCase() ===
      'jan-nano-gguf') as boolean
  }, [])

  const handleUseModel = useCallback(
    (modelId: string) => {
      navigate({
        to: route.home,
        params: {},
        search: {
          model: {
            id: modelId,
            provider: 'llama.cpp',
          },
        },
      })
    },
    [navigate]
  )

  const DownloadButtonPlaceholder = useMemo(() => {
    return ({ model }: ModelProps) => {
      const modelId =
        model.models.find((e) =>
          defaultModelQuantizations.some((m) => e.id.toLowerCase().includes(m))
        )?.id ?? model.models[0]?.id
      const isDownloading =
        localDownloadingModels.has(modelId) ||
        downloadProcesses.some((e) => e.id === modelId)
      const downloadProgress =
        downloadProcesses.find((e) => e.id === modelId)?.progress ?? 0
      const isDownloaded = llamaProvider?.models.some(
        (m: { id: string }) => m.id === modelId
      )
      const isRecommended = isRecommendedModel(model.metadata?.id)

      const handleDownload = () => {
        // Immediately set local downloading state
        addLocalDownloadingModel(modelId)
        downloadModel(modelId)
      }

      return (
        <div
          className={cn(
            'flex items-center',
            isRecommended && 'hub-download-button-step'
          )}
        >
          {isDownloading && !isDownloaded && (
            <div className={cn('flex items-center gap-2 w-20')}>
              <Progress value={downloadProgress * 100} />
              <span className="text-xs text-center text-main-view-fg/70">
                {Math.round(downloadProgress * 100)}%
              </span>
            </div>
          )}
          {isDownloaded ? (
            <Button
              size="sm"
              onClick={() => handleUseModel(modelId)}
              data-test-id={`hub-model-${modelId}`}
            >
              {t('hub:use')}
            </Button>
          ) : (
            <Button
              data-test-id={`hub-model-${modelId}`}
              size="sm"
              onClick={handleDownload}
              className={cn(isDownloading && 'hidden')}
              ref={isRecommended ? downloadButtonRef : undefined}
            >
              {t('hub:download')}
            </Button>
          )}
        </div>
      )
    }
  }, [
    downloadProcesses,
    llamaProvider?.models,
    isRecommendedModel,
    downloadButtonRef,
    localDownloadingModels,
    addLocalDownloadingModel,
    t,
    handleUseModel,
  ])

  const { step } = useSearch({ from: Route.id })
  const isSetup = step === 'setup_local_provider'

  // Wait for DOM to be ready before starting Joyride
  useEffect(() => {
    if (!loading && filteredModels.length > 0 && isSetup) {
      const timer = setTimeout(() => {
        setJoyrideReady(true)
      }, 100)
      return () => clearTimeout(timer)
    } else {
      setJoyrideReady(false)
    }
  }, [loading, filteredModels.length, isSetup])

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, index } = data

    if (
      status === STATUS.FINISHED &&
      !isDownloading &&
      isLastStep &&
      !hasTriggeredDownload.current
    ) {
      const recommendedModel = filteredModels.find((model) =>
        isRecommendedModel(model.metadata?.id)
      )
      if (recommendedModel && recommendedModel.models[0]?.id) {
        if (downloadButtonRef.current) {
          hasTriggeredDownload.current = true
          downloadButtonRef.current.click()
        }
        return
      }
    }

    if (status === STATUS.FINISHED) {
      navigate({
        to: route.hub,
      })
    }

    // Track current step index
    setCurrentStepIndex(index)
  }

  // Check if any model is currently downloading
  const isDownloading =
    localDownloadingModels.size > 0 || downloadProcesses.length > 0

  const steps = [
    {
      target: '.hub-model-card-step',
      title: t('hub:joyride.recommendedModelTitle'),
      disableBeacon: true,
      content: t('hub:joyride.recommendedModelContent'),
    },
    {
      target: '.hub-download-button-step',
      title: isDownloading
        ? t('hub:joyride.downloadInProgressTitle')
        : t('hub:joyride.downloadModelTitle'),
      disableBeacon: true,
      content: isDownloading
        ? t('hub:joyride.downloadInProgressContent')
        : t('hub:joyride.downloadModelContent'),
    },
  ]

  // Check if we're on the last step
  const isLastStep = currentStepIndex === steps.length - 1

  return (
    <>
      <Joyride
        run={joyrideReady}
        floaterProps={{
          hideArrow: true,
        }}
        steps={steps}
        tooltipComponent={CustomTooltipJoyRide}
        spotlightPadding={0}
        continuous={true}
        showSkipButton={!isLastStep}
        hideCloseButton={true}
        spotlightClicks={true}
        disableOverlayClose={true}
        callback={handleJoyrideCallback}
        locale={{
          back: t('hub:joyride.back'),
          close: t('hub:joyride.close'),
          last: !isDownloading
            ? t('hub:joyride.lastWithDownload')
            : t('hub:joyride.last'),
          next: t('hub:joyride.next'),
          skip: t('hub:joyride.skip'),
        }}
      />
      <div className="flex h-full w-full">
        <div className="flex flex-col h-full w-full ">
          <HeaderPage>
            <div className="pr-4 py-3  h-10 w-full flex items-center justify-between relative z-20">
              <div className="flex items-center gap-2 w-full">
                {isSearching ? (
                  <Loader className="size-4 animate-spin text-main-view-fg/60" />
                ) : (
                  <IconSearch className="text-main-view-fg/60" size={14} />
                )}
                <input
                  placeholder={t('hub:searchPlaceholder')}
                  value={searchValue}
                  onChange={handleSearchChange}
                  className="w-full focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <span
                      title={t('hub:editTheme')}
                      className="flex cursor-pointer items-center gap-1 px-2 py-1 rounded-sm bg-main-view-fg/15 text-sm outline-none text-main-view-fg font-medium"
                    >
                      {
                        sortOptions.find(
                          (option) => option.value === sortSelected
                        )?.name
                      }
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" align="end">
                    {sortOptions.map((option) => (
                      <DropdownMenuItem
                        className={cn(
                          'cursor-pointer my-0.5',
                          sortSelected === option.value && 'bg-main-view-fg/5'
                        )}
                        key={option.value}
                        onClick={() => setSortSelected(option.value)}
                      >
                        {option.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showOnlyDownloaded}
                    onCheckedChange={setShowOnlyDownloaded}
                  />
                  <span className="text-xs text-main-view-fg/70 font-medium whitespace-nowrap">
                    {t('hub:downloaded')}
                  </span>
                </div>
              </div>
            </div>
          </HeaderPage>
          <div className="p-4 w-full h-[calc(100%-32px)] !overflow-y-auto first-step-setup-local-provider">
            <div className="flex flex-col h-full justify-between gap-4 gap-y-3 w-4/5 mx-auto">
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    {t('hub:loadingModels')}
                  </div>
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    {t('hub:noModels')}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col pb-2 mb-2 gap-2">
                  {filteredModels.map((model) => (
                    <div key={model.id}>
                      <Card
                        header={
                          <div className="flex items-center justify-between gap-x-2">
                            <Link
                              to={
                                `https://huggingface.co/${model.metadata?.id}` as string
                              }
                              target="_blank"
                            >
                              <h1
                                className={cn(
                                  'text-main-view-fg font-medium text-base capitalize truncate',
                                  isRecommendedModel(model.metadata?.id)
                                    ? 'hub-model-card-step'
                                    : ''
                                )}
                                dangerouslySetInnerHTML={{
                                  __html:
                                    searchValue.length &&
                                    (model as any).highlightedModelName
                                      ? (model as any).highlightedModelName
                                      : extractModelName(model.metadata?.id) ||
                                        '',
                                }}
                              />
                            </Link>
                            <div className="shrink-0 space-x-3 flex items-center">
                              <span className="text-main-view-fg/70 font-medium text-xs">
                                {toGigabytes(
                                  (
                                    model.models.find((m) =>
                                      defaultModelQuantizations.some((e) =>
                                        m.id.toLowerCase().includes(e)
                                      )
                                    ) ?? model.models?.[0]
                                  )?.size
                                )}
                              </span>
                              <DownloadButtonPlaceholder model={model} />
                            </div>
                          </div>
                        }
                      >
                        <div className="line-clamp-2 mt-3 text-main-view-fg/60">
                          <RenderMarkdown
                            enableRawHtml={true}
                            className="select-none reset-heading"
                            components={{
                              a: ({ ...props }) => (
                                <a
                                  {...props}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              ),
                            }}
                            content={
                              extractDescription(model.metadata?.description) ||
                              ''
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="capitalize text-main-view-fg/80">
                            {t('hub:by')} {model?.author}
                          </span>
                          <div className="flex items-center gap-4 ml-2">
                            <div className="flex items-center gap-1">
                              <IconDownload
                                size={18}
                                className="text-main-view-fg/50"
                                title={t('hub:downloads')}
                              />
                              <span className="text-main-view-fg/80">
                                {model.metadata?.downloads || 0}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <IconFileCode
                                size={20}
                                className="text-main-view-fg/50"
                                title={t('hub:variants')}
                              />
                              <span className="text-main-view-fg/80">
                                {model.models?.length || 0}
                              </span>
                            </div>
                            {model.models.length > 1 && (
                              <div className="flex items-center gap-2 hub-show-variants-step">
                                <Switch
                                  checked={!!expandedModels[model.id]}
                                  onCheckedChange={() =>
                                    toggleModelExpansion(model.id)
                                  }
                                />
                                <p className="text-main-view-fg/70">
                                  {t('hub:showVariants')}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                        {expandedModels[model.id] &&
                          model.models.length > 0 && (
                            <div className="mt-5">
                              {model.models.map((variant) => (
                                <CardItem
                                  key={variant.id}
                                  title={variant.id}
                                  actions={
                                    <div className="flex items-center gap-2">
                                      <p className="text-main-view-fg/70 font-medium text-xs">
                                        {toGigabytes(variant.size)}
                                      </p>
                                      {(() => {
                                        const isDownloading =
                                          localDownloadingModels.has(
                                            variant.id
                                          ) ||
                                          downloadProcesses.some(
                                            (e) => e.id === variant.id
                                          )
                                        const downloadProgress =
                                          downloadProcesses.find(
                                            (e) => e.id === variant.id
                                          )?.progress || 0
                                        const isDownloaded =
                                          llamaProvider?.models.some(
                                            (m: { id: string }) =>
                                              m.id === variant.id
                                          )

                                        if (isDownloading) {
                                          return (
                                            <>
                                              <div className="flex items-center gap-2 w-20">
                                                <Progress
                                                  value={downloadProgress * 100}
                                                />
                                                <span className="text-xs text-center text-main-view-fg/70">
                                                  {Math.round(
                                                    downloadProgress * 100
                                                  )}
                                                  %
                                                </span>
                                              </div>
                                            </>
                                          )
                                        }

                                        if (isDownloaded) {
                                          return (
                                            <div
                                              className="flex items-center justify-center rounded bg-main-view-fg/10"
                                              title={t('hub:useModel')}
                                            >
                                              <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() =>
                                                  handleUseModel(variant.id)
                                                }
                                              >
                                                {t('hub:use')}
                                              </Button>
                                            </div>
                                          )
                                        }

                                        return (
                                          <div
                                            className="size-6 cursor-pointer flex items-center justify-center rounded hover:bg-main-view-fg/10 transition-all duration-200 ease-in-out"
                                            title={t('hub:downloadModel')}
                                            onClick={() => {
                                              addLocalDownloadingModel(
                                                variant.id
                                              )
                                              downloadModel(variant.id)
                                            }}
                                          >
                                            <IconDownload
                                              size={16}
                                              className="text-main-view-fg/80"
                                            />
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  }
                                />
                              ))}
                            </div>
                          )}
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
