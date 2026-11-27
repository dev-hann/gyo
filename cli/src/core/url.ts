const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host);
}

/**
 * The host `url` names, when it names a machine rather than "the machine
 * gyo runs on": a loopback host is replaced by the LAN address at run time.
 */
export function namedHostOf(url: string): string | undefined {
  try {
    const { hostname } = new URL(url);
    return isLoopbackHost(hostname) ? undefined : hostname;
  } catch {
    return undefined;
  }
}
