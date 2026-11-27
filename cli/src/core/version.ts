/**
 * The order of two versions as npm writes them: `1.2.3`, with an optional
 * pre-release after a hyphen and an optional build after a plus. A
 * pre-release comes before the release it leads up to; its numeric parts
 * compare as numbers, so `beta.10` follows `beta.2`.
 *
 * Negative when `a` is older than `b`, 0 for the same version, positive
 * when it is newer.
 */
export function compareVersions(a: string, b: string): number {
  const [aRelease, aPre] = parse(a);
  const [bRelease, bPre] = parse(b);

  for (let i = 0; i < 3; i++) {
    const difference = (aRelease[i] ?? 0) - (bRelease[i] ?? 0);
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }

  if (aPre === undefined || bPre === undefined) {
    // No pre-release is above any pre-release of the same release.
    return aPre === bPre ? 0 : aPre === undefined ? 1 : -1;
  }

  const left = aPre.split('.');
  const right = bPre.split('.');
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i++) {
    const x = left[i];
    const y = right[i];
    if (x === y) {
      continue;
    }
    // A numeric part comes before a text one.
    const numericX = /^\d+$/.test(x);
    const numericY = /^\d+$/.test(y);
    if (numericX && numericY) {
      return Math.sign(Number(x) - Number(y));
    }
    if (numericX !== numericY) {
      return numericX ? -1 : 1;
    }
    return x < y ? -1 : 1;
  }
  // A shorter pre-release comes first.
  return Math.sign(left.length - right.length);
}

/** The three numbers of a release, and its pre-release when it has one. */
function parse(version: string): [number[], string | undefined] {
  const plain = version.trim().replace(/^v/, '').split('+')[0];
  const hyphen = plain.indexOf('-');
  const release = (hyphen === -1 ? plain : plain.slice(0, hyphen))
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  return [release, hyphen === -1 ? undefined : plain.slice(hyphen + 1)];
}
