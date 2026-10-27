import {
  Link,
  createFileRoute,
  getRouteApi,
  redirect,
} from "@tanstack/react-router";

import AuthShell from "@/components/auth-shell";
import SignUpForm from "@/components/sign-up-form";
import {
  invitationFromRedirect,
  redirectSearch,
  safeRedirect,
} from "@/lib/redirect";

const routeApi = getRouteApi("/signup");

const RouteComponent = () => {
  const { redirect: requested } = routeApi.useSearch();
  const redirectTo = safeRedirect(requested, window.location.origin);
  const invitationId = invitationFromRedirect(
    redirectTo,
    window.location.origin
  );

  return (
    <AuthShell
      description={
        invitationId
          ? "Create an account to accept your invitation."
          : "Joining an organization? Open the invite link you were sent."
      }
      footer={
        <>
          Already have an account?{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            search={{ redirect: requested }}
            to="/login"
          >
            Sign in
          </Link>
        </>
      }
      title="Create your account"
    >
      <SignUpForm invitationId={invitationId} redirectTo={redirectTo} />
    </AuthShell>
  );
};

export const Route = createFileRoute("/signup")({
  beforeLoad: ({ context, search }) => {
    if (context.session) {
      throw redirect({
        href: safeRedirect(search.redirect, window.location.origin),
      });
    }
  },
  component: RouteComponent,
  head: () => ({ meta: [{ title: "Sign up" }] }),
  validateSearch: redirectSearch,
});
