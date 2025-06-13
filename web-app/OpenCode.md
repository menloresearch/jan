# OpenCode Configuration

## Build/Test Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm test` - Run all tests with Vitest
- `npm test -- --run` - Run tests once (no watch mode)
- `npm test -- path/to/test.spec.ts` - Run single test file

## Code Style Guidelines
- **Framework**: React 19 + TypeScript + Vite + TailwindCSS
- **State Management**: Zustand for global state
- **UI Components**: Radix UI + shadcn/ui patterns with class-variance-authority
- **Imports**: Use `@/` alias for src imports, group external imports first
- **Types**: Prefer interfaces for objects, use strict TypeScript
- **Naming**: camelCase for variables/functions, PascalCase for components/types
- **Components**: Use function declarations, destructure props, export at bottom
- **Hooks**: Custom hooks start with `use`, leverage Zustand create pattern
- **Error Handling**: Use try/catch blocks, proper error types
- **Styling**: TailwindCSS classes, use `cn()` utility for conditional classes
- **Files**: `.tsx` for components, `.ts` for utilities/services/hooks