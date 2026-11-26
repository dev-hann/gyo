import type { GyoConfig } from './types';

export type WebViewConfig = NonNullable<GyoConfig['webview']>;

// `gyo create` used to write this into every project. No shell ever applied
// it, so treating it as a real value now would change the user agent of
// every project created before shells read the setting.
const LEGACY_DEFAULT_USER_AGENT = 'gyo-webview/1.0';

/**
 * The webview settings a shell has to apply, or undefined when there are none.
 */
export function toWebViewSettings(webview?: WebViewConfig): WebViewConfig | undefined {
  if (!webview) {
    return undefined;
  }

  const settings: WebViewConfig = {};
  if (webview.allowFileAccess !== undefined) {
    settings.allowFileAccess = webview.allowFileAccess;
  }
  if (webview.allowUniversalAccessFromFileURLs !== undefined) {
    settings.allowUniversalAccessFromFileURLs = webview.allowUniversalAccessFromFileURLs;
  }
  const userAgent = webview.userAgent?.trim();
  if (userAgent && userAgent !== LEGACY_DEFAULT_USER_AGENT) {
    settings.userAgent = userAgent;
  }

  return Object.keys(settings).length > 0 ? settings : undefined;
}
