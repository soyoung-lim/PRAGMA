import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "./paginatedRows";

describe("fetchAllPages", () => {
  it("continues after a full server-capped page", async () => {
    const fetchPage = vi.fn(async (from: number) => ({
      data: from === 0 ? [1, 2] : [3],
      error: null,
    }));

    await expect(fetchAllPages(fetchPage, 2)).resolves.toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 3);
  });

  it("stops and reports a later-page error", async () => {
    const fetchPage = vi.fn(async (from: number) => from === 0
      ? { data: [1, 2], error: null }
      : { data: null, error: { message: "second page failed" } });

    await expect(fetchAllPages(fetchPage, 2)).rejects.toThrow("second page failed");
  });
});
