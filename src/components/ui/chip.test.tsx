import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActiveFilterChip, FilterChip } from "./chip";

describe("FilterChip", () => {
  it("reports whether it's selected", () => {
    const { rerender } = render(<FilterChip>Fish</FilterChip>);
    expect(screen.getByRole("button", { name: "Fish" })).toHaveAttribute("aria-pressed", "false");
    rerender(<FilterChip selected>Fish</FilterChip>);
    expect(screen.getByRole("button", { name: "Fish" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Fish" })).toHaveClass("bg-ink", "text-bg");
  });

  it("shows the count and calls onClick", () => {
    const onClick = vi.fn();
    render(
      <FilterChip count={5} onClick={onClick}>
        Salmon
      </FilterChip>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salmon 5" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("can't be pressed when disabled", () => {
    const onClick = vi.fn();
    render(
      <FilterChip count={0} disabled onClick={onClick}>
        Squid
      </FilterChip>,
    );
    const chip = screen.getByRole("button", { name: "Squid 0" });
    expect(chip).toBeDisabled();
    fireEvent.click(chip);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("ActiveFilterChip", () => {
  it("removes the filter", () => {
    const onRemove = vi.fn();
    render(<ActiveFilterChip label="Pasta" onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Pasta" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
