# Dyno Apps

An AI-powered no-code mobile app builder platform. Build mobile applications using natural language with the help of AI.

## Tech Stack

- **Frontend**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **Icons**: Lucide React
- **State Management**: Zustand
- **AI Framework**: BAML (Boundary ML)
- **AI Model**: Anthropic Claude Sonnet 4.5
- **Sandbox**: Modal
- **Mobile**: Expo/React Native

## Project Structure

```
dyno-apps/
├── app/
│   ├── (auth)/           # Authentication pages
│   ├── api/              # API routes
│   │   ├── create-sandbox/
│   │   ├── init-expo/
│   │   ├── generate-code/
│   │   └── sandbox-logs/
│   ├── project-gallery/  # Project gallery
│   ├── builder/          # AI-powered builder
│   └── globals.css
├── components/
│   ├── ui/              # Shadcn UI components
│   ├── builder/         # Builder components
│   ├── layout/          # Layout components
│   └── shared/          # Shared components
├── baml_src/            # BAML AI agent definitions
├── scripts/             # Deployment scripts
├── lib/                 # Utils and state management
└── types/               # TypeScript type definitions
```

## Features

### Current

- Landing page with navigation
- Authentication UI (Login/Signup)
- Project Gallery for project management
- AI-powered builder interface with:
  - **Chat Panel**: Natural language input for app creation
  - **Preview Panel**: Live mobile app preview via Modal sandboxes
  - **Code Viewer**: View and copy generated code
  - Toggle between Preview and Code views
- Backend API for sandbox management and code generation
- AI code generation using BAML + Claude Sonnet 4.5
- Modal sandbox integration for running Expo apps

### Coming Soon

- Supabase integration for database and auth
- Export functionality for generated apps
- Project persistence and version history

## Getting Started

### Prerequisites

- Node.js 18+ or Node.js 20+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd dyno-apps
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
# Add required API keys:
# - ANTHROPIC_API_KEY (for AI code generation)
# - MODAL_TOKEN_ID and MODAL_TOKEN_SECRET (for sandboxes)
```

4. Run the development server:
```bash
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Available Scripts

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm baml:generate` - Generate BAML client code
- `pnpm baml:check` - Validate BAML definitions
- `pnpm baml:test` - Run BAML tests

## Builder Interface

The builder features a split-panel layout:

- **Left Panel**: Chat interface for natural language app creation
- **Right Panel**: Mobile app preview with code toggle
  - **Preview Mode**: See your app in a mobile phone frame
  - **Code Mode**: View and copy the generated React Native code

## License

MIT
