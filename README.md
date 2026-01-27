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

To run the app in Electron during development (Electron Forge + Vite):

```bash
npm run start
```

This starts the Vite dev server for the renderer and launches Electron. DevTools open automatically. If port 62522 is in use, Vite will use another port.

**Preview production build locally**

```bash
npm run build
npm run preview
```

Serves the production build at `http://localhost:4173` (or the URL Vite prints).

**Troubleshooting**

- **Port 62522 already in use:** For `npm run dev`, change `server.port` in `vite.config.js` or stop the process using it. For `npm run start`, the renderer config will try another port automatically.
- **Dependencies out of date:** Run `npm install` again and retry.

### 3. Add Tokens

Use the **Auth** page to add:

- **Graph API Bearer Token** — for Graph (profile, mail) and Playground features. Get a token from [Graph Explorer](https://developer.microsoft.com/en-us/graph/graph-explorer); it must have audience `https://graph.microsoft.com`.
- **OCS Bearer Token** — for OCS/template features in the Playground.

### 4. Build for Production

**Web only**

```bash
npm run build
```

**Electron (Windows & Mac)**

The app uses [Electron Forge](https://www.electronforge.io/) with the Vite plugin.

- **Package** (unpacked app):
  ```bash
  npm run package
  ```
- **Make installers:**
  ```bash
  npm run make
  ```
  - **Mac:** DMG and ZIP in `out/make/` (run on macOS).
  - **Windows:** Squirrel installer and ZIP (run on Windows).

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
- `src/electron-main.js` — Electron main process.
- `src/preload.js` — Electron preload script.
- `forge.config.js` — Electron Forge config (Vite plugin, makers).
- `vite.main.config.mjs` / `vite.preload.config.mjs` / `vite.renderer.config.mjs` — Vite configs for Forge.
