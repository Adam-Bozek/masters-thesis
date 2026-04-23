# Frontend

Frontend for the master’s thesis application focused on screening children’s communication abilities using the Slovak short version of **TEKOS II**.

The application is built with **Next.js**, **React**, **TypeScript**, **Bootstrap**, and **Axios**. It provides both a public entry flow and an authenticated testing workflow.

## Features

- User registration and login
- Public demo mode
- Guest mode without registration
- Protected dashboard for authenticated users
- Multi-phase category testing flow
- Speech-based and manual answer input
- Session-based progress tracking
- Category correction interface for completed runs
- PDF export of session results
- JSON-driven question and scene configuration

## Main flows

### Public home page

The landing page contains these tabs:

- **Prihlásenie** – sign in to continue working with saved sessions
- **Registrácia** – create a new account
- **Demo** – run a demo flow stored only in memory
- **Bez registrácie** – run the screening as a guest
- **Info** – short explanation and external reference material

The app is intended to be used in **Google Chrome** for the best experience.

### Authenticated workflow

After login, the user is redirected to `/dashboard`, where they can:

- view their sessions
- see category progress
- open the next testing category
- add notes to a session
- correct completed category answers
- export a session as PDF

Protected category routes are available under:

- `/testing/marketplace`
- `/testing/mountains`
- `/testing/zoo`
- `/testing/street`
- `/testing/home`

### Guest workflow

Guest users can start a run without creating an account. The frontend:

- creates a guest session through the API
- stores guest session state in `localStorage`
- resumes an unfinished guest session after reload
- runs categories in a fixed order
- marks the guest session as completed after the last category
- allows PDF export at the end

Guest category order:

1. Marketplace
2. Mountains
3. Zoo
4. Street
5. Home

### Demo workflow

The `/demo` route runs a simplified testing flow using local in-memory state and separate demo JSON files.

## Project structure

```text
frontend/
├── public/
│   ├── data/
│   │   ├── demo/
│   │   ├── home.json
│   │   ├── marketplace.json
│   │   ├── mountains.json
│   │   ├── parent_answers.json
│   │   ├── scene_config.json
│   │   ├── street.json
│   │   └── zoo.json
│   ├── sounds/
│   │   └── testing/
│   └── images/
│       └── testing/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── correct/[categorySlug]/page.tsx
│   │   │   └── page.tsx
│   │   ├── demo/page.tsx
│   │   ├── testing/
│   │   │   ├── home/page.tsx
│   │   │   ├── marketplace/page.tsx
│   │   │   ├── mountains/page.tsx
│   │   │   ├── street/page.tsx
│   │   │   └── zoo/page.tsx
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── css/
│   │   ├── private/
│   │   └── public/
│   └── utilities/
├── frontend.dockerfile
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Important components

### Public components

- `Login.tsx` – login form
- `Register.tsx` – registration form with client-side validation
- `Demo.tsx` – entry point into the demo route
- `RunWithoutRegister.tsx` – complete guest flow handling
- `Info.tsx` – additional information and reference link

### Private components

- `Controller.tsx` – main orchestrator for category testing
- `Header.tsx` – authenticated dashboard header
- `Phase3Testing.tsx` – speech/manual answer phase
- `Phase5Testing.tsx` – repeated testing for incorrect answers
- `SceneBuilder.tsx` – timeline-based visual scene renderer
- `CategoryAnswersEditor.tsx` – manual post-test correction screen
- `componentRuntimeConfigs.ts` – shared UI/runtime settings for testing components

### Utilities

- `AuthContext.tsx` – auth state, login, register, logout, user bootstrap
- `AxiosInstance.tsx` – shared Axios instance with token refresh and guest token support
- `WithAuth.tsx` – route protection wrapper

## Configuration files

The testing flow is driven by JSON files stored in `public/data/`.

These files define:

- question IDs
- question types
- question text
- audio file paths
- accepted speech transcripts
- answer options
- scene-based prompts
- image-based prompts

The shared scene timeline is loaded from:

- `public/data/scene_config.json`

Per-category questions are loaded from:

- `public/data/marketplace.json`
- `public/data/mountains.json`
- `public/data/zoo.json`
- `public/data/street.json`
- `public/data/home.json`

The demo uses:

- `public/data/demo/scenes.json`
- `public/data/demo/questions.json`

## Public assets

The application depends on runtime files stored in `frontend/public/`, including JSON configuration, images, and audio assets.

These files are **not included in the public GitHub repository**. A fresh clone may therefore be missing data required for category testing, scene rendering, image prompts, and audio playback.

See [`public/README.md`](./public/README.md) for the expected structure and local setup requirements.

## Environment variables

Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=/api
```

This variable is used by the shared Axios client as the API base URL.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The development server runs with Turbopack.

## Production build

```bash
npm run build
npm run start
```

The production server starts on `0.0.0.0:3000`.

## API expectations

The frontend expects the backend to provide endpoints for:

- authentication (`/login`, `/register`, `/logout`, `/refresh`, `/me`)
- session listing and creation (`/sessions`, `/sessions/guest`)
- category progress (`/sessions/:id/categories`)
- answer persistence (`/sessions/:id/answers`)
- category completion and correction
- session completion
- PDF export (`/sessions/export-pdf`)

## Notes

- Authenticated access uses bearer tokens stored in `localStorage`.
- Guest access uses a guest token passed through the `X-Guest-Token` header.
- The testing UI supports scene-based tasks, audio prompts, image-based tasks, and speech/manual input.
- The correction screen is route-based and resolves category config by slug.

## License

This frontend is part of the `masters-thesis` repository and follows the repository license headers included in the source files.
