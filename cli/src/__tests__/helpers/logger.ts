import { logger } from '../../utils/logger';

/**
 * The real logger with every method silenced: nothing is printed, and a
 * test can assert on what the user is told. It is the real object, so a
 * method added to the logger is silenced without a test knowing, and none
 * is missing when a command calls it.
 */
export function silenceLogger(): void {
  const methods = logger as unknown as Record<string, () => void>;
  for (const name of Object.keys(methods)) {
    jest.spyOn(methods, name).mockImplementation(() => undefined);
  }
}
