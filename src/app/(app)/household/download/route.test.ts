import { strFromU8, unzipSync } from "fflate";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Recipe } from "@/types/recipe";

const mocks = vi.hoisted(() => ({ requireHousehold: vi.fn(), listRecipeFiles: vi.fn() }));
vi.mock("@/data", () => ({ requireHousehold: mocks.requireHousehold, listRecipeFiles: mocks.listRecipeFiles }));

const { GET } = await import("./route");

const tuna: Recipe = JSON.parse(readFileSync(new URL("../../../../../examples/lemony-tuna-tomato-caper-pasta.json", import.meta.url), "utf8"));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
  mocks.requireHousehold.mockResolvedValue({ household: { name: "The Gwynnes" }, ctx: { householdId: "h1" } });
  mocks.listRecipeFiles.mockResolvedValue([tuna]);
});

describe("GET /household/download", () => {
  it("sends the household's recipes as a zip to download, uncached", async () => {
    const response = await GET();
    expect(mocks.listRecipeFiles).toHaveBeenCalledWith({ householdId: "h1" });
    expect(response.headers.get("Content-Type")).toBe("application/zip");
    expect(response.headers.get("Content-Disposition")).toContain('filename="The Gwynnes recipes 2026-10-17.zip"');
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
    expect(JSON.parse(strFromU8(files[`${tuna.id}.json`]))).toEqual(tuna);
  });

  it("goes wherever requireHousehold sends someone without a household", async () => {
    mocks.requireHousehold.mockRejectedValue(new Error("NEXT_REDIRECT /welcome"));
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT /welcome");
    expect(mocks.listRecipeFiles).not.toHaveBeenCalled();
  });
});
