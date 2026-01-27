# OCSPlayground

A React application with Microsoft OAuth authentication using Azure AD.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Azure AD App Registration

Before running the app, you need to register your application in Azure AD:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Enter a name for your app
5. Add **Redirect URIs** (add both for development and production):
   - Type: **Single-page application (SPA)**
   - Development: `http://localhost:5173`
   - Production: `https://ocsandbox.com`
6. Click **Register**
7. Copy the **Application (client) ID**

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
VITE_AZURE_CLIENT_ID=your-client-id-here
```

Optional: For single-tenant apps, also add:
```bash
VITE_AZURE_TENANT_ID=your-tenant-id-here
```

### 4. Run the Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173` and show the Microsoft login page.

### 5. Build for Production

```bash
npm run build
```

**Production URL:** `https://ocsandbox.com`

**Important:** Make sure both redirect URIs are added in Azure AD:
- Development: `http://localhost:5173`
- Production: `https://ocsandbox.com`

## Features

- Microsoft OAuth authentication using MSAL (Microsoft Authentication Library)
- Login with Microsoft account (redirect or popup flow)
- Protected dashboard showing user information
- Sign out functionality

## Project Structure

- `src/Login.jsx` - Microsoft OAuth login component
- `src/Dashboard.jsx` - Protected dashboard shown after login
- `src/authConfig.js` - MSAL configuration
- `src/App.jsx` - Main app component with authentication routing
# OCSPlayground
