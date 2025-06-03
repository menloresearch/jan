// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Jan Documentation',
			description: 'Jan is a personal AI assistant that runs completely offline on your desktop. Private, capable, and entirely yours.',
			logo: {
				src: './src/assets/logo-mark.svg',
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/menloresearch/jan' },
				{ icon: 'discord', label: 'Discord', href: 'https://discord.gg/FTk2MvZwJH' },
			],
			editLink: {
				baseUrl: 'https://github.com/menloresearch/jan/edit/dev/docs/',
			},
			favicon: '/favicon.svg',
			head: [
				{
					tag: 'meta',
					attrs: {
						property: 'og:image',
						content: '/og-image.png',
					},
				},
			],
			customCss: [
				'./src/styles/custom.css',
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Overview', slug: 'index' },
						{ label: 'Quickstart', slug: 'quickstart' },
					],
				},
				{
					label: '📖 How-to Guides',
					items: [
						{ label: '🚀 Install Jan', slug: 'how-to/installation' },
						{ label: 'Download & Manage Models', slug: 'how-to/download-models' },
						{ label: 'Configure Settings & Preferences', slug: 'how-to/configure-settings' },
						{ label: 'Create Custom Assistants', slug: 'how-to/custom-assistants' },
						{ label: 'Manage Threads & Conversations', slug: 'how-to/manage-threads' },
						{ label: 'Use the Local API Server', slug: 'how-to/api-server' },
						{ label: 'Troubleshoot Issues', slug: 'how-to/troubleshooting' },
					],
				},
				{
					label: '📚 Tutorials',
					items: [
						{ label: 'First Chat Tutorial', slug: 'tutorials/first-chat' },
						{ label: 'Using Model Context Protocol (MCP)', slug: 'tutorials/mcp-setup' },
					],
				},
				{
					label: '📋 Reference',
					items: [
						{ label: 'Model Parameters', slug: 'reference/model-parameters' },
					],
				},
				{
					label: '💡 Explanation',
					items: [
						{ label: 'Architecture Overview', slug: 'explanation/architecture' },
						{ label: 'Privacy & Security', slug: 'explanation/privacy' },
					],
				},
			],
		}),
	],
});
