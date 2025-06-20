import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type ArrowButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  disabled?: boolean
}

export const PrevButton: React.FC<ArrowButtonProps> = ({
  disabled,
  ...rest
}) => (
  <button
    aria-label="Previous"
    disabled={disabled}
    className={twMerge(
      'p-3 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition',
      disabled && 'opacity-50 cursor-not-allowed'
    )}
    {...rest}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5L8.25 12l7.5-7.5"
      />
    </svg>
  </button>
)

export const NextButton: React.FC<ArrowButtonProps> = ({
  disabled,
  ...rest
}) => (
  <button
    aria-label="Next"
    disabled={disabled}
    className={twMerge(
      'p-3 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition',
      disabled && 'opacity-50 cursor-not-allowed'
    )}
    {...rest}
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 4.5l7.5 7.5-7.5 7.5"
      />
    </svg>
  </button>
)

/* Hook to enable/disable arrows */
export const usePrevNextButtons = (embla: any) => {
  const [prevBtnDisabled, setPrevBtnDisabled] = React.useState(true)
  const [nextBtnDisabled, setNextBtnDisabled] = React.useState(true)

  const onSelect = React.useCallback((emblaApi: any) => {
    setPrevBtnDisabled(!emblaApi.canScrollPrev())
    setNextBtnDisabled(!emblaApi.canScrollNext())
  }, [])

  React.useEffect(() => {
    if (!embla) return
    onSelect(embla)
    embla.on('select', onSelect)
    embla.on('reInit', onSelect)
  }, [embla, onSelect])

  return {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick: () => embla?.scrollPrev(),
    onNextButtonClick: () => embla?.scrollNext(),
  }
}
