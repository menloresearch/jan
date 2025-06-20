import * as React from 'react'
import { twMerge } from 'tailwind-merge'

type Props = {
  source: {
    light: string
    dark: string
  }
  className?: string
  alt?: string
  width?: number
  height?: number
}

/**
 * A lightweight replacement for Next.js `Image` that swaps between light/dark variants
 * using Tailwind's `dark:` selector.  It simply renders two `<img>` tags – one visible
 * in light mode, the other in dark mode – so it works without any JS on the page.
 */
const ThemeImage: React.FC<Props> = ({
  source,
  className,
  alt = '',
  width,
  height,
}) => {
  return (
    <>
      <img
        src={source.light}
        alt={alt}
        width={width}
        height={height}
        className={twMerge('block dark:hidden', className)}
        loading="lazy"
      />
      <img
        src={source.dark}
        alt={alt}
        width={width}
        height={height}
        className={twMerge('hidden dark:block', className)}
        loading="lazy"
      />
    </>
  )
}

export default ThemeImage
