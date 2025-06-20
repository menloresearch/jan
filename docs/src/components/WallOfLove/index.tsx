import * as React from 'react'
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import { Tweet } from 'react-tweet'
import { PrevButton, NextButton, usePrevNextButtons } from './ArrowButton'
import { twMerge } from 'tailwind-merge'

const slides = [
  [
    { type: 'tweet', id: '1742843063938994469' },
    { type: 'tweet', id: '1744729548074459310' },
    { type: 'tweet', id: '1745560583548670250' },
    { type: 'tweet', id: '1757500111629025788' },
  ],
  [
    { type: 'tweet', id: '1750801065132384302' },
    { type: 'tweet', id: '1742993414986068423' },
    { type: 'tweet', id: '1757504717519749292' },
  ],
]

const WallOfLove: React.FC = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: 'start' },
    [AutoScroll({ playOnInit: false })]
  )

  const {
    prevBtnDisabled,
    nextBtnDisabled,
    onPrevButtonClick,
    onNextButtonClick,
  } = usePrevNextButtons(emblaApi)

  return (
    <div className="py-20 bg-[#F0F0F0] dark:bg-[#242424]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-5xl font-serif">People Say Nice Things</h2>
          <div className="hidden lg:flex gap-4">
            <PrevButton
              disabled={prevBtnDisabled}
              onClick={onPrevButtonClick}
            />
            <NextButton
              disabled={nextBtnDisabled}
              onClick={onNextButtonClick}
            />
          </div>
        </div>

        <div className="embla overflow-hidden" ref={emblaRef}>
          <div className="embla__container flex gap-8">
            {slides.map((batch, idx) => (
              <div className="embla__slide w-full flex gap-8" key={idx}>
                {batch.map((item) => (
                  <div key={item.id} className="w-96 max-w-full">
                    {item.type === 'tweet' && <Tweet id={item.id} />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WallOfLove
