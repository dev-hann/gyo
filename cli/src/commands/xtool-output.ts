import { logger } from '../utils/logger';

const YAML_ERROR_TYPE_MISMATCH = 'typeMismatch';
const YAML_ERROR_DECODE_SCALAR = 'Expected to decode Scalar';

/**
 * Shows why `xtool` failed. Its YAML errors read as a decoding failure that
 * names neither the file nor the line, so they get a plain explanation.
 */
export function showXtoolError(errorOutput: string): void {
  const isYamlError =
    errorOutput.includes(YAML_ERROR_TYPE_MISMATCH) ||
    errorOutput.includes(YAML_ERROR_DECODE_SCALAR);

  if (!isYamlError) {
    logger.error(errorOutput);
    return;
  }

  logger.error(
    [
      'YAML parsing error in xtool.yml',
      'Common issues:',
      '  1. bundleID should be a simple string value, not a mapping',
      '     Correct:   bundleID: com.example.app',
      '     Wrong:     bundleID:',
      '                   key: value',
      '  2. Check for unintended indentation or special characters',
      '',
      'Full error:',
      errorOutput,
    ].join('\n')
  );
}
