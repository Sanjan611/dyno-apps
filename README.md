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
- **AI Models**: Configurable via BAML clients (supports fallback chains)
- **Sandbox**: Modal (isolated cloud containers)
- **Mobile**: Expo/React Native
- **Background Tasks**: Trigger.dev (optional, bypasses Vercel timeout)
- **Analytics**: ClickHouse (optional, token usage tracking)
- **Database**: Supabase (PostgreSQL + Auth)
- **Version Control**: GitHub (automatic repo per project)

## Features

### Current

- **Landing Page**: Enter app ideas directly and start building
- **Authentication**: Full login/signup system with Supabase authentication
- **Project Gallery**: View, open, and delete saved projects with user-scoped access
- **GitHub Integration**: Automatic GitHub repository creation for each project
- **AI-powered Builder Interface**:
  - **Chat Panel**: Natural language input for app creation with streaming responses
  - **Preview Panel**: Live mobile app preview via Modal sandboxes
  - **Code Viewer**: View and copy generated React Native code
  - Toggle between Preview and Code views
  - Resizable split-panel layout

### AI Agent Architecture

The system uses a single AI agent architecture:

1. **Coding Agent**: Explores the codebase, understands the user's request, creates a todo list based on its understanding, and implements changes using file tools (`list_files`, `read_file`, `write_file`) while tracking progress with a structured todo list. The agent autonomously handles both exploration and implementation phases.

### Backend Features

- **RESTful API Design**: Nested routes following REST conventions (`/api/projects/[id]/sandbox`)
- **Sandbox Lifecycle Management**: Sandboxes created on-demand when projects are opened
- **In-Memory Storage**: Sandboxes use fast in-memory file storage for code execution
- **Health Checks**: Comprehensive sandbox health monitoring (process status, port listening)
- **Smart Sandbox Reuse**: Reuses healthy existing sandboxes instead of creating new ones
- **Project Persistence**: Supabase database with Row Level Security (RLS) for user-scoped projects
- **Conversation State**: Full agent conversation history persisted per project
- **GitHub Repository Integration**:
  - Automatic private repository creation for each project
  - Repository cloning support in sandboxes
  - Repository URL tracking and management
- **AI Code Generation**: Streaming code generation via `/api/projects/[id]/chat` using BAML
- **Dual Execution Modes**:
  - **SSE Streaming**: Default mode with real-time progress events
  - **Trigger.dev**: Optional background tasks for long-running operations (bypasses Vercel timeout)
- **Token Usage Analytics**: Optional ClickHouse integration for tracking AI model usage
- **Expo Initialization**: Automated Expo app setup within sandboxes with repository cloning support

### Coming Soon

- Export functionality for generated apps
- Version history

## Getting Started

### Prerequisites

