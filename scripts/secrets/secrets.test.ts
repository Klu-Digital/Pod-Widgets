import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  checkLocalEnvironment,
  evaluateRemote,
  formatCheckResult,
} from "./check";
import type { RemoteInspection } from "./check";
import { configManifest, manifestNames } from "./manifest";
import type { DeploymentEnvironment, RemoteState } from "./plan";
import {
  deriveUrls,
  destinationsFor,
  emptyRemoteState,
  formatPlan,
  planWrites,
} from "./plan";
import { generateSecret, setupLocalEnvironment } from "./setup";

const repoRoot = path.join(import.meta.dirname, "..", "..");

/** A value that must never reach stdout, argv, a file or a snapshot. */
const CANARY = "THIS_MUST_NEVER_APPEAR";

const makeFixture = (): string => {
  const root = mkdtempSync(path.join(os.tmpdir(), "trumpet-pods-secrets-"));
  for (const app of ["server", "web"]) {
    const directory = path.join(root, "apps", app);
    mkdirSync(directory, { recursive: true });
    cpSync(
      path.join(repoRoot, "apps", app, ".env.example"),
      path.join(directory, ".env.example")
    );
  }
  return root;
};

const cleanup = (root: string): void => {
  rmSync(root, { force: true, recursive: true });
};

const inspection = (
  state: RemoteState,
  overrides: Partial<RemoteInspection> = {}
): RemoteInspection => ({
  dokploy: { available: true },
  github: { available: true, environmentExists: true },
  state,
  ...overrides,
});

describe("local setup", () => {
  it("generates non-empty cryptographically random secrets", () => {
    const first = generateSecret();
    const second = generateSecret();

    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(first).not.toBe("");
    expect(second).not.toBe(first);
  });

  it("creates env files and preserves an existing generated secret", () => {
    const root = makeFixture();
    try {
      const serverEnv = path.join(root, "apps/server/.env");
      cpSync(path.join(root, "apps/server/.env.example"), serverEnv);
      const existing = "existing-secret-that-is-long-enough-123";
      writeFileSync(
        serverEnv,
        readFileSync(serverEnv, "utf-8").replace(
          "# PROMETHEUS_METRICS_TOKEN=",
          `PROMETHEUS_METRICS_TOKEN=${existing}`
        )
      );

      const result = setupLocalEnvironment(root);

      expect(result.createdFiles).toContain("apps/web/.env");
      expect(readFileSync(serverEnv, "utf-8")).toContain(
        `PROMETHEUS_METRICS_TOKEN=${existing}`
      );
      expect(readFileSync(path.join(root, "apps/web/.env"), "utf-8")).toContain(
        "VITE_SERVER_URL=/"
      );
    } finally {
      cleanup(root);
    }
  });

  it("is idempotent and does not print secret values", () => {
    const root = makeFixture();
    try {
      setupLocalEnvironment(root);
      const serverEnv = path.join(root, "apps/server/.env");
      const before = readFileSync(serverEnv, "utf-8");
      const second = setupLocalEnvironment(root);
      const output = formatCheckResult("local", checkLocalEnvironment(root));

      expect(second.generated).toEqual([]);
      expect(readFileSync(serverEnv, "utf-8")).toBe(before);
      const secret = before.match(/^PROMETHEUS_METRICS_TOKEN=(?<value>.+)$/mu)
        ?.groups?.value;
      expect(secret).toBeTruthy();
      expect(output).not.toContain(secret ?? "missing-secret");
      expect(output).not.toMatch(/PROMETHEUS_METRICS_TOKEN=|DATABASE_URL=/u);
    } finally {
      cleanup(root);
    }
  });

  it("reports required missing values and ignores optional integrations", () => {
    const root = makeFixture();
    try {
      const result = checkLocalEnvironment(root);
      const database = result.items.find(
        (item) => item.name === "DATABASE_URL"
      );
      const posthog = result.items.find(
        (item) => item.name === "POSTHOG_PROJECT_API_KEY"
      );

      expect(database?.status).toBe("missing");
      expect(posthog?.status).toBe("optional");
      expect(result.ready).toBe(false);
    } finally {
      cleanup(root);
    }
  });

  it("accepts a complete local setup", () => {
    const root = makeFixture();
    try {
      setupLocalEnvironment(root);
      const result = checkLocalEnvironment(root);
      expect(result.ready).toBe(true);
    } finally {
      cleanup(root);
    }
  });

  it("needs no external provider account", () => {
    const root = makeFixture();
    try {
      const { missingProviders } = setupLocalEnvironment(root);
      expect(missingProviders).not.toContain("POSTHOG_PROJECT_API_KEY");
      expect(checkLocalEnvironment(root).ready).toBe(true);
    } finally {
      cleanup(root);
    }
  });
});

