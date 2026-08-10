export type PageResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  pageSize = 1_000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw new Error(error.message ?? "페이지 조회 실패");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
