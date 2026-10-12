import { expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ redirect }));

it("opens on the library", async () => {
  const { default: Home } = await import("./page");
  Home();
  expect(redirect).toHaveBeenCalledWith("/recipes");
});
