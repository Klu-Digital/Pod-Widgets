import { ORPCError } from "@orpc/client";
import { toastManager } from "@trumpet-pods/ui/components/toast";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  createQueryClient,
  errorMessage,
  failureKind,
  orNullIfMissing,
} from "@/utils/orpc";

vi.mock("@trumpet-pods/ui/components/toast", () => ({
  toastManager: {
    add: vi.fn(),
    close: vi.fn(),
    update: vi.fn(),
  },
}));

const conflict = new ORPCError("CONFLICT", {
  defined: true,
  message: "A category with this name already exists",
});

beforeEach(() => {
  vi.mocked(toastManager.add).mockClear();
});

describe("errorMessage", () => {
  it("shows what the server wrote for a defined error", () => {
    expect(errorMessage(conflict)).toBe(
      "A category with this name already exists"
    );
  });

  it("says when to try again after a rate limit", () => {
    expect(
      errorMessage(
        new ORPCError("TOO_MANY_REQUESTS", {
          data: { retryAfter: 60 },
          defined: true,
        })
      )
    ).toBe("Too many attempts. Try again in 60 seconds.");
  });

  it("never shows an undefined error's own message", () => {
    expect(
      errorMessage(
        new ORPCError("INTERNAL_SERVER_ERROR", {
          message: 'relation "financial_account" does not exist',
        })
      )
    ).toBe("Something went wrong. Try again in a moment.");
  });

  it("names an unreachable server", () => {
    expect(errorMessage(new TypeError("Failed to fetch"))).toBe(
      "Can’t reach the server. Check your connection."
    );
  });
});

describe("failureKind", () => {
  it("reads the screen from the error code", () => {
    expect(failureKind(new ORPCError("FORBIDDEN"))).toBe("forbidden");
    expect(failureKind(new ORPCError("NOT_FOUND"))).toBe("not_found");
    expect(failureKind(new ORPCError("INTERNAL_SERVER_ERROR"))).toBe(
      "unexpected"
    );
    expect(failureKind(new TypeError("Failed to fetch"))).toBe("unreachable");
  });
});

describe("orNullIfMissing", () => {
  it("turns only a missing record into null", async () => {
    await expect(
      orNullIfMissing(Promise.reject(new ORPCError("NOT_FOUND")))
    ).resolves.toBeNull();
    await expect(
      orNullIfMissing(Promise.reject(new ORPCError("FORBIDDEN")))
    ).rejects.toThrow();
  });
});

const fail = () => Promise.reject(conflict);

describe("createQueryClient", () => {
  it("fires an error toast with a retry action when a query fails", async () => {
    const queryClient = createQueryClient();

    await queryClient
      .fetchQuery({
        queryFn: () => Promise.reject(new Error("boom")),
        queryKey: ["x"],
        retry: false,
      })
      .catch(() => {
        // expected: the query is set up to reject.
      });

    expect(toastManager.add).toHaveBeenCalledTimes(1);
    expect(toastManager.add).toHaveBeenCalledWith(
      expect.objectContaining({
        actionProps: expect.objectContaining({
          children: "retry",
          onClick: expect.any(Function),
        }),
        title: "boom",
        type: "error",
      })
    );
  });

  it("answers a defined error at once but retries a crash twice", async () => {
    const queryClient = createQueryClient();
    const defined = vi.fn(() => Promise.reject(conflict));
    const crash = vi.fn(() =>
      Promise.reject(new ORPCError("INTERNAL_SERVER_ERROR"))
    );

    await queryClient
      .fetchQuery({ queryFn: defined, queryKey: ["defined"], retryDelay: 0 })
      .catch(() => null);
    await queryClient
      .fetchQuery({ queryFn: crash, queryKey: ["crash"], retryDelay: 0 })
      .catch(() => null);

    expect(defined).toHaveBeenCalledTimes(1);
    expect(crash).toHaveBeenCalledTimes(3);
  });

  it("toasts a failed mutation unless it shows the failure itself", async () => {
    const queryClient = createQueryClient();

    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: fail })
      .execute({})
      .catch(() => null);
    await queryClient
      .getMutationCache()
      .build(queryClient, {
        meta: { suppressErrorToast: true },
        mutationFn: fail,
      })
      .execute({})
      .catch(() => null);

    expect(toastManager.add).toHaveBeenCalledTimes(1);
    expect(toastManager.add).toHaveBeenCalledWith({
      title: "A category with this name already exists",
      type: "error",
    });
  });
});
