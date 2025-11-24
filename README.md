# Dyno Apps

An AI-powered no-code mobile app builder platform. Build mobile applications using natural language with the help of AI.

## Tech Stack

- **Frontend**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn UI
- **Icons**: Lucide React
- **State Management**: Zustand

## Project Structure

```
dyno-apps/
├── app/
│   ├── (auth)/           # Authentication pages
│   │   ├── login/
│   │   └── signup/
│   ├── project-gallery/  # Project gallery
│   ├── builder/          # AI-powered builder
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ui/              # Shadcn UI components
│   ├── builder/         # Builder-specific components
│   │   ├── ChatPanel.tsx
│   │   ├── PreviewPanel.tsx
│   │   ├── AppPreview.tsx
│   │   └── CodeViewer.tsx
│   ├── layout/          # Layout components
│   └── shared/          # Shared components
├── lib/
│   ├── store.ts         # Zustand state management
│   ├── utils.ts         # Utility functions
│   └── hooks/           # Custom React hooks
└── types/               # TypeScript type definitions
```

## Features

### Current (Frontend Only)

- Landing page with navigation
- Authentication UI (Login/Signup)
- Project Gallery for project management
- AI-powered builder interface with:
  - **Chat Panel**: Natural language input for app creation
  - **Preview Panel**: Live mobile app preview
  - **Code Viewer**: View and copy generated code
  - Toggle between Preview and Code views

### Coming Soon

- Backend API integration
- AI agent integration for code generation
- Modal sandbox integration for running apps
- Supabase integration for database and auth
- Export functionality for generated apps

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

## Builder Interface

The builder features a split-panel layout:

- **Left Panel**: Chat interface for natural language app creation
- **Right Panel**: Mobile app preview with code toggle
  - **Preview Mode**: See your app in a mobile phone frame
  - **Code Mode**: View and copy the generated React Native code

## Future Integrations

- **Modal**: For creating isolated sandboxes to run user applications and AI coding agents
- **Supabase**: For authentication, database, and storage
- **AI Models**: OpenAI/Anthropic for code generation from natural language

## License

MIT
