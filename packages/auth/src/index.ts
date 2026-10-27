import { expo } from "@better-auth/expo";
import { createDb } from "@k22i/db";
import * as schema from "@k22i/db/schema/auth";
import { env } from "@k22i/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { admin, organization } from "better-auth/plugins";
import { and, asc, eq, isNull } from "drizzle-orm";

import { CLIENT_IP_HEADER } from "./client-ip";
import { deliver } from "./deliver";
import { ac, roles } from "./permissions";
import { resolveRateLimitStorage } from "./rate-limit-storage";
import { resetPasswordUrl } from "./reset-link";
import {
  anyUserExists,
  claimInvitationSignUp,
  isPendingInvitation,
  signUpAllowed,
} from "./sign-up-gate";

/**
 * Scheme and hostname, no port, so `localhost:2600` -> `localhost:1900` is
 * already same-site. Conservative on purpose: calling two same-site subdomains
 * cross-site only loosens a cookie, while the opposite mistake breaks sign-in.
 * `null` is treated as cross-site.
 */
const siteOf = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return null;
  }
};

/**
 * `Secure` follows deployment, `SameSite` follows topology, deliberately
 * independent. Deriving both from one flag is the trap: `SameSite=None` is only
 * legal alongside `Secure`. `Secure` is off outside production because Safari
 * does not special-case `http://localhost` and none of the browsers extend the
 * exception to a LAN IP. That failure is silent — the cookie is dropped and
 * every request just looks signed out.
 */
export const defaultCookieAttributes = (
  nodeEnv: string,
  origins: { apiUrl: string; webOrigin: string }
) => {
  const deployed = nodeEnv === "production" || nodeEnv === "staging";
  const apiSite = siteOf(origins.apiUrl);
  const crossSite = apiSite === null || apiSite !== siteOf(origins.webOrigin);

  return {
    httpOnly: true,
    sameSite: deployed && crossSite ? ("none" as const) : ("lax" as const),
    secure: deployed,
  };
};

/**
 * No `cookieCache`: a cached session would outlive the revocation an
 * admin-issued password reset performs, for as long as the cache lasts.
 */
const SESSION = {
  cookieCache: { enabled: false },
  expiresIn: 60 * 60 * 24 * 7,
  freshAge: 60 * 60 * 24,
  updateAge: 60 * 60 * 24,
};

/**
 * better-auth's own invitation endpoints match the invitee by email, so with
 * open sign-up anyone could register as an invitee's address and join that
 * organization. Invitations are bearer links instead, accepted through
 * `invitations.*` in `@k22i/api`; these are answered NOT_FOUND.
 */
const EMAIL_MATCHED_INVITATION_PATHS = new Set([
  "/organization/accept-invitation",
  "/organization/get-invitation",
  "/organization/list-user-invitations",
  "/organization/reject-invitation",
]);

const SIGN_UP_PATH = "/sign-up/email";

const inviteOnly = () =>
  new APIError("FORBIDDEN", {
    code: "SIGN_UP_INVITE_ONLY",
    message: "Sign-up is by invitation. Ask an admin for an invite link.",
  });

/** Turn a user's name into a slug candidate: `Ada Lovelace` -> `ada-lovelace`. */
export const slugifyName = (name: string): string => {
  const base = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");
  return base || "workspace";
};

