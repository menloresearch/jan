# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jan is a ChatGPT-alternative that runs 100% offline on your device, powered by Cortex (cortex.cpp), an embeddable local AI engine. This is a yarn workspaces monorepo with multiple packages for desktop (Electron/Tauri), web, core libraries, and an extension system.

## Prerequisites

- node >= 20.0.0
- yarn >= 1.22.0 (managed via corepack - yarn@4.5.3)
- make >= 3.81

## Development Commands

### Primary Development Workflow
```bash
# Start development (builds extensions + starts dev server)
make dev

# Production build  
make build

# Build for Tauri
make build-tauri
```

### Setup Commands
```bash
# Setup yarn version and install dependencies
make install-and-build

# Clean all build artifacts
make clean
```

### Individual Package Development
```bash
# Web app development (Vite + React)
yarn dev:web

# Electron app development  
yarn dev:electron

# API server development
yarn dev:server

# Tauri development
yarn dev:tauri

# UI component library (Joi)
yarn dev:joi
```

### Building
```bash
# Build all packages
yarn build

# Build individual packages
yarn build:core          # Core library (@janhq/core)
yarn build:web           # Web app (@janhq/web-app)
yarn build:electron      # Electron app (jan)
yarn build:extensions    # All extensions
yarn build:joi           # UI components (@janhq/joi)
yarn build:server        # API server (@janhq/server)
```

### Testing & Quality
```bash
# Run tests
make test                # Runs linting + tests
yarn test               # Unit tests only
yarn test:coverage     # Test coverage

# Linting
make lint               # Lint + validate extensions
yarn lint               # ESLint only
```

## Architecture

### Workspace Structure
- **`core/`** - Core library (@janhq/core) with types, APIs, business logic
- **`joi/`** - UI component library (@janhq/joi) using React + Tailwind CSS
- **`web-app/`** - Modern React web app using Vite + TanStack Router
- **`electron/`** - Electron desktop application
- **`server/`** - API server that proxies to cortex.cpp
- **`extensions/`** - Modular extension system (assistant, inference, models, etc.)
- **`src-tauri/`** - Rust-based Tauri alternative to Electron
- **`web/`** - Legacy Next.js web app (deprecated)

### Extension System
Extensions are built as `.tgz` packages in `/pre-install/` and include:
- `assistant-extension` - Assistant functionality
- `conversational-extension` - Chat/conversation handling  
- `inference-cortex-extension` - Cortex.cpp integration
- `model-extension` - Model management
- `engine-management-extension` - AI engine management
- `hardware-management-extension` - Hardware detection

Extensions use Rolldown for bundling and have individual build configs.

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite, TanStack Router, Tailwind CSS 4, Radix UI
- **Desktop**: Electron 30.0.6 (primary), Tauri 2.x (alternative)
- **Backend**: Node.js 20+, Fastify, Cortex.cpp (C++ AI engine)
- **State**: Zustand for state management
- **Build**: Rolldown (core/server), Vite (web), yarn workspaces

## Key Development Notes

### Makefile Build System
The Makefile provides the primary development interface:
- `check-file-counts` validates extension builds (ensures .tgz files match extensions)
- `install-and-build` sets up yarn + builds core & extensions
- Platform-specific commands handle Windows/Linux/macOS differences

### Extension Validation
The build system validates that the number of `.tgz` files in `pre-install/` matches the number of extension directories with `package.json` files.

### Multi-Platform Support
- Desktop: Electron (cross-platform) and Tauri (Rust-based, smaller bundle)
- Web: Browser-based interface via Vite dev server (port 1420)
- Targets: Windows x64, macOS Universal, Linux (deb/AppImage)

### Testing Setup
- **Core/Extensions**: Jest with individual configs
- **Web-app**: Vitest
- **E2E**: Playwright for Electron app testing
- Coverage reports available via `yarn test:coverage`

### Asset Management
- `yarn copy:assets` - Copies extension .tgz files and themes to electron/
- `yarn copy:assets:tauri` - Copies assets to Tauri resources
- Extensions must be built before copying assets

### Git Workflow
- Main development branch: `dev`
- Fork repository and create feature branches
- Submit PRs to `dev` branch
- Use present tense commit messages

## Common Issues

### Extension Build Failures
If extensions fail to build, run `make clean` then `make install-and-build` to rebuild everything.

### Missing Cortex Binaries
For Tauri development, run `yarn install:cortex` to download cortex.cpp binaries.

### Build Validation Errors
The `check-file-counts` step ensures all extensions are properly built. If this fails, individual extensions may need rebuilding via `yarn build:extensions`.