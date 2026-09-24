# Gesher Distribution

Enterprise Operations Platform for Agricultural Tire Distribution.

## Tech Stack

- **Frontend:** Next.js 15, React 19, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Supabase, PostgreSQL
- **ORM:** Prisma
- **State:** Zustand, TanStack Query
- **Forms:** React Hook Form, Zod
- **Tables:** TanStack Table
- **Icons:** Lucide React
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js 18.17.0 or higher
- npm 9.0.0 or higher
- Supabase account

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd gesher-distribution
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials.

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check code formatting |
| `npm run type-check` | Run TypeScript type checker |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── modules/                # Feature-based modules
│   ├── auth/              # Authentication module
│   ├── users/             # User management module
│   ├── roles/             # Role management module
│   └── ...                # Other business modules
└── shared/                 # Shared code
    ├── components/        # Reusable components
    ├── lib/               # Libraries and utilities
    ├── hooks/             # Custom React hooks
    ├── services/          # Service layer
    ├── types/             # TypeScript types
    ├── constants/         # Constants
    └── stores/            # Zustand stores
```

## Development Guidelines

- Follow Clean Architecture principles
- Use Feature-Based Architecture
- No business logic in React components
- All database access through Prisma via API routes
- Strict TypeScript (no `any`)
- Reuse existing components

## License

UNLICENSED - Proprietary