describe("manifest", () => {
  it("covers variables declared by the environment schemas", () => {
    const schemaFiles = ["shared-server.ts", "server.ts", "web.ts"];
    const declared = new Set<string>();
    for (const file of schemaFiles) {
      const source = readFileSync(
        path.join(repoRoot, "packages/env/src", file),
        "utf-8"
      );
      for (const match of source.matchAll(
        /^(?: {2}| {4})(?<name>[A-Z][A-Z0-9_]*):/gmu
      )) {
        declared.add(match.groups?.name ?? "");
      }
    }

    for (const name of declared) {
      expect(
        manifestNames,
        `${name} is missing from the setup manifest`
      ).toContain(name);
    }
    expect(configManifest.length).toBeGreaterThan(20);
  });

  it("sends to GitHub only what the workflows actually read", () => {
    const workflows = ["deploy.yml", "release.yml", "ci.yml"]
      .map((file) =>
        readFileSync(path.join(repoRoot, ".github/workflows", file), "utf-8")
      )
      .join("\n");

    const githubTargeted = configManifest.filter((entry) =>
      entry.targets.some((target) => target.startsWith("github-"))
    );

    expect(githubTargeted.length).toBeGreaterThan(0);
    for (const entry of githubTargeted) {
      expect(
        workflows.includes(`secrets.${entry.name}`) ||
          workflows.includes(`vars.${entry.name}`),
        `${entry.name} is sent to GitHub but no workflow reads it`
      ).toBe(true);
    }
  });

  it("keeps the PostHog CI key out of the application runtime", () => {
    const personal = configManifest.find(
      (entry) => entry.name === "POSTHOG_PERSONAL_API_KEY"
    );
    expect(personal?.targets).toEqual(["github-repository"]);

    const project = configManifest.find(
      (entry) => entry.name === "POSTHOG_PROJECT_API_KEY"
    );
    expect(project?.targets).toContain("dokploy-server");
    expect(project?.targets).not.toContain("github-repository");
  });

  it("does not expose secrets to browser builds", () => {
    for (const entry of configManifest) {
      if (entry.kind === "config") {
        continue;
      }
      expect(entry.targets, entry.name).not.toContain("local-web");
    }
  });
});

