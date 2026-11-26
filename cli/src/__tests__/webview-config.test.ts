import { toWebViewSettings } from '../core/webview-config';

describe('toWebViewSettings', () => {
  it('should return undefined when no webview settings are configured', () => {
    expect(toWebViewSettings(undefined)).toBeUndefined();
    expect(toWebViewSettings({})).toBeUndefined();
  });

  it('should keep the configured settings', () => {
    const settings = {
      allowFileAccess: true,
      allowUniversalAccessFromFileURLs: true,
      userAgent: 'MyApp/1.0',
    };

    expect(toWebViewSettings(settings)).toEqual(settings);
  });

  it('should treat the legacy default user agent as unset', () => {
    expect(toWebViewSettings({ userAgent: 'gyo-webview/1.0' })).toBeUndefined();
    expect(toWebViewSettings({ userAgent: 'gyo-webview/1.0', allowFileAccess: true })).toEqual({
      allowFileAccess: true,
    });
  });

  it('should ignore a blank user agent', () => {
    expect(toWebViewSettings({ userAgent: '   ' })).toBeUndefined();
  });

  it('should trim the user agent', () => {
    expect(toWebViewSettings({ userAgent: '  MyApp/1.0 ' })).toEqual({ userAgent: 'MyApp/1.0' });
  });
});
