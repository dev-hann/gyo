export interface HttpRequest {
  url: string;
  /** Request headers, sent as given: `User-Agent` and `Referer` included. */
  headers?: Record<string, string>;
  /**
   * Name of the cookie jar to use. Requests that share a name share their
   * cookies, which survive app restarts. Without it no cookie is stored or sent.
   */
  jar?: string;
}

export interface HttpResponse {
  status: number;
  /** Where the answer came from, once redirects were followed. */
  url: string;
  /** Response headers by lower-case name. `set-cookie` is left out: the jar owns cookies. */
  headers: Record<string, string>;
  /** Raw body. Decoding is left to the caller, who knows the charset. */
  bodyBase64: string;
}