describe("write planning", () => {
  it("keeps staging and production apart", () => {
    const staging = destinationsFor("DOKPLOY_TOKEN", "staging");
    const production = destinationsFor("DOKPLOY_TOKEN", "production");

    expect(staging.map((write) => write.scope)).toContain("staging");
    expect(staging.map((write) => write.scope)).not.toContain("production");
    expect(production.map((write) => write.scope)).toContain("production");
    expect(production.map((write) => write.scope)).not.toContain("staging");
  });

  it("writes a staging secret only into the staging environment", () => {
    const state = emptyRemoteState();
    const writes = planWrites(["DOKPLOY_TOKEN"], "staging", state);

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      scope: "staging",
      secret: true,
      target: "github-secret",
    });
  });

  it("skips destinations that already hold the name", () => {
    const state = emptyRemoteState();
    state.githubSecrets.add("DATABASE_URL");

    const writes = planWrites(["DATABASE_URL"], "staging", state);

    expect(writes.map((write) => write.target)).toEqual(["dokploy-server"]);
  });

  it("plans nothing for a fully configured name", () => {
    const state = emptyRemoteState();
    for (const write of destinationsFor("CORS_ORIGIN", "production")) {
      if (write.target === "dokploy-server") {
        state.dokployServer.add(write.name);
      }
    }

    expect(planWrites(["CORS_ORIGIN"], "production", state)).toEqual([]);
  });

  it("routes non-secret configuration to variables and credentials to secrets", () => {
    const state = emptyRemoteState();
    const writes = planWrites(
      ["DOKPLOY_URL", "DOKPLOY_TOKEN"],
      "staging",
      state
    );

    expect(writes.find((write) => write.name === "DOKPLOY_URL")?.target).toBe(
      "github-variable"
    );
    expect(writes.find((write) => write.name === "DOKPLOY_TOKEN")?.target).toBe(
      "github-secret"
    );
  });

  it("never routes a credential to a GitHub variable", () => {
    // `gh variable set` passes the value in argv, which a process listing can
    // read. That is only acceptable because this holds for every entry.
    for (const environment of ["staging", "production"] as const) {
      for (const write of planWrites(
        configManifest.map((entry) => entry.name),
        environment,
        emptyRemoteState()
      )) {
        const entry = configManifest.find(
          (candidate) => candidate.name === write.name
        );
        if (write.target === "github-variable") {
          expect(entry?.kind, write.name).toBe("config");
        }
        if (entry?.kind !== "config") {
          expect(write.target, write.name).not.toBe("github-variable");
        }
      }
    }
  });

  it("renders destinations without any value", () => {
    const state = emptyRemoteState();
    const writes = planWrites(
      ["DOKPLOY_TOKEN", "DOKPLOY_URL", "DATABASE_URL"],
      "staging",
      state
    );
    const rendered = formatPlan("staging", writes);

    expect(rendered).toContain("GitHub Secrets");
    expect(rendered).toContain("DOKPLOY_TOKEN");
    expect(rendered).toContain("No secret values will be displayed.");
    expect(rendered).not.toContain(CANARY);
    expect(rendered).not.toContain("=");
  });

  it("derives both URLs from one origin", () => {
    const derived = deriveUrls("https://staging.example.com/");

    expect(derived).toEqual({
      CORS_ORIGIN: "https://staging.example.com",
      SMOKE_URL: "https://staging.example.com",
    });
  });

  it("splits the API origin when it has its own hostname", () => {
    const derived = deriveUrls(
      "https://staging.example.com",
      "https://api.staging.example.com"
    );

    expect(derived.CORS_ORIGIN).toBe("https://staging.example.com");
    expect(derived.SMOKE_URL).toBe("https://api.staging.example.com");
  });
});

const configured = (environment: DeploymentEnvironment): RemoteState => {
  const state = emptyRemoteState();
  for (const entry of configManifest) {
    for (const write of destinationsFor(entry.name, environment)) {
      if (write.target === "dokploy-server") {
        state.dokployServer.add(entry.name);
      } else if (write.scope === "repository") {
        (write.secret
          ? state.githubRepositorySecrets
          : state.githubRepositoryVariables
        ).add(entry.name);
      } else {
        (write.secret ? state.githubSecrets : state.githubVariables).add(
          entry.name
        );
      }
    }
  }
  return state;
};

