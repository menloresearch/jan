export const openAIProviderSettings = [
  {
    key: "api-key",
    title: "API Key",
    description:
      "The OpenAI API uses API keys for authentication. Visit your [API Keys](https://platform.openai.com/account/api-keys) page to retrieve the API key you'll use in your requests.",
    controller_type: "input",
    controller_props: {
      placeholder: "Insert API Key",
      value: "",
      type: "password",
      input_actions: ["unobscure", "copy"],
    },
  },
  {
    key: "base-url",
    title: "Base URL",
    description:
      "The base endpoint to use. See the [OpenAI API documentation](https://platform.openai.com/docs/api-reference/chat/create) for more information.",
    controller_type: "input",
    controller_props: {
      placeholder: "https://api.jan.ai/v1",
      value: "https://api.jan.ai/v1",
    },
  },
];

export const predefinedProviders = [
  {
    active: true,
    api_key: "sk-AVkFkPtxKFrI1M0NSRNK3g",
    base_url: "https://api.jan.ai/v1",
    explore_models_url: "https://menlo.ai",
    provider: "Menlo-14B-Chat",
    settings: [
      {
        key: "api-key",
        title: "api key",
        description: "the menlo platform api uses api keys for authentication.",
        controller_type: "input",
        controller_props: {
          placeholder: "insert api key",
          value: "",
          type: "password",
          input_actions: ["unobscure", "copy"],
        },
      },
      {
        key: "base-url",
        title: "base url",
        description:
          "the base endpoint to use. see the [openai api documentation](https://platform.openai.com/docs/api-reference/chat/create) for more information.",
        controller_type: "input",
        controller_props: {
          placeholder: "https://api.jan.ai/v1",
          value: "https://api.jan.ai/v1",
        },
      },
    ],
    models: [
      {
        id: "Jan-14B",
        name: "Jan-14B-Chat",
        version: "1.0",
        description: "",
        capabilities: ["completion"],
      },
    ],
  },
  {
    active: true,
    api_key: "sk-9xt66NIJYB4ckuNjO0ffqQ",
    base_url: "https://api.jan.ai/v1",
    explore_models_url: "https://menlo.ai",
    provider: "Menlo-14B-Think",
    settings: [
      {
        key: "api-key",
        title: "api key",
        description: "the menlo platform api uses api keys for authentication.",
        controller_type: "input",
        controller_props: {
          placeholder: "insert api key",
          value: "",
          type: "password",
          input_actions: ["unobscure", "copy"],
        },
      },
      {
        key: "base-url",
        title: "base url",
        description:
          "the base endpoint to use. see the [openai api documentation](https://platform.openai.com/docs/api-reference/chat/create) for more information.",
        controller_type: "input",
        controller_props: {
          placeholder: "https://api.jan.ai/v1",
          value: "https://api.jan.ai/v1",
        },
      },
    ],
    models: [
      {
        id: "Jan-14B-think",
        name: "Jan-14B-Think",
        version: "1.0",
        description: "",
        capabilities: ["completion"],
      },
    ],
  },
  {
    active: true,
    api_key: "sk-oK8Uo0HkLyGIyVRDyUjKJQ",
    base_url: "https://api.jan.ai/v1",
    explore_models_url: "https://menlo.ai",
    provider: "Menlo-14B-DeepResearch",
    settings: [
      {
        key: "api-key",
        title: "api key",
        description: "the menlo platform api uses api keys for authentication.",
        controller_type: "input",
        controller_props: {
          placeholder: "insert api key",
          value: "",
          type: "password",
          input_actions: ["unobscure", "copy"],
        },
      },
      {
        key: "base-url",
        title: "base url",
        description:
          "the base endpoint to use. see the [openai api documentation](https://platform.openai.com/docs/api-reference/chat/create) for more information.",
        controller_type: "input",
        controller_props: {
          placeholder: "https://api.jan.ai/v1",
          value: "https://api.jan.ai/v1",
        },
      },
    ],
    models: [
      {
        id: "Jan-DeepResearch",
        name: "Jan-DeepResearch",
        version: "1.0",
        description: "",
        capabilities: ["completion"],
      },
    ],
  },
  // {
  //   active: true,
  //   api_key: '',
  //   base_url: 'https://api.openai.com/v1',
  //   explore_models_url: 'https://platform.openai.com/docs/models',
  //   provider: 'openai',
  //   settings: [
  //     {
  //       key: 'api-key',
  //       title: 'api key',
  //       description:
  //         "the openai api uses api keys for authentication. visit your [api keys](https://platform.openai.com/account/api-keys) page to retrieve the api key you'll use in your requests.",
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'insert api key',
  //         value: '',
  //         type: 'password',
  //         input_actions: ['unobscure', 'copy'],
  //       },
  //     },
  //     {
  //       key: 'base-url',
  //       title: 'base url',
  //       description:
  //         'the base endpoint to use. see the [openai api documentation](https://platform.openai.com/docs/api-reference/chat/create) for more information.',
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'https://api.openai.com/v1',
  //         value: 'https://api.openai.com/v1',
  //       },
  //     },
  //   ],
  //   models: [],
  // },
  // {
  //   active: true,
  //   api_key: '',
  //   base_url: 'https://api.anthropic.com/v1',
  //   provider: 'anthropic',
  //   explore_models_url:
  //     'https://docs.anthropic.com/en/docs/about-claude/models',
  //   settings: [
  //     {
  //       key: 'api-key',
  //       title: 'api key',
  //       description:
  //         "the anthropic api uses api keys for authentication. visit your [api keys](https://console.anthropic.com/settings/keys) page to retrieve the api key you'll use in your requests.",
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'insert api key',
  //         value: '',
  //         type: 'password',
  //         input_actions: ['unobscure', 'copy'],
  //       },
  //     },
  //     {
  //       key: 'base-url',
  //       title: 'base url',
  //       description:
  //         'the base endpoint to use. see the [anthropic api documentation](https://docs.anthropic.com/en/api/messages) for more information.',
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'https://api.anthropic.com/v1',
  //         value: 'https://api.anthropic.com/v1',
  //       },
  //     },
  //   ],
  //   models: [],
  // },
  // {
  //   active: true,
  //   api_key: '',
  //   base_url: 'https://api.cohere.ai/compatibility/v1',
  //   explore_models_url: 'https://docs.cohere.com/v2/docs/models',
  //   provider: 'cohere',
  //   settings: [
  //     {
  //       key: 'api-key',
  //       title: 'api key',
  //       description:
  //         "the cohere api uses api keys for authentication. visit your [api keys](https://dashboard.cohere.com/api-keys) page to retrieve the api key you'll use in your requests.",
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'insert api key',
  //         value: '',
  //         type: 'password',
  //         input_actions: ['unobscure', 'copy'],
  //       },
  //     },
  //     {
  //       key: 'base-url',
  //       title: 'base url',
  //       description:
  //         'the base openai-compatible endpoint to use. see the [cohere documentation](https://docs.cohere.com/docs/compatibility-api) for more information.',
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'https://api.cohere.ai/compatibility/v1',
  //         value: 'https://api.cohere.ai/compatibility/v1',
  //       },
  //     },
  //   ],
  //   models: [],
  // },
  // {
  //   active: true,
  //   api_key: '',
  //   base_url: 'https://openrouter.ai/api/v1',
  //   explore_models_url: 'https://openrouter.ai/models',
  //   provider: 'openrouter',
  //   settings: [
  //     {
  //       key: 'api-key',
  //       title: 'api key',
  //       description:
  //         "the openrouter api uses api keys for authentication. visit your [api keys](https://openrouter.ai/settings/keys) page to retrieve the api key you'll use in your requests.",
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'insert api key',
  //         value: '',
  //         type: 'password',
  //         input_actions: ['unobscure', 'copy'],
  //       },
  //     },
  //     {
  //       key: 'base-url',
  //       title: 'base url',
  //       description:
  //         'the base endpoint to use. see the [openrouter api documentation](https://openrouter.ai/docs/api-reference/overview) for more information.',
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'https://openrouter.ai/api/v1',
  //         value: 'https://openrouter.ai/api/v1',
  //       },
  //     },
  //   ],
  //   models: [
  //     {
  //       id: 'deepseek/deepseek-r1:free',
  //       name: 'deepseek-r1 (free)',
  //       version: '1.0',
  //       description: '',
  //       capabilities: ['completion'],
  //     },
  //     {
  //       id: 'qwen/qwen3-30b-a3b:free',
  //       name: 'qwen3 30b a3b (free)',
  //       version: '1.0',
  //       description: '',
  //       capabilities: ['completion'],
  //     },
  //   ],
  // },
  // {
  //   active: true,
  //   api_key: '',
  //   base_url: 'https://api.mistral.ai',
  //   explore_models_url:
  //     'https://docs.mistral.ai/getting-started/models/models_overview/',
  //   provider: 'mistral',
  //   settings: [
  //     {
  //       key: 'api-key',
  //       title: 'api key',
  //       description:
  //         "the mistral api uses api keys for authentication. visit your [api keys](https://console.mistral.ai/api-keys/) page to retrieve the api key you'll use in your requests.",
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'insert api key',
  //         value: '',
  //         type: 'password',
  //         input_actions: ['unobscure', 'copy'],
  //       },
  //     },
  //     {
  //       key: 'base-url',
  //       title: 'base url',
  //       description:
  //         'the base endpoint to use. see the [mistral documentation](https://docs.mistral.ai/getting-started/models/models_overview/) for more information.',
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'https://api.mistral.ai',
  //         value: 'https://api.mistral.ai',
  //       },
  //     },
  //   ],
  //   models: [],
  // },
  // {
  //   active: true,
  //   api_key: '',
  //   base_url: 'https://api.groq.com/openai/v1',
  //   explore_models_url: 'https://console.groq.com/docs/models',
  //   provider: 'groq',
  //   settings: [
  //     {
  //       key: 'api-key',
  //       title: 'api key',
  //       description:
  //         "the groq api uses api keys for authentication. visit your [api keys](https://console.groq.com/keys) page to retrieve the api key you'll use in your requests.",
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'insert api key',
  //         value: '',
  //         type: 'password',
  //         input_actions: ['unobscure', 'copy'],
  //       },
  //     },
  //     {
  //       key: 'base-url',
  //       title: 'base url',
  //       description:
  //         'the base openai-compatible endpoint to use. see the [groq documentation](https://console.groq.com/docs) for more information.',
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'https://api.groq.com/openai/v1',
  //         value: 'https://api.groq.com/openai/v1',
  //       },
  //     },
  //   ],
  //   models: [],
  // },
  // {
  //   active: true,
  //   api_key: '',
  //   base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
  //   explore_models_url: 'https://ai.google.dev/gemini-api/docs/models/gemini',
  //   provider: 'gemini',
  //   settings: [
  //     {
  //       key: 'api-key',
  //       title: 'api key',
  //       description:
  //         "the google api uses api keys for authentication. visit your [api keys](https://aistudio.google.com/apikey) page to retrieve the api key you'll use in your requests.",
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder: 'insert api key',
  //         value: '',
  //         type: 'password',
  //         input_actions: ['unobscure', 'copy'],
  //       },
  //     },
  //     {
  //       key: 'base-url',
  //       title: 'base url',
  //       description:
  //         'the base openai-compatible endpoint to use. see the [gemini documentation](https://ai.google.dev/gemini-api/docs/openai) for more information.',
  //       controller_type: 'input',
  //       controller_props: {
  //         placeholder:
  //           'https://generativelanguage.googleapis.com/v1beta/openai',
  //         value: 'https://generativelanguage.googleapis.com/v1beta/openai',
  //       },
  //     },
  //   ],
  //   models: [],
  // },
];
