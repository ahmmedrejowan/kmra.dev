/**
 * HTTP status codes: every code in the IANA registry (RFC 9110 and the RFCs that add codes) plus
 * the non-standard ones people meet in practice (nginx, Cloudflare, IIS…), each with a plain
 * explanation and a "when to use / common causes" line. Written for this tool; English only.
 */

export interface Status {
  code: number;
  name: string;
  /** What it means */
  desc: string;
  /** When to send it, or what usually causes it */
  use: string;
  /** Where it's defined (RFC) */
  spec?: string;
  /** Not in the IANA registry: who uses it */
  src?: string;
  /** Deprecated or no longer used */
  old?: boolean;
}

export const CLASSES: [number, string, string][] = [
  [1, "1xx", "Informational: the request was received, keep going"],
  [2, "2xx", "Success: the request worked"],
  [3, "3xx", "Redirection: look somewhere else"],
  [4, "4xx", "Client error: the request has a problem"],
  [5, "5xx", "Server error: the server failed"],
];

export const STATUSES: Status[] = [
  // 1xx
  {
    code: 100,
    name: "Continue",
    spec: "RFC 9110",
    desc: "The server got the request headers and the client can send the body.",
    use: "Sent in reply to Expect: 100-continue, so a client can check before uploading a large body.",
  },
  {
    code: 101,
    name: "Switching Protocols",
    spec: "RFC 9110",
    desc: "The server agrees to switch to the protocol the client asked for in Upgrade.",
    use: "Opening a WebSocket connection.",
  },
  {
    code: 102,
    name: "Processing",
    spec: "RFC 2518",
    old: true,
    desc: "The server accepted the request and is still working on it.",
    use: "Old WebDAV servers, to stop a client timing out on a slow request. Deprecated.",
  },
  {
    code: 103,
    name: "Early Hints",
    spec: "RFC 8297",
    desc: "Hints sent before the final response, usually Link headers to preload.",
    use: "Let the browser start loading CSS and fonts while the server builds the page.",
  },
  {
    code: 104,
    name: "Upload Resumption Supported",
    spec: "IETF draft (temporary)",
    desc: "The server supports resumable uploads for this request.",
    use: "Resumable upload protocol (temporary IANA registration).",
  },

  // 2xx
  {
    code: 200,
    name: "OK",
    spec: "RFC 9110",
    desc: "The request worked. The body holds the result.",
    use: "The normal reply to a successful GET, or a POST that returns data.",
  },
  {
    code: 201,
    name: "Created",
    spec: "RFC 9110",
    desc: "The request worked and created a new resource.",
    use: "After a POST or PUT that creates something; put its URL in the Location header.",
  },
  {
    code: 202,
    name: "Accepted",
    spec: "RFC 9110",
    desc: "The request was accepted, but the work isn't done yet.",
    use: "Queued or background jobs. Give a way to check the status later.",
  },
  {
    code: 203,
    name: "Non-Authoritative Information",
    spec: "RFC 9110",
    desc: "The request worked, but a proxy changed the response.",
    use: "Transforming proxies. Rarely used.",
  },
  {
    code: 204,
    name: "No Content",
    spec: "RFC 9110",
    desc: "The request worked and there's nothing to send back.",
    use: "A DELETE, or a PUT or PATCH that doesn't return the updated item.",
  },
  {
    code: 205,
    name: "Reset Content",
    spec: "RFC 9110",
    desc: "The request worked; the client should reset the form or view it came from.",
    use: "Clearing a form after it's submitted. Rarely used.",
  },
  {
    code: 206,
    name: "Partial Content",
    spec: "RFC 9110",
    desc: "Only part of the resource is sent, as asked for with a Range header.",
    use: "Resuming downloads and streaming video or audio.",
  },
  {
    code: 207,
    name: "Multi-Status",
    spec: "RFC 4918",
    desc: "The body holds separate statuses for several resources.",
    use: "WebDAV and batch APIs where some items succeed and some fail.",
  },
  {
    code: 208,
    name: "Already Reported",
    spec: "RFC 5842",
    desc: "These members were already listed earlier in the same reply.",
    use: "WebDAV bindings, to avoid listing the same item twice.",
  },
  {
    code: 226,
    name: "IM Used",
    spec: "RFC 3229",
    desc: "The response is the result of changes (delta encoding) applied to the resource.",
    use: "HTTP delta encoding. Rarely seen.",
  },
  {
    code: 218,
    name: "This is fine",
    src: "Apache",
    desc: "An error page that was allowed to pass through.",
    use: "Apache servers set to let upstream error bodies through.",
  },

  // 3xx
  {
    code: 300,
    name: "Multiple Choices",
    spec: "RFC 9110",
    desc: "There are several versions of the resource to choose from.",
    use: "Content negotiation with a list of options. Rarely used.",
  },
  {
    code: 301,
    name: "Moved Permanently",
    spec: "RFC 9110",
    desc: "The resource has a new permanent URL, given in Location.",
    use: "Moving a page for good, like http to https or an old path to a new one. Browsers may change POST to GET.",
  },
  {
    code: 302,
    name: "Found",
    spec: "RFC 9110",
    desc: "The resource is temporarily at another URL, given in Location.",
    use: "Short-term redirects such as after login. Browsers may change POST to GET; use 303 or 307 to be exact.",
  },
  {
    code: 303,
    name: "See Other",
    spec: "RFC 9110",
    desc: "Go to another URL with GET to see the result.",
    use: "After a form POST, send the browser to a result page so a refresh doesn't resubmit.",
  },
  {
    code: 304,
    name: "Not Modified",
    spec: "RFC 9110",
    desc: "The cached copy is still good; there's no body.",
    use: "Replies to If-None-Match or If-Modified-Since when nothing changed.",
  },
  {
    code: 305,
    name: "Use Proxy",
    spec: "RFC 9110",
    old: true,
    desc: "The resource must be fetched through a proxy.",
    use: "Deprecated for security reasons. Don't use it.",
  },
  {
    code: 306,
    name: "(Unused)",
    spec: "RFC 9110",
    old: true,
    desc: 'Was "Switch Proxy"; now reserved and unused.',
    use: "Never send it.",
  },
  {
    code: 307,
    name: "Temporary Redirect",
    spec: "RFC 9110",
    desc: "The resource is temporarily at another URL; repeat the same method and body there.",
    use: "Temporary redirects where a POST must stay a POST.",
  },
  {
    code: 308,
    name: "Permanent Redirect",
    spec: "RFC 9110",
    desc: "The resource has a new permanent URL; repeat the same method and body there.",
    use: "Permanent moves of API endpoints, where POST must stay POST.",
  },

  // 4xx
  {
    code: 400,
    name: "Bad Request",
    spec: "RFC 9110",
    desc: "The server can't read the request.",
    use: "Malformed JSON, missing fields, bad syntax or an invalid query string.",
  },
  {
    code: 401,
    name: "Unauthorized",
    spec: "RFC 9110",
    desc: 'You need to sign in first. It really means "unauthenticated".',
    use: "No token or a bad or expired one. Send a WWW-Authenticate header with it.",
  },
  {
    code: 402,
    name: "Payment Required",
    spec: "RFC 9110",
    desc: "Reserved for payment; some services use it when a plan has run out.",
    use: "Paywalls and exhausted credits. No standard meaning yet.",
  },
  {
    code: 403,
    name: "Forbidden",
    spec: "RFC 9110",
    desc: "The server knows who you are, but you aren't allowed to do this.",
    use: "Missing permissions, a blocked IP, or file permissions on the server.",
  },
  {
    code: 404,
    name: "Not Found",
    spec: "RFC 9110",
    desc: "Nothing exists at this URL.",
    use: "Typos, deleted pages, broken links, or a wrong route in the API.",
  },
  {
    code: 405,
    name: "Method Not Allowed",
    spec: "RFC 9110",
    desc: "The URL exists but doesn't accept this method.",
    use: "A POST to a read-only URL, for example. List the allowed methods in the Allow header.",
  },
  {
    code: 406,
    name: "Not Acceptable",
    spec: "RFC 9110",
    desc: "The server can't give a response in any format the Accept headers ask for.",
    use: "An Accept header the server can't satisfy, such as only XML from a JSON API.",
  },
  {
    code: 407,
    name: "Proxy Authentication Required",
    spec: "RFC 9110",
    desc: "You need to sign in to the proxy first.",
    use: "Corporate proxies that need credentials.",
  },
  {
    code: 408,
    name: "Request Timeout",
    spec: "RFC 9110",
    desc: "The client took too long to send the request.",
    use: "Slow or stalled connections; servers close idle keep-alive connections with it.",
  },
  {
    code: 409,
    name: "Conflict",
    spec: "RFC 9110",
    desc: "The request clashes with the resource's current state.",
    use: "Editing an outdated version, or creating something that already exists.",
  },
  {
    code: 410,
    name: "Gone",
    spec: "RFC 9110",
    desc: "The resource was here but has been removed for good.",
    use: "Deleted content you want search engines to drop faster than with 404.",
  },
  {
    code: 411,
    name: "Length Required",
    spec: "RFC 9110",
    desc: "The request needs a Content-Length header.",
    use: "A body sent without a length to a server that requires one.",
  },
  {
    code: 412,
    name: "Precondition Failed",
    spec: "RFC 9110",
    desc: "A condition in the request headers wasn't met.",
    use: "If-Match with an outdated ETag: someone else changed it first.",
  },
  {
    code: 413,
    name: "Content Too Large",
    spec: "RFC 9110",
    desc: 'The request body is bigger than the server accepts. Was "Payload Too Large".',
    use: "File uploads over the server's limit, such as nginx client_max_body_size.",
  },
  {
    code: 414,
    name: "URI Too Long",
    spec: "RFC 9110",
    desc: "The URL is longer than the server will read.",
    use: "Huge query strings; send the data in a POST body instead.",
  },
  {
    code: 415,
    name: "Unsupported Media Type",
    spec: "RFC 9110",
    desc: "The server doesn't accept the body's format.",
    use: "A wrong or missing Content-Type, like form data sent to a JSON API.",
  },
  {
    code: 416,
    name: "Range Not Satisfiable",
    spec: "RFC 9110",
    desc: "The requested range is outside the file.",
    use: "Resuming a download of a file that has since changed or shrunk.",
  },
  {
    code: 417,
    name: "Expectation Failed",
    spec: "RFC 9110",
    desc: "The server can't meet the Expect header.",
    use: "Expect: 100-continue sent to a server or proxy that doesn't support it.",
  },
  {
    code: 418,
    name: "I'm a teapot",
    spec: "RFC 2324 (April Fools')",
    src: "Joke, reserved",
    desc: "The server refuses to brew coffee because it is a teapot.",
    use: "An April Fools' joke from 1998. Reserved so it's never given a real meaning; some sites use it for fun or for blocked bots.",
  },
  {
    code: 419,
    name: "Page Expired",
    src: "Laravel",
    desc: "The form's CSRF token has expired.",
    use: "Submitting a Laravel form after the session timed out.",
  },
  {
    code: 420,
    name: "Enhance Your Calm",
    src: "Twitter (old API)",
    desc: "Too many requests. The old Twitter API used it before 429 existed.",
    use: "Rate limiting in old clients. Use 429 instead.",
  },
  {
    code: 421,
    name: "Misdirected Request",
    spec: "RFC 9110",
    desc: "This server can't answer for the requested host.",
    use: "HTTP/2 connection reuse across hosts with different certificates.",
  },
  {
    code: 422,
    name: "Unprocessable Content",
    spec: "RFC 9110",
    desc: 'The request is well formed but the data doesn\'t make sense. Was "Unprocessable Entity".',
    use: "Validation errors, like an invalid email in valid JSON.",
  },
  {
    code: 423,
    name: "Locked",
    spec: "RFC 4918",
    desc: "The resource is locked.",
    use: "WebDAV files that someone else has locked for editing.",
  },
  {
    code: 424,
    name: "Failed Dependency",
    spec: "RFC 4918",
    desc: "The request failed because an earlier one it depends on failed.",
    use: "WebDAV and batch operations.",
  },
  {
    code: 425,
    name: "Too Early",
    spec: "RFC 8470",
    desc: "The server won't process a request that might be replayed.",
    use: "TLS 1.3 early data (0-RTT) for requests that aren't safe to repeat.",
  },
  {
    code: 426,
    name: "Upgrade Required",
    spec: "RFC 9110",
    desc: "The client must switch to another protocol, named in Upgrade.",
    use: "Servers that require a newer protocol, such as TLS or HTTP/2.",
  },
  {
    code: 428,
    name: "Precondition Required",
    spec: "RFC 6585",
    desc: "The request must be conditional, with If-Match or similar.",
    use: "APIs that prevent lost updates by requiring an ETag.",
  },
  {
    code: 429,
    name: "Too Many Requests",
    spec: "RFC 6585",
    desc: "You sent too many requests in a given time.",
    use: "Rate limits. Send Retry-After to say when to try again.",
  },
  {
    code: 430,
    name: "Request Header Fields Too Large",
    src: "Shopify",
    desc: "Shopify's code for too many requests or oversized headers.",
    use: "Shopify storefront rate limiting.",
  },
  {
    code: 431,
    name: "Request Header Fields Too Large",
    spec: "RFC 6585",
    desc: "The headers, or one header, are too large.",
    use: "Too many or very large cookies, or a huge Referer.",
  },
  {
    code: 440,
    name: "Login Time-out",
    src: "Microsoft IIS",
    desc: "The session has expired; sign in again.",
    use: "Outlook Web Access and other IIS apps.",
  },
  {
    code: 444,
    name: "No Response",
    src: "nginx",
    desc: "nginx closed the connection without replying.",
    use: "nginx configs that drop bots or unwanted requests with return 444. Only seen in logs.",
  },
  {
    code: 449,
    name: "Retry With",
    src: "Microsoft IIS",
    desc: "Retry after doing the right action.",
    use: "Microsoft Exchange ActiveSync.",
  },
  {
    code: 450,
    name: "Blocked by Windows Parental Controls",
    src: "Microsoft",
    desc: "Windows parental controls blocked the page.",
    use: "Family safety settings on Windows.",
  },
  {
    code: 451,
    name: "Unavailable For Legal Reasons",
    spec: "RFC 7725",
    desc: "The resource can't be shown for legal reasons.",
    use: "Court orders, government censorship or geo-blocking for legal reasons.",
  },
  {
    code: 460,
    name: "Client closed connection",
    src: "AWS load balancer",
    desc: "The client closed the connection before the load balancer's idle timeout.",
    use: "AWS Elastic Load Balancing logs, when the client gave up first.",
  },
  {
    code: 494,
    name: "Request header too large",
    src: "nginx",
    desc: "nginx's own code for headers that are too big.",
    use: "Large cookies; nginx shows it to the client as 400.",
  },
  {
    code: 495,
    name: "SSL Certificate Error",
    src: "nginx",
    desc: "The client certificate is invalid.",
    use: "Mutual TLS with a bad client certificate.",
  },
  {
    code: 496,
    name: "SSL Certificate Required",
    src: "nginx",
    desc: "A client certificate was required but not sent.",
    use: "Mutual TLS without a client certificate.",
  },
  {
    code: 497,
    name: "HTTP Request Sent to HTTPS Port",
    src: "nginx",
    desc: "Plain HTTP was sent to a port that expects HTTPS.",
    use: "http:// used with an https port, like http://example.com:443.",
  },
  {
    code: 498,
    name: "Invalid Token",
    src: "Esri ArcGIS",
    desc: "The token has expired or is invalid.",
    use: "ArcGIS Server.",
  },
  {
    code: 499,
    name: "Client Closed Request",
    src: "nginx",
    desc: "The client closed the connection while nginx was still waiting for the upstream.",
    use: "Slow backends: users or load balancers gave up before the reply. Only seen in logs.",
  },

  // 5xx
  {
    code: 500,
    name: "Internal Server Error",
    spec: "RFC 9110",
    desc: "Something went wrong on the server and it has no more specific code.",
    use: "Uncaught exceptions and bugs. Check the server logs.",
  },
  {
    code: 501,
    name: "Not Implemented",
    spec: "RFC 9110",
    desc: "The server doesn't support what the request needs.",
    use: "An HTTP method the server doesn't know, or a feature not built yet.",
  },
  {
    code: 502,
    name: "Bad Gateway",
    spec: "RFC 9110",
    desc: "A proxy or gateway got a bad reply from the server behind it.",
    use: "The app server crashed, isn't running, or returned garbage to nginx or a load balancer.",
  },
  {
    code: 503,
    name: "Service Unavailable",
    spec: "RFC 9110",
    desc: "The server can't handle the request right now.",
    use: "Maintenance or overload. Send Retry-After if you know when it'll be back.",
  },
  {
    code: 504,
    name: "Gateway Timeout",
    spec: "RFC 9110",
    desc: "A proxy or gateway didn't get a reply in time from the server behind it.",
    use: "Slow database queries or backends; the proxy's timeout ran out.",
  },
  {
    code: 505,
    name: "HTTP Version Not Supported",
    spec: "RFC 9110",
    desc: "The server doesn't support the HTTP version used.",
    use: "Very old or very new HTTP versions the server doesn't speak.",
  },
  {
    code: 506,
    name: "Variant Also Negotiates",
    spec: "RFC 2295",
    desc: "A server configuration error in content negotiation.",
    use: "Misconfigured transparent content negotiation. Rare.",
  },
  {
    code: 507,
    name: "Insufficient Storage",
    spec: "RFC 4918",
    desc: "The server can't store what's needed to finish the request.",
    use: "WebDAV uploads to a full disk or quota.",
  },
  {
    code: 508,
    name: "Loop Detected",
    spec: "RFC 5842",
    desc: "The server found an infinite loop while processing.",
    use: "WebDAV bindings that point back to themselves.",
  },
  {
    code: 509,
    name: "Bandwidth Limit Exceeded",
    src: "Apache, cPanel",
    desc: "The site has used up its bandwidth allowance.",
    use: "Shared hosting with a monthly traffic cap.",
  },
  {
    code: 510,
    name: "Not Extended",
    spec: "RFC 2774",
    old: true,
    desc: "The request needs extensions the server doesn't have.",
    use: "The HTTP extension framework, which is now historic.",
  },
  {
    code: 511,
    name: "Network Authentication Required",
    spec: "RFC 6585",
    desc: "You need to sign in to the network first.",
    use: "Captive portals on hotel, airport and café Wi-Fi.",
  },
  {
    code: 520,
    name: "Web Server Returned an Unknown Error",
    src: "Cloudflare",
    desc: "The origin server sent an empty, unknown or unexpected reply.",
    use: "Origin crashes, oversized headers, or the origin resetting the connection.",
  },
  {
    code: 521,
    name: "Web Server Is Down",
    src: "Cloudflare",
    desc: "The origin server refused the connection.",
    use: "The web server isn't running, or a firewall blocks Cloudflare's IPs.",
  },
  {
    code: 522,
    name: "Connection Timed Out",
    src: "Cloudflare",
    desc: "Cloudflare couldn't open a connection to the origin in time.",
    use: "An overloaded origin, a firewall dropping packets, or wrong DNS.",
  },
  {
    code: 523,
    name: "Origin Is Unreachable",
    src: "Cloudflare",
    desc: "Cloudflare can't reach the origin at all.",
    use: "Wrong DNS records or routing problems.",
  },
  {
    code: 524,
    name: "A Timeout Occurred",
    src: "Cloudflare",
    desc: "The origin connected but didn't reply within 100 seconds.",
    use: "Long-running requests; move them to a background job.",
  },
  {
    code: 525,
    name: "SSL Handshake Failed",
    src: "Cloudflare",
    desc: "The TLS handshake with the origin failed.",
    use: "No certificate on the origin, or no shared cipher suite.",
  },
  {
    code: 526,
    name: "Invalid SSL Certificate",
    src: "Cloudflare",
    desc: "The origin's certificate couldn't be validated.",
    use: "Expired or self-signed origin certificates with Full (strict) SSL.",
  },
  {
    code: 527,
    name: "Railgun Error",
    src: "Cloudflare",
    old: true,
    desc: "The connection to the origin through Railgun failed.",
    use: "Cloudflare's retired Railgun service.",
  },
  {
    code: 529,
    name: "Site is overloaded",
    src: "Qualys",
    desc: "The site can't handle the request because it's overloaded.",
    use: "Qualys SSL Labs and some APIs under heavy load.",
  },
  {
    code: 530,
    name: "Origin DNS error",
    src: "Cloudflare",
    desc: "Returned together with a Cloudflare 1xxx error, such as a DNS problem.",
    use: "Look at the 1xxx error code on the page for the cause.",
  },
  {
    code: 561,
    name: "Unauthorized",
    src: "AWS load balancer",
    desc: "The identity provider rejected the user while authenticating.",
    use: "AWS Elastic Load Balancing with built-in authentication.",
  },
  {
    code: 598,
    name: "Network read timeout error",
    src: "Some proxies",
    desc: "A proxy timed out reading from the server behind it.",
    use: "Some HTTP proxies. Unofficial.",
  },
  {
    code: 599,
    name: "Network connect timeout error",
    src: "Some proxies",
    desc: "A proxy timed out connecting to the server behind it.",
    use: "Some HTTP proxies and clients. Unofficial.",
  },
].sort((a, b) => a.code - b.code);

/** Lower-case text to search in */
export function haystack(s: Status): string {
  return `${s.code} ${s.name} ${s.desc} ${s.use} ${s.src ?? ""} ${s.spec ?? ""}`.toLowerCase();
}

/**
 * Codes matching a query: a number (or its start, like "40") matches codes; words must all
 * appear somewhere in the name, explanation or source. Name matches come first.
 */
export function search(list: Status[], q: string): Status[] {
  const t = q.trim().toLowerCase();
  if (!t) return list;
  if (/^\d{1,3}$/.test(t))
    return list.filter((s) => String(s.code).startsWith(t));
  const words = t
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const hits = list.filter((s) => {
    const h = haystack(s);
    return words.every((w) => h.includes(w));
  });
  const inName = (s: Status) =>
    words.every((w) => s.name.toLowerCase().includes(w));
  return [...hits.filter(inName), ...hits.filter((s) => !inName(s))];
}
