import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { SimpleCsrfProtectionLinkPlugin } from "@orpc/client/plugins";
import type { AppRouterClient } from "@trumpet-pods/api/routers/index";
import { env } from "@trumpet-pods/env/web";

import { getIdentity } from "@/lib/identity";
import { getServerUrl } from "@/lib/server-url";

const link = new RPCLink({
  fetch(url, options) {
    return fetch(url, {
      ...options,
      credentials: "include",
    });
  },
  headers() {
    const identity = getIdentity();
    // Encoded: fetch rejects header characters above U+00FF, e.g. "Zoë".
    return identity
      ? {
          "x-identity-id": identity.id,
          "x-identity-name": encodeURIComponent(identity.name),
        }
      : {};
  },
  // The server refuses RPC calls without its header (see apps/server/src/orpc.ts).
  plugins: [new SimpleCsrfProtectionLinkPlugin()],
  url: `${getServerUrl(env.VITE_SERVER_URL)}/rpc`,
});

// Screens go through `orpc` / `householdOrpc` in `./orpc`.
export const client: AppRouterClient = createORPCClient(link);
