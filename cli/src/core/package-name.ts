// Words that cannot be used as a Java package segment.
const JAVA_RESERVED_WORDS = new Set([
  'abstract',
  'assert',
  'boolean',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'continue',
  'default',
  'do',
  'double',
  'else',
  'enum',
  'extends',
  'final',
  'finally',
  'float',
  'for',
  'goto',
  'if',
  'implements',
  'import',
  'instanceof',
  'int',
  'interface',
  'long',
  'native',
  'new',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'short',
  'static',
  'strictfp',
  'super',
  'switch',
  'synchronized',
  'this',
  'throw',
  'throws',
  'transient',
  'try',
  'void',
  'volatile',
  'while',
  'true',
  'false',
  'null',
]);

/**
 * Turns an accepted project name into a valid Java package segment:
 * hyphens become underscores, and a name that starts with a digit or is a
 * reserved word gets an `app_` prefix.
 */
export function toPackageNameSegment(projectName: string): string {
  let segment = projectName.replace(/-/g, '_');
  if (/^[0-9]/.test(segment) || JAVA_RESERVED_WORDS.has(segment)) {
    segment = `app_${segment}`;
  }
  return segment;
}

export function toDefaultPackageName(projectName: string): string {
  return `com.example.${toPackageNameSegment(projectName)}`;
}
