import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";

import { authClient } from "@/lib/auth-client";
import { invalidateSession } from "@/lib/session";
import { client } from "@/utils/client";

const organizationQueryKey = ["organization"] as const;

/**
 * The active organization lives on the session row, never in the URL. It is in
 * the query key so switching in one tab cannot serve the previous
 * organization's cache to this one.
 */
export const activeOrganizationQueryOptions = (
  activeOrganizationId: string | null
) =>
  queryOptions({
    enabled: activeOrganizationId !== null,
    queryFn: async () => {
      const { data, error } =
        await authClient.organization.getFullOrganization();
      if (error) {
        throw new Error(error.message ?? "Could not load the organization");
      }
      return data ?? null;
    },
    queryKey: [...organizationQueryKey, "active", activeOrganizationId],
  });

export const organizationsQueryOptions = () =>
  queryOptions({
    queryFn: async () => {
      const { data, error } = await authClient.organization.list();
      if (error) {
        throw new Error(error.message ?? "Could not load your organizations");
      }
      return data ?? [];
    },
    queryKey: [...organizationQueryKey, "list"],
  });

/** After any write that changes membership, invitations or the active org. */
export const invalidateOrganizations = async (
  queryClient: QueryClient
): Promise<void> => {
  await queryClient.invalidateQueries({ queryKey: organizationQueryKey });
};

/**
 * Through `invitations.accept` in `@k22i/api`, not better-auth's own endpoint,
 * which matches the invitee by email: the link is the credential.
 */
export const acceptInvitation = async (input: {
  invitationId: string;
  queryClient: QueryClient;
}): Promise<void> => {
  const { organizationId } = await client.invitations.accept({
    invitationId: input.invitationId,
  });

  // They clicked a link to get here, so that organization is what
  // `/dashboard` should show.
  const activation = await authClient.organization.setActive({
    organizationId,
  });
  await invalidateSession(input.queryClient);
  await invalidateOrganizations(input.queryClient);
  if (activation.error) {
    throw new Error(
      `Invitation accepted, but could not switch organizations: ${activation.error.message ?? "please switch manually"}`
    );
  }
};

export const rejectInvitation = async (input: {
  invitationId: string;
  queryClient: QueryClient;
}): Promise<void> => {
  await client.invitations.decline({ invitationId: input.invitationId });

  await invalidateOrganizations(input.queryClient);
};