export const createAuth = () => {
  const db = createDb();

  const auth = betterAuth({
    advanced: {
      database: {
        generateId: "uuid",
      },
      defaultCookieAttributes: defaultCookieAttributes(env.NODE_ENV, {
        apiUrl: env.BETTER_AUTH_URL,
        webOrigin: env.CORS_ORIGIN,
      }),
      // Its own x-forwarded-for parsing disagrees with ours and is spoofable, so
      // it reads only the header the server stamps (see ./client-ip.ts).
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",

      schema,
    }),
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            // Declared below because it closes over `auth`, still being built here.
            // oxlint-disable-next-line no-use-before-define
            const activeOrganizationId = await personalOrganizationId(
              session.userId
            );
            if (!activeOrganizationId) {
              return;
            }
            return { data: { ...session, activeOrganizationId } };
          },
        },
      },
      user: {
        create: {
          after: async (user) => {
            const personalOrg = await auth.api.createOrganization({
              body: {
                keepCurrentActiveOrganization: true,
                // How `personalOrganizationId` finds it again at session creation.
                metadata: { personal: true },
                name: `${user.name}'s Workspace`,
                // oxlint-disable-next-line no-use-before-define
                slug: await personalOrgSlug(user),
                userId: user.id,
              },
            });

            if (personalOrg) {
              await db
                .update(schema.session)
                .set({ activeOrganizationId: personalOrg.id })
                .where(
                  and(
                    eq(schema.session.userId, user.id),
                    isNull(schema.session.activeOrganizationId)
                  )
                );
            }
          },
          before: async (user, context) => {
            // Only HTTP sign-up is gated; the seeder and tests call
            // `auth.api.signUpEmail` with no request and must not mint an admin.
            if (
              context?.path !== SIGN_UP_PATH ||
              context.request === undefined
            ) {
              return;
            }
            // The first account bootstraps the instance as its platform admin.
            if (!(await anyUserExists(db))) {
              return { data: { ...user, role: "admin" } };
            }
            if (env.ALLOW_SIGNUP) {
              return;
            }
            // Claimed here, at the insert, so a sign-up that fails validation
            // keeps the link for the retry.
            const claimed = await claimInvitationSignUp(
              db,
              (context.body as { invitationId?: unknown } | undefined)
                ?.invitationId
            );
            if (!claimed) {
              throw inviteOnly();
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      revokeSessionsOnPasswordReset: true,
      // Nothing is emailed (docs/adr/0001-no-email-admin-driven-recovery.md):
      // `deliver` writes the link to the server's stdout for whoever runs it.
      sendResetPassword: ({ user, token }) =>
        deliver({
          body: resetPasswordUrl(env.CORS_ORIGIN, token),
          subject: "Password reset link",
          to: user.email,
        }),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (EMAIL_MATCHED_INVITATION_PATHS.has(ctx.path)) {
          throw new APIError("NOT_FOUND");
        }
        // Server-side `auth.api` calls (seeder, tests) carry no request.
        if (ctx.path !== SIGN_UP_PATH || ctx.request === undefined) {
          return;
        }
        // Checked up front so a refused sign-up fails before better-auth does
        // any work; the `user.create.before` hook claims the link atomically.
        const allowed = signUpAllowed({
          allowSignup: env.ALLOW_SIGNUP,
          hasUsers: await anyUserExists(db),
          invitationPending: await isPendingInvitation(
            db,
            (ctx.body as { invitationId?: unknown } | undefined)?.invitationId
          ),
        });
        if (!allowed) {
          throw inviteOnly();
        }
      }),
    },
    plugins: [
      expo(),
      admin(),
      // Same objects the web and native clients import, so a role edit is one
      // line in one file rather than a migration plus a client release.
      organization({
        ac,
        organizationHooks: {
          // better-auth stores an invited role untrimmed, and its owner check
          // misses `"member, owner"` — so an admin could mint an owner.
          beforeCreateInvitation: ({ invitation }) => {
            if (/\s/u.test(invitation.role)) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_ROLE",
                message: "Pick a role from the list",
              });
            }
            return Promise.resolve();
          },
        },
        roles,
      }),
    ],
    rateLimit: {
      // No `storage` key: "secondary-storage" makes better-auth's
      // `getRateLimitStorage()` throw without `secondaryStorage`, which we do
      // not use. `customStorage` wins anyway.
      customStorage: resolveRateLimitStorage(),
      // better-auth resolves `enabled ?? isProduction`. Spread rather than pass
      // `undefined` so a future version checking key presence still sees none.
      ...(env.AUTH_RATE_LIMIT_ENABLED === undefined
        ? {}
        : { enabled: env.AUTH_RATE_LIMIT_ENABLED }),
      max: env.AUTH_RATE_LIMIT_MAX,
      window: env.AUTH_RATE_LIMIT_WINDOW,
    },
    secret: env.BETTER_AUTH_SECRET,
    session: SESSION,
    trustedOrigins: [
      env.CORS_ORIGIN,

      "k22i://",
      "exp://",
      "http://localhost:8081",
    ],
  });

  const personalOrgSlug = async (user: {
    id: string;
    name: string;
  }): Promise<string> => {
    const base = slugifyName(user.name);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      try {
        await auth.api.checkOrganizationSlug({ body: { slug: candidate } });
        return candidate;
      } catch (error) {
        // Only better-auth's own "slug taken" answer means try the next one;
        // anything else (a DB outage) would otherwise burn every candidate.
        if (
          !(error instanceof APIError) ||
          error.body?.code !== "ORGANIZATION_SLUG_ALREADY_TAKEN"
        ) {
          throw error;
        }
      }
    }

    return `${base}-${user.id.replaceAll("-", "").slice(-12)}`;
  };

  const personalOrganizationId = async (
    userId: string
  ): Promise<string | undefined> => {
    const memberships = await db
      .select({
        metadata: schema.organization.metadata,
        organizationId: schema.member.organizationId,
      })
      .from(schema.member)
      .innerJoin(
        schema.organization,
        eq(schema.organization.id, schema.member.organizationId)
      )
      .where(eq(schema.member.userId, userId))
      .orderBy(asc(schema.member.createdAt));

    const [oldest] = memberships;
    if (!oldest) {
      return undefined;
    }

    const personal = memberships.find((m) => {
      if (!m.metadata) {
        return false;
      }
      try {
        return (
          (JSON.parse(m.metadata) as { personal?: unknown }).personal === true
        );
      } catch {
        return false;
      }
    });

    return (personal ?? oldest).organizationId;
  };

  return auth;
};

export const auth = createAuth();
