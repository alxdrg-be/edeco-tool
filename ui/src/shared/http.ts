/** Shared reading of local API responses: one error text rule for every tool. */

/** Server error as readable text: FastAPI `detail` string, the first validation messages, or the fallback. */
export async function responseError(response: Response, fallback: string): Promise<string> {
  let data: unknown;
  try { data = await response.json(); } catch { return fallback; }
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.slice(0, 3).map(item => (item as { msg?: unknown })?.msg).filter((msg): msg is string => typeof msg === "string" && Boolean(msg));
    if (messages.length) return messages.join(" ");
  }
  return fallback;
}

/** Throw the server's error text, or return the JSON body of a successful response. */
export async function readJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await responseError(response, fallback));
  return await response.json() as T;
}

export const statusFallback = (response: Response) => `${response.status} ${response.statusText}`.trim();
