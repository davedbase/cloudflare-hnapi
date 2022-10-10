import { text } from "itty-router-extras";

/**
 * Handles preflight OPTION requests.
 *
 * @param request {Request} Request object
 * @returns Properly structured preflight response
 */
export function handleOptions(request: Request) {
  let headers = request.headers;
  if (
    headers.get("Origin") !== null &&
    headers.get("Access-Control-Request-Method") !== null &&
    headers.get("Access-Control-Request-Headers") !== null
  ) {
    return new Response(null, {
      headers: {
        ...cors(request),
      },
    });
  } else {
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS, PUT, DELETE, PATCH",
      },
    });
  }
}

/**
 * CORs output generator based on dynamic request.
 *
 * @param _request {Request} Incoming request object
 * @returns A set of default cors headers to reply with.
 */
export function cors(_request?: Request) {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,OPTIONS,DELETE,PATCH",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Cleanses an HTML string.
 *
 * @param {string} Input HTML value
 * @return {string} Returns cleansed HTML
 */
export function cleanText(html: string): string {
  if (!html) return "";
  html = html.replace(/<\/p>/gi, ""); // remove trailing </p>s
  if (!html.match(/^<p>/i)) html = "<p>" + html; // prepend <p>
  return html;
}

/**
 * Cleanses more complex content string.
 *
 * @param {string} Input HTML value
 * @return {string} Returns cleansed HTML
 */
export function cleanContent(html) {
  html = html.replace(/">-+<\/font/gi, '"></font'); // remove weird invisible dashes at the end of comments
  html = html.replace(/<\/?font[^<>]*>/gi, ""); // remove font tags
  html = html.replace(/<\/p>/gi, ""); // remove trailing </p>s
  if (!html.match(/^<p>/i)) html = "<p>" + html; // prepend <p>
  return html;
}

declare global {
  var HNAPICACHE: {
    put: (key: string, value: string, meta: { expirationTtl: number }) => void;
    get: (key: string) => string;
  };
}

/**
 * Helper for setting the cache value.
 *
 * @param {string} Key of the cache value to store
 * @param {string} Value of the cache value to store
 */
export async function setCache(url: string, value: object): Promise<void> {
  const path = new URL(url);
  await HNAPICACHE.put(path.pathname, JSON.stringify(value), {
    expirationTtl: 15 * 60,
  }); // 15 minute in seconds
}

/**
 * Retrieves the cache value.
 *
 * @param {string} Key value to pull
 * @return {string} Returns the cached value from the worker
 */
async function getCache(key: string): Promise<string | null> {
  return await HNAPICACHE.get(key);
}
/**
 * Middleware function that checks cache before allowing the route through.
 *
 * @param {Request} Request Object from the server
 * @return Returns either the cached value as JSON or a value to continue the route.
 */
export async function withCache(req: Request) {
  const path = new URL(req.url);
  const value = await getCache(path.pathname);
  if (value != null) {
    return text(value, { headers: { "Content-Type": "application/json" } });
  }
  return undefined;
}
