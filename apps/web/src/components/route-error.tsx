import { Button } from "@k22i/ui/components/button";
import { Link } from "@tanstack/react-router";

import { failureKind } from "@/utils/orpc";
import type { FailureKind } from "@/utils/orpc";

const COPY: Record<FailureKind, { body: string; title: string }> = {
  forbidden: {
    body: "You may not have permission to view this.",
    title: "You don’t have access to this",
  },
  not_found: {
    body: "It may have been deleted, or never existed.",
    title: "We couldn’t find that",
  },
  unexpected: {
    body: "Try again in a moment. Nothing you entered has been lost.",
    title: "Something went wrong",
  },
  unreachable: {
    body: "Check your connection. Nothing you entered has been lost.",
    title: "Can’t reach the server",
  },
};

const RouteMessage = ({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: FailureKind;
}) => {
  const { body, title } = COPY[kind];

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex max-w-sm flex-col gap-1.5">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
      {children}
    </div>
  );
};

const BackHome = () => <Button render={<Link to="/" />}>Back home</Button>;

export const RouteError = ({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) => {
  const kind = failureKind(error);
  const retryable = kind === "unreachable" || kind === "unexpected";

  return (
    <RouteMessage kind={kind}>
      {retryable ? <Button onClick={reset}>Try again</Button> : <BackHome />}
    </RouteMessage>
  );
};

export const RouteNotFound = () => (
  <RouteMessage kind="not_found">
    <BackHome />
  </RouteMessage>
);
