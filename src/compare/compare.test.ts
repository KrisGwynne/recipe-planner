import { describe, expect, it } from "vitest";
import { barWidths, choseInAddress, chooseHref, compareHref, paramsOf, parseChosen, readRemembered } from "./compare";

describe("parseChosen", () => {
  it("keeps the order chosen, drops repeats and stops at four", () => {
    const params = new URLSearchParams("r=b&r=a&r=b&r=c&r=d&r=e");
    expect(parseChosen(params)).toEqual(["b", "a", "c", "d"]);
  });

  it("ignores empty or overlong values", () => {
    expect(parseChosen(new URLSearchParams(`r=&r=${"x".repeat(201)}&r=ok`))).toEqual(["ok"]);
  });

  it("reads a page's searchParams", () => {
    expect(parseChosen(paramsOf({ r: ["a", "b"] }))).toEqual(["a", "b"]);
    expect(parseChosen(paramsOf({ r: "a" }))).toEqual(["a"]);
    expect(parseChosen(paramsOf({}))).toEqual([]);
  });
});

describe("links", () => {
  it("puts the slugs in the address in order", () => {
    expect(compareHref(["tuna-pasta", "char-siu"])).toBe("/compare?r=tuna-pasta&r=char-siu");
    // Removing the last one is a choice, not "show me the last comparison".
    expect(compareHref([])).toBe("/compare?r=");
    expect(choseInAddress(new URLSearchParams("r="))).toBe(true);
    expect(choseInAddress(new URLSearchParams(""))).toBe(false);
    expect(chooseHref(["tuna-pasta"])).toBe("/compare/choose?r=tuna-pasta");
  });
});

describe("readRemembered", () => {
  it("reads what was saved, and nothing from anything else", () => {
    expect(readRemembered(JSON.stringify(["a", "b"]))).toEqual(["a", "b"]);
    expect(readRemembered(JSON.stringify(["a", 3, "a", "b", "c", "d", "e"]))).toEqual(["a", "b", "c", "d"]);
    expect(readRemembered(null)).toEqual([]);
    expect(readRemembered("not json")).toEqual([]);
    expect(readRemembered(JSON.stringify({ r: "a" }))).toEqual([]);
  });
});

describe("barWidths", () => {
  it("scales to the largest value, which reaches 78%", () => {
    expect(barWidths([672, 825])).toEqual([63.5, 78]);
  });

  it("starts at zero, whatever the values", () => {
    expect(barWidths([0, 10])).toEqual([0, 78]);
    expect(barWidths([0, 0])).toEqual([0, 0]);
  });
});
