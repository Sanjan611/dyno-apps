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
│   ├── (auth)/           # Authentication pages (login/signup)
│   ├── api/              # API routes
│   │   ├── generate-code/      # AI code generation
│   │   ├── init-expo/          # Initialize Expo template
│   │   ├── projects/           # Project CRUD operations
│   │   │   ├── route.ts        # GET (list/get), POST (create), PATCH (update)
│   │   │   └── [id]/           # Project-specific operations
│   │   │       ├── route.ts    # DELETE (delete project + sandbox)
│   │   │       └── sandbox/    # Sandbox management
│   │   │           ├── route.ts      # POST (create/get), GET (status), DELETE (terminate)
│   │   │           ├── health/       # Health check endpoint
│   │   │           │   └── route.ts  # GET (comprehensive health check)
│   │   │           └── logs/         # Get sandbox logs
│   │   │               └── route.ts  # GET (sandbox logs)
│   ├── project-gallery/  # Project gallery with CRUD
│   ├── builder/          # AI-powered builder interface
│   └── globals.css
├── components/
│   ├── ui/              # Shadcn UI components
│   ├── builder/         # Builder components
│   │   ├── ChatPanel.tsx      # Chat interface
│   │   ├── PreviewPanel.tsx   # Mobile preview container
│   │   ├── AppPreview.tsx     # Live app preview
│   │   └── CodeViewer.tsx     # Code display
│   ├── layout/          # Layout components
│   └── shared/          # Shared components
├── baml_src/            # BAML AI agent definitions
│   ├── clients.baml     # LLM client configurations
│   ├── coding-agent.baml     # Coding agent (explores and implements)
│   ├── tools.baml       # Shared tool definitions
│   └── generators.baml  # BAML generators config
├── baml_client/         # Auto-generated BAML client
├── scripts/             # Deployment scripts
├── supabase/            # Supabase configuration
│   └── migrations/      # Database migrations
├── lib/                 # Utils and state management
│   ├── store.ts         # Zustand store
│   └── server/          # Server-side utilities
│       ├── modal.ts          # Shared Modal client utilities
│       └── projectStore.ts   # Project persistence (Supabase)
└── types/               # TypeScript type definitions
```

## Features

### Current

- **Landing Page**: Enter app ideas directly and start building
- **Authentication UI**: Login/Signup pages (UI ready)
- **Project Gallery**: View, open, and delete saved projects
- **AI-powered Builder Interface**:
  - **Chat Panel**: Natural language input for app creation
  - **Preview Panel**: Live mobile app preview via Modal sandboxes
  - **Code Viewer**: View and copy generated code
  - Toggle between Preview and Code views
  - Resizable split-panel layout

### AI Agent Architecture

The system uses a single AI agent architecture:

1. **Coding Agent**: Explores the codebase, understands the user's request, creates a todo list based on its understanding, and implements changes using file tools (`list_files`, `read_file`, `write_file`) while tracking progress with a structured todo list. The agent autonomously handles both exploration and implementation phases.

### Backend Features

- **RESTful API Design**: Nested routes following REST conventions (`/api/projects/[id]/sandbox`)
- **Sandbox Lifecycle Management**: Sandboxes created on-demand when projects are opened
- **Health Checks**: Comprehensive sandbox health monitoring (process status, port listening)
- **Smart Sandbox Reuse**: Reuses healthy existing sandboxes instead of creating new ones
- **Project Persistence**: Supabase database with Row Level Security (RLS) for user-scoped projects
- **AI Code Generation**: Single-agent generation using BAML + Claude Sonnet 4.5
- **Expo Initialization**: Automated Expo app setup within sandboxes

### Coming Soon

- Export functionality for generated apps
- Version history

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
# - OPENROUTER_API_KEY (optional, for using OpenRouter models)
# - MODAL_TOKEN_ID and MODAL_TOKEN_SECRET (for sandboxes)
# - NEXT_PUBLIC_SUPABASE_URL (your Supabase project URL)
# - NEXT_PUBLIC_SUPABASE_ANON_KEY (your Supabase publishable key - sb_publishable_...)
#   Note: This should be your publishable key from the Supabase dashboard.
#   It's safe to expose in client-side code. Never use the secret key here!
# - BETA_INVITE_CODES (comma-separated list of invite codes for beta access, e.g., "code1,code2,code3")
# - GITHUB_ORG_NAME (the GitHub organization where project repos will be created)
# - GITHUB_PAT (a GitHub Personal Access Token with repo permissions for that org; keep this server-side only)
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
   - `ANTHROPIC_API_KEY` - For AI code generation (Claude Sonnet 4.5)
   - `MODAL_TOKEN_ID` - Modal sandbox authentication token ID
   - `MODAL_TOKEN_SECRET` - Modal sandbox authentication token secret
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase publishable key (sb_publishable_...)
   - `BETA_INVITE_CODES` - Comma-separated list of invite codes for beta access (e.g., `beta2024,friend1,friend2`)
   
   **Important Notes:**
   - Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
   - Only use the Supabase publishable key (`sb_publishable_...`), never the secret key
   - Apply variables to all environments (Production, Preview, Development)

4. **Deploy:**
   - Click "Deploy"
   - Vercel will automatically build and deploy your application
   - The deployment URL will be provided (e.g., `your-app.vercel.app`)

#### Post-Deployment Verification

After deployment, verify:
- Application loads at the Vercel URL
- Authentication works (Supabase connection)
- AI code generation works (Anthropic API)
- Sandbox creation works (Modal API)

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

## Builder Interface

The builder features a split-panel layout:

- **Left Panel**: Chat interface for natural language app creation
  - Enter prompts to describe what you want to build
  - AI explores the codebase, creates a plan (via todos), and implements changes step by step
  - Progress tracked via structured todo list
- **Right Panel**: Mobile app preview with code toggle
  - **Preview Mode**: See your app in a mobile phone frame (live Expo preview)
  - **Code Mode**: View and copy the generated React Native code

## Architecture

### BAML Agent System

The AI agent is defined using BAML (Boundary ML):

- **Coding Agent** (`coding-agent.baml`): Explores the codebase, understands user requests, creates todos based on its understanding, and implements file changes while managing progress
- **Tools** (`tools.baml`): Shared tool definitions including file operations and todo management

### Modal Sandboxes

Each project runs in an isolated Modal sandbox with smart lifecycle management:

- **On-Demand Creation**: Sandboxes are created when a project is opened, not at project creation
- **Health Monitoring**: `/api/projects/[id]/sandbox/health` checks sandbox status, Expo process, and port availability
- **Smart Reuse**: When opening a project, existing healthy sandboxes are reused instead of creating new ones
- **Separate Lifecycles**: Projects and sandboxes have independent lifecycles
  - Delete sandbox only: `DELETE /api/projects/[id]/sandbox` (keeps project)
  - Delete project: `DELETE /api/projects/[id]` (also terminates sandbox)
- **Live Preview**: Sandboxes provide tunnel URLs for live Expo preview

## License

MIT
