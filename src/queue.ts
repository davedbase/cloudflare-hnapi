import TimeQueue from "timequeue";

/**
 * A general fetch worker that ensures more than 1000 requests
 * are never reached by the worker.
 */
async function worker(
  url: string,
  options?: { isPage: boolean; ip?: string } | null
): Promise<string> {
  // Handles a forwarded page request
  if (options !== null) {
    const resp = await fetch(url, {
      method: "GET",
      headers: { "X-Forwarded-For": options.ip },
    });
    return await resp.text();
  }
  // Handles an API page request and returns JSON
  const resp = await fetch(url);
  return await resp.json();
}
const fetchQueue = new TimeQueue(worker, { concurrency: 999 });

export default fetchQueue;
