import { compareVersions } from '../core/version';

describe('compareVersions', () => {
  it.each([
    ['0.2.0', '0.2.0', 0],
    ['0.2.1', '0.2.0', 1],
    ['0.2.0', '0.10.0', -1],
    ['1.0.0', '0.9.9', 1],
    ['0.2', '0.2.0', 0],
    ['v0.2.0', '0.2.0', 0],
    ['0.2.0-beta.1', '0.2.0', -1],
    ['0.2.0-beta', '0.2.0-beta.1', -1],
    ['0.2.0-beta.10', '0.2.0-beta.2', 1],
    ['0.2.0-alpha', '0.2.0-beta', -1],
    ['0.2.0+build.5', '0.2.0', 0],
  ])('should order %s against %s as %i', (a, b, expected) => {
    expect(Math.sign(compareVersions(a, b))).toBe(expected);
    expect(Math.sign(compareVersions(b, a))).toBe(expected === 0 ? 0 : -expected);
  });
});
