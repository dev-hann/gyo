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

export interface DownloadRequest {
  url: string;
  /** Request headers, sent as given. */
  headers?: Record<string, string>;
  /** The name of the file in the app's cache. Left out, it is the last part of the address. */
  fileName?: string;
}

export interface DownloadProgress {
  /** The bytes written so far. */
  bytesWritten: number;
  /** The bytes the server announced, or -1 when it did not. */
  totalBytes: number;
}

export interface DownloadResult {
  /** Where the file is: an absolute path, in the app's cache. */
  path: string;
  bytesWritten: number;
  /** The status the server answered, once redirects were followed; 2xx, since anything else fails the download. */
  status: number;
  /** Where the file came from, once redirects were followed. */
  url: string;
  /** Response headers by lower-case name. */
  headers: Record<string, string>;
}

export interface DownloadOptions {
  /** Called as bytes arrive with the progress of the download; not called once it has ended. */
  onProgress?: (progress: DownloadProgress) => void;
}
