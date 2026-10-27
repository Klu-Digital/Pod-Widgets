import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vite-plus/test";

import { IdentityBadge, IdentityGate } from "@/components/identity-dialog";

const STORAGE_KEY = "pod-widgets:identity";
const ID = "0b0f6f0e-1b6e-4d58-9a6a-3f1f2f6f1c11";

const renderShell = () =>
  render(
    <>
      <IdentityBadge />
      <IdentityGate />
    </>
  );

beforeEach(() => {
  localStorage.clear();
});

describe("identity prompt", () => {
  it("asks for a name on first visit and stores the identity", () => {
    renderShell();

    fireEvent.keyDown(screen.getByLabelText("Your name"), { key: "Escape" });
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "  Ada  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(screen.getByText(/Signed in as Ada/u)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      id: expect.any(String),
      name: "Ada",
    });
  });

  it("does not prompt when an identity is stored", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: ID, name: "Ada" }));

    renderShell();

    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
    expect(screen.getByText(/Signed in as Ada/u)).toBeInTheDocument();
  });

  it("keeps the id when the name changes", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: ID, name: "Ada" }));
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "change" }));
    expect(screen.getByLabelText("Your name")).toHaveValue("Ada");
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Grace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual({
      id: ID,
      name: "Grace",
    });
  });
});
