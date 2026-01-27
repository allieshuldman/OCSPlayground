# OCS Playground

A React application for exploring Graph API and OCS features using Bearer tokens.

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**

### 1. Install Dependencies

From the project root:

```bash
npm install
```

### 2. Run the Development Server

**Web (Vite)**

```bash
npm run dev
```

- Dev server runs at **`http://localhost:62522`** (see `vite.config.js`).
- Vite will print the local URL; open it in your browser if it doesn’t open automatically.
- Code changes trigger **hot module replacement (HMR)**; the app updates without a full reload.
- The server listens on all interfaces (`host: true`), so you can reach it from other devices on your network using your machine’s IP and port `62522`.

**Electron (desktop)**

To run the app in Electron during development:

1. **Terminal 1** — start the Vite dev server:
   ```bash
   npm run dev
   ```
2. **Terminal 2** — launch Electron:
   ```bash
   npm run electron:dev
   ```

Electron loads the app from `http://localhost:62522`, so the dev server must be running first. DevTools open automatically in the Electron window.

**Preview production build locally**

```bash
npm run build
npm run preview
```

Serves the production build at `http://localhost:4173` (or the URL Vite prints).

**Troubleshooting**

- **Port 62522 already in use:** Stop the process using that port or change `server.port` in `vite.config.js`. The config uses `strictPort: true`, so Vite will exit if the port is taken.
- **Dependencies out of date:** Run `npm install` again and retry.

### 3. Add Tokens

Use the **Auth** page to add:

- **Graph API Bearer Token** — for Graph (profile, mail) and Playground features. Get a token from [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer); it must have audience `https://graph.microsoft.com`.
- **OCS Bearer Token** — for OCS/template features in the Playground.

### 4. Build for Production

```bash
npm run build
```

For Electron:

```bash
npm run electron:build
```

## Features

- **Auth** — Store and clear Graph API and OCS Bearer tokens.
- **Graph** — View profile, manager chain, and mailbox (Graph API).
- **Playground** — Experiment with templates and OCS calls.
- **Analysis** — Analyze data.

## Project Structure

- `src/Auth.jsx` — Token management (Graph API + OCS).
- `src/Graph.jsx` — Graph API browser (profile, mail).
- `src/Playground.jsx` — Template and OCS experimentation.
- `src/Analysis.jsx` — Analysis tools.
- `src/App.jsx` — Main app and navigation.
- `src/authConfig.js` — Graph API endpoint configuration.