describe("deployment check", () => {
  it("reports a fully configured environment as ready", () => {
    const result = evaluateRemote("staging", inspection(configured("staging")));

    expect(result.ready).toBe(true);
    expect(result.unverified).toBe(false);
    expect(result.items.every((item) => item.status === "ok")).toBe(true);
  });

  it("reports required names that are absent as missing", () => {
    const state = configured("staging");
    state.githubSecrets.delete("DOKPLOY_TOKEN");

    const result = evaluateRemote("staging", inspection(state));
    const item = result.items.find(
      (candidate) =>
        candidate.name === "DOKPLOY_TOKEN" &&
        candidate.group === "GitHub staging"
    );

    expect(item?.status).toBe("missing");
    expect(result.ready).toBe(false);
  });

  it("distinguishes unverifiable from missing", () => {
    const result = evaluateRemote(
      "staging",
      inspection(emptyRemoteState(), {
        dokploy: { available: false, reason: "set DOKPLOY_TOKEN" },
        github: { available: true, environmentExists: true },
      })
    );

    const dokployItem = result.items.find(
      (item) => item.group === "Dokploy server"
    );
    const githubItem = result.items.find(
      (item) => item.name === "DOKPLOY_TOKEN" && item.group === "GitHub staging"
    );

    expect(dokployItem?.status).toBe("unverified");
    expect(githubItem?.status).toBe("missing");
    expect(result.unverified).toBe(true);
  });

  it("does not fail a run only because something was unverifiable", () => {
    const state = configured("staging");
    state.dokployServer.clear();

    const result = evaluateRemote(
      "staging",
      inspection(state, {
        dokploy: { available: false, reason: "Dokploy was not reachable" },
        github: { available: true, environmentExists: true },
      })
    );

    expect(result.ready).toBe(true);
    expect(result.unverified).toBe(true);
    expect(formatCheckResult("staging", result)).toContain(
      "could not be verified"
    );
  });

  it("marks an unreachable GitHub as unverified rather than missing", () => {
    const result = evaluateRemote(
      "production",
      inspection(emptyRemoteState(), {
        dokploy: { available: false, reason: "no GitHub" },
        github: {
          available: false,
          environmentExists: false,
          reason: "gh is not authenticated",
        },
      })
    );

    expect(result.items.every((item) => item.status === "unverified")).toBe(
      true
    );
    expect(result.ready).toBe(true);
    expect(result.items.some((item) => item.status === "missing")).toBe(false);
  });

  it("treats optional integrations as optional, not missing", () => {
    const result = evaluateRemote("staging", inspection(emptyRemoteState()));
    const posthog = result.items.find(
      (item) => item.name === "POSTHOG_PROJECT_API_KEY"
    );

    expect(posthog?.status).toBe("optional");
  });

  it("never produces a write scoped to the other environment", () => {
    // Repository-scoped names are shared by design; environment-scoped ones
    // must never cross. This is the property the whole apply path rests on,
    // since applyGitHub passes `write.scope` straight to `gh --env`.
    for (const environment of ["staging", "production"] as const) {
      const other = environment === "staging" ? "production" : "staging";
      const writes = planWrites(
        configManifest.map((entry) => entry.name),
        environment,
        emptyRemoteState()
      );
      const scopes = new Set(writes.map((write) => write.scope));

      expect(scopes, environment).toContain(environment);
      expect(scopes, environment).not.toContain(other);
    }
  });

  it("groups every GitHub item under the environment being checked", () => {
    const groups = new Set(
      evaluateRemote("staging", inspection(emptyRemoteState()))
        .items.map((item) => item.group)
        .filter((group) => group?.startsWith("GitHub"))
    );

    expect(groups).toContain("GitHub staging");
    expect(groups).not.toContain("GitHub production");
  });

  it("never prints a value", () => {
    const state = configured("staging");
    const rendered = formatCheckResult(
      "staging",
      evaluateRemote("staging", inspection(state))
    );

    expect(rendered).not.toContain(CANARY);
    expect(rendered).not.toMatch(/DATABASE_URL=|PROMETHEUS_METRICS_TOKEN=/u);
    expect(rendered).toContain("trumpet-pods staging");
  });
});
