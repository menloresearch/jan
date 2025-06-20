import * as React from 'react'
import ThemeImage from '../ThemeImage'
import { twMerge } from 'tailwind-merge'

const features = [
  {
    title: 'Chat with AI',
    experimantal: false,
    description:
      'Ask your questions, brainstorm, and learn from the AI running on your device to be more productive.',
    image: {
      light: '/assets/homepage/features01.png',
      dark: '/assets/homepage/features01dark.png',
    },
  },
  {
    title: 'Model Hub',
    experimantal: false,
    description:
      'Download and Run powerful models like Llama3, Gemma or Mistral on your computer.',
    image: {
      light: '/assets/homepage/features02.png',
      dark: '/assets/homepage/features02dark.png',
    },
  },
  {
    title: 'Connect to Cloud AIs',
    experimantal: false,
    description:
      'You can also route to more powerful cloud models, like OpenAI, Groq, Cohere etc., when needed.',
    image: {
      light: '/assets/homepage/features03.png',
      dark: '/assets/homepage/features03dark.png',
    },
  },
  {
    title: 'Local API Server',
    experimantal: false,
    description:
      'Set up and run your own OpenAI-compatible API server using local models with just one click.',
    image: {
      light: '/assets/homepage/features04.png',
      dark: '/assets/homepage/features04dark.png',
    },
  },
  {
    title: 'Chat with your files',
    experimantal: true,
    description:
      'Ask questions about PDFs, Word docs or even code. (Coming soon) ',
    image: {
      light: '/assets/homepage/features05.png',
      dark: '/assets/homepage/features05dark.png',
    },
  },
]

const Feature: React.FC = () => {
  const [activeFeature, setActiveFeature] = React.useState(0)

  return (
    <div className="nextra-wrap-container py-8 lg:pt-24" id="features">
      <h2 className="text-center lg:text-left text-5xl lg:text-7xl font-serif font-normal leading-tight">
        Features
      </h2>

      <div className="flex flex-col lg:flex-row gap-10 xl:gap-14 mt-10">
        {/* feature list */}
        <div className="w-full lg:w-1/2 px-4 lg:px-0">
          {features.map((feature, i) => {
            const isActive = activeFeature === i
            return (
              <div
                key={i}
                className={twMerge(
                  'mb-4 py-6 lg:p-6 rounded-xl cursor-pointer',
                  isActive && 'lg:dark:bg-[#1F1F1F] lg:bg-[#F5F5F5]'
                )}
                onClick={() => setActiveFeature(i)}
              >
                <div
                  className={twMerge(
                    'flex items-center gap-4',
                    isActive && 'items-start'
                  )}
                >
                  <h3 className="text-[32px] font-bold text-[#C4C4C4] dark:text-[#4C4C4C]">
                    0{i + 1}
                  </h3>
                  <div>
                    <div className="flex flex-col lg:flex-row lg:items-center gap-x-2">
                      <h6 className="text-xl font-bold">{feature.title}</h6>
                      {feature.experimantal && (
                        <span className="bg-blue-100 text-blue-700 text-sm font-medium px-2 py-1 rounded-lg mt-2 lg:mt-0">
                          Experimental
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <p className="mt-1 text-black/60 dark:text-white/60 leading-relaxed">
                        {feature.description}
                      </p>
                    )}
                  </div>
                </div>
                {/* mobile image */}
                <div className="lg:hidden mt-4">
                  <ThemeImage
                    alt="Feature preview"
                    width={800}
                    height={800}
                    className="w-full h-full object-cover object-center"
                    source={feature.image}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* desktop image */}
        <div className="hidden lg:block w-full overflow-hidden">
          <ThemeImage
            alt="Feature preview"
            width={800}
            height={800}
            className="w-full h-full object-cover object-center"
            source={features[activeFeature].image}
          />
        </div>
      </div>
    </div>
  )
}

export default Feature
