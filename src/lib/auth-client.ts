import { createAuthClient } from 'better-auth/react'
import { oauthProviderClient } from '@better-auth/oauth-provider/client'

export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
  // Lets a sign-in started mid-way through an MCP client's OAuth authorize flow (see the `mcp`
  // server plugin in worker/auth.ts) resume that flow automatically once the session is created.
  plugins: [oauthProviderClient()],
})
