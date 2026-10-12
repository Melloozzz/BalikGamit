import { describe, expect, it } from "vitest";
import { withCurrent } from "./api";

describe("withCurrent", () => {
  it("keeps an archived value selectable on a record that uses it", () => {
    expect(withCurrent(["Bags", "Keys"], "Calculators")).toEqual(["Bags", "Keys", "Calculators"]);
    expect(withCurrent(["Bags", "Keys"], "Keys")).toEqual(["Bags", "Keys"]);
    expect(withCurrent(["Bags", "Keys"], "")).toEqual(["Bags", "Keys"]);
  });
});