- Node.js 18+ or Node.js 20+
- pnpm for package management
- bun for running scripts (preferred over npx for speed)

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
# Add required API keys (see .env.local.example for full list):
# - ANTHROPIC_API_KEY (for AI models)
# - OPENROUTER_API_KEY (for AI models via OpenRouter)
# - MODAL_TOKEN_ID and MODAL_TOKEN_SECRET (for sandboxes)
# - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (database)
# - BETA_INVITE_CODES (comma-separated invite codes for beta access)
# - GITHUB_ORG_NAME and GITHUB_PAT (for project repositories)
#
# Optional:
# - TRIGGER_* variables (for Trigger.dev background tasks)
# - CLICKHOUSE_* variables (for token usage analytics)
# - RESEND_API_KEY and EMAIL_FROM (for feedback emails)
```

4. Set up Supabase database:
```bash
# Apply the database migration
supabase db push
```

5. Generate BAML client:
```bash
pnpm baml:generate
```

6. Run the development server:
```bash
pnpm dev
```

7. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

### Vercel Deployment

This application is configured for deployment on Vercel. The build process automatically generates the BAML client before building the Next.js application.

#### Prerequisites

- A Vercel account ([vercel.com](https://vercel.com))
- Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

#### Deployment Steps

1. **Connect Repository to Vercel:**
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your repository

2. **Configure Build Settings:**
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `pnpm build` (or `npm run build` if using npm)
   - Output Directory: `.next` (auto-detected)
   - Install Command: `pnpm install` (or `npm install`)

3. **Add Environment Variables:**

   In the Vercel project settings, go to "Environment Variables" and add the following:

   **Required Variables:**
   - `ANTHROPIC_API_KEY` - For AI code generation
   - `OPENROUTER_API_KEY` - For AI models via OpenRouter
   - `MODAL_TOKEN_ID` - Modal sandbox authentication token ID
   - `MODAL_TOKEN_SECRET` - Modal sandbox authentication token secret
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase publishable key
   - `BETA_INVITE_CODES` - Comma-separated list of invite codes for beta access
   - `GITHUB_ORG_NAME` - GitHub organization name where project repositories will be created
   - `GITHUB_PAT` - GitHub Personal Access Token with repo permissions for the organization

   **Optional (Trigger.dev):**
   - `TRIGGER_SECRET_KEY` - Trigger.dev API key
   - `TRIGGER_PROJECT_ID` - Trigger.dev project ID
   - `NEXT_PUBLIC_TRIGGER_PUBLIC_KEY` - Trigger.dev public key for frontend
   - `USE_TRIGGER_DEV` - Set to "true" to enable Trigger.dev mode
   - `SUPABASE_SECRET_KEY` - Service key for background tasks (bypasses RLS)

   **Optional (Analytics):**
   - `CLICKHOUSE_HOST` - ClickHouse Cloud URL
   - `CLICKHOUSE_USER` - ClickHouse username
   - `CLICKHOUSE_PASSWORD` - ClickHouse password

   **Optional (Observability):**
   - `BOUNDARY_API_KEY` - Boundary Studio API key for BAML LLM call tracing

   **Important Notes:**
   - Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
   - `GITHUB_PAT` and `SUPABASE_SECRET_KEY` should never be exposed to the browser
   - Apply variables to all environments (Production, Preview, Development)
   - See `.env.local.example` for the complete list with descriptions

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy your application
   - The deployment URL will be provided (e.g., `your-app.vercel.app`)

#### Post-Deployment Verification

After deployment, verify:
- Application loads at the Vercel URL
- Authentication works (Supabase connection)
- AI code generation works (API keys)
- Sandbox creation works (Modal API)
- (If enabled) Trigger.dev tasks execute successfully
- (If enabled) ClickHouse metrics are recorded

#### Notes

- Vercel automatically detects Next.js 15 and uses the correct build settings
- The build script runs `baml generate` before `next build` to ensure the BAML client is available
- Preview deployments are created automatically for each pull request
- Environment variables can be updated in the Vercel dashboard

## Available Scripts

- `pnpm dev` - Start development server with Turbopack
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm baml:generate` - Generate BAML client code
- `pnpm baml:check` - Validate BAML definitions
- `pnpm baml:test` - Run BAML tests

### Trigger.dev (optional)

If using Trigger.dev for background tasks:
- `bunx trigger.dev@latest dev --project-ref <TRIGGER_PROJECT_ID>` - Run Trigger.dev dev server locally
- `bunx trigger.dev@latest deploy --project-ref <TRIGGER_PROJECT_ID>` - Deploy tasks to Trigger.dev Cloud

## Builder Interface

The builder features a split-panel layout:

- **Left Panel**: Chat interface for natural language app creation
  - Enter prompts to describe what you want to build
  - Real-time streaming responses with progress updates
  - AI explores the codebase, creates a plan (via todos), and implements changes step by step
  - Progress tracked via structured todo list with Server-Sent Events (SSE)
- **Right Panel**: Mobile app preview with code toggle
  - **Preview Mode**: See your app in a mobile phone frame (live Expo preview via Modal tunnels)
  - **Code Mode**: View and copy the generated React Native code

## Architecture

For detailed architecture documentation, see [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md).

### Overview

- **AI Agent**: BAML-defined coding agent with file operations and progress tracking
- **Sandboxes**: Isolated Modal containers with in-memory storage and Expo runtime
- **State Persistence**: Conversation history stored in Supabase per project
- **Background Tasks**: Optional Trigger.dev integration for long-running operations

### Key Components

| Component | Purpose |
|-----------|---------|
| `baml_src/` | AI agent definitions and tool schemas |
| `trigger/` | Trigger.dev background task definitions |
| `lib/server/` | Server-side orchestration and integrations |
| `app/api/` | Next.js API routes |
| `hooks/` | React hooks for frontend state |

## License

MIT
