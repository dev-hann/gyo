/** Why a request failed. The message of the failure says what to do about it. */
export type MediaFailureKind =
  // The server could not be reached, answered with an error or sent nothing.
  | 'network'
  // The request cannot be taken as given: an address that is not http or https, a web page in place of a file.
  | 'unsupported'
  // A permission the app has to ask the user for is not granted.
  | 'permission'
  // The file could not be written.
  | 'storage'
  // The user backed out. The Android side never answers it: it does not watch the chooser.
  | 'canceled';

export interface SaveRequest {
  url: string;
  /** As the server names it; null when it does not. */
  mimeType?: string | null;
  /** File name without a path; made up from the url when missing. */
  filename?: string;
  /** The user agent the download is made with. Send the page's own: sites block unknown clients. */
  userAgent?: string;
  /** Folder inside Pictures, Movies or Downloads. */
  folder?: string;
}

/** What `share()` offers: a file it downloads first, or a text. */
export type ShareRequest = SaveRequest | { text: string };

export interface MediaFailure {
  kind: MediaFailureKind;
  message: string;
}

export interface SavedResult {
  status: 'saved';
  /** The content uri of the stored file; a `file:` uri where the system gave none. */
  uri: string;
  /** The MIME type the file was stored under. */
  mimeType: string;
}

export interface SharedResult {
  status: 'shared';
}

export interface FailedResult {
  status: 'failed';
  error: MediaFailure;
}

export type SaveResult = SavedResult | FailedResult;
export type ShareResult = SharedResult | FailedResult;
