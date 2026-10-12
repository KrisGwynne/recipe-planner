import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, IconButton, buttonClasses } from "./button";

describe("Button", () => {
  it("is a non-submitting button by default", () => {
    render(<Button>Import 3 recipes</Button>);
    expect(screen.getByRole("button", { name: "Import 3 recipes" })).toHaveAttribute("type", "button");
  });

  it("uses the variant's colours, and is 48px tall", () => {
    expect(buttonClasses("primary")).toContain("bg-primary");
    expect(buttonClasses("danger")).toContain("bg-danger");
    expect(buttonClasses("secondary")).toContain("border-line");
    expect(buttonClasses("ghost")).toContain("text-primary");
    expect(buttonClasses()).toContain("h-12");
  });

  it("can be disabled", () => {
    render(<Button disabled>Import</Button>);
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });
});

describe("IconButton", () => {
  it("has an accessible name", () => {
    render(<IconButton label="Back">×</IconButton>);
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
  });
});
