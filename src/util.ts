/**
 * Sends a structured success response to the user.
 *
 * @param data {object|string} Data to send back as serialized response
 * @param init {object} Response initialization values
 * @returns Response object to send back
 */
export function send(data: object | string | null, init?: ResponseInit) {
  return new Response(data instanceof Object ? JSON.stringify(data) : data, {
    ...init,
    headers: {
      ...cors(),
      ...init?.headers,
    },
  });
}

/**
 * Sends a failure response to the user.
 *
 * @param code {number} HTTP Status code
 * @param message {string} Message of the error
 * @returns Response object to send back
 */
export function failure(
  code: number,
  message: string | object,
  status_code: string | undefined = undefined
) {
  return new Response(
    JSON.stringify({
      status_code,
      error: message,
    }),
    {
      status: code,
      statusText: typeof message === "string" ? message : "ERROR",
      headers: {
        ...cors(),
      },
    }
  );
}

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
 * Returns a failure notice as a standard internal error message.
 */
export const internalError = () =>
  failure(404, "Internal or unknown error detected", "INTERNAL_ERROR");

/**
 * Cleanses an HTML string.
 *
 * @param {string} Input HTML value
 * @return {string} Returns cleansed HTML
 */
export function cleanText(html: string): string {
  if (!html) return '';
  // yea yea regex to clean HTML is lame yada yada
  html = html.replace(/<\/p>/ig, ''); // remove trailing </p>s
  if (!html.match(/^<p>/i)) html = '<p>' + html; // prepend <p>
  return html;
}
