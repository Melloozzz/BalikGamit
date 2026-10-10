import { describe, expect, it } from "vitest";
import { idOf, keyColumn } from "./db";

describe("links from older notifications", () => {
  it("reads a row id as an id and a reference number as a ref", () => {
    expect(keyColumn("7c9e6679-7425-40de-944b-e07fc1f90ae7")).toBe("id");
    expect(keyColumn("CL-1001")).toBe("ref");
    expect(keyColumn("BG-1042")).toBe("ref");
    expect(keyColumn("not-a-uuid-but-36-characters-long-xx")).toBe("ref");
  });

  it("uses a row id as-is without asking the database", async () => {
    expect(await idOf("claims", "7C9E6679-7425-40DE-944B-E07FC1F90AE7")).toBe("7C9E6679-7425-40DE-944B-E07FC1F90AE7");
  });
});
