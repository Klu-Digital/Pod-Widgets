import { call } from "@orpc/server";
import { describe, expect, it } from "vite-plus/test";

import type { Context } from "./context";
import { identityProcedure } from "./procedures";

const ID = "0b0f6f0e-1b6e-4d58-9a6a-3f1f2f6f1c11";

const run = (identityHeaders: Context["identityHeaders"]) =>
  call(
    identityProcedure.handler(({ context }) => context.identity),
    undefined,
    { context: { identityHeaders, log: undefined } as unknown as Context }
  );

describe("identityProcedure", () => {
  it("rejects missing headers with BAD_REQUEST", async () => {
    await expect(run({ id: undefined, name: undefined })).rejects.toMatchObject(
      { code: "BAD_REQUEST", status: 400 }
    );
  });

  it("rejects an id that is not a uuid", async () => {
    await expect(run({ id: "not-a-uuid", name: "Ada" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
    });
  });

  it("rejects a blank, overlong or malformed name", async () => {
    for (const name of ["%20%20", "a".repeat(61), "%E0%A4%A"]) {
      await expect(run({ id: ID, name })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
  });

  it("returns the decoded, trimmed identity", async () => {
    await expect(
      run({ id: ID, name: encodeURIComponent("  Zoë 🚀 ") })
    ).resolves.toEqual({ id: ID, name: "Zoë 🚀" });
  });
});
