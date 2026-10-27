import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";

import { AddWidgetButton } from "@/components/add-widget-button";
import { TextField } from "@/components/text-field";

describe("TextField", () => {
  it("associates label and error with the input", () => {
    render(<TextField error="Name is required" label="Name" />);

    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Name is required");
  });
});

describe("AddWidgetButton", () => {
  it("calls onAdd with the text type by default", () => {
    const onAdd = vi.fn();
    render(<AddWidgetButton onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: "Add text widget" }));
    expect(onAdd).toHaveBeenCalledWith("text");
  });
});
