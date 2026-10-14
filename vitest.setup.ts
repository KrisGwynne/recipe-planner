import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// jsdom doesn't scroll; the plan's day strip calls this.
Element.prototype.scrollIntoView ??= function scrollIntoView() {};
