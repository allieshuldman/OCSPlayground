import { PublicClientApplication } from '@azure/msal-browser'

// Microsoft OAuth configuration
// Replace these values with your Azure AD app registration details
const tenantId = import.meta.env.VITE_AZURE_TENANT_ID || 'common'
const authority = tenantId === 'common' 
  ? 'https://login.microsoftonline.com/common'
  : `https://login.microsoftonline.com/${tenantId}`

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE',
    authority: authority,
    // Automatically uses current origin (http://localhost:5173 for dev, https://ocsandbox.com for production)
    redirectUri: window.location.origin, // Must match your app registration redirect URI
  },
  cache: {
    cacheLocation: 'sessionStorage', // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
}

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest = {
  scopes: ['User.Read'],
}

// Graph API endpoint configuration
export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphMeManagerEndpoint: 'https://graph.microsoft.com/v1.0/me/manager',
  graphMeMailEndpoint: 'https://graph.microsoft.com/v1.0/me/messages',
}

// Create the main MSAL instance
export const msalInstance = new PublicClientApplication(msalConfig)
