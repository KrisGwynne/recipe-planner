import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import Home from "./page";

it("shows the app name", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { name: "Recipe planner" })).toBeInTheDocument();
});
