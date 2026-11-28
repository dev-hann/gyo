import fs from 'fs-extra';
import { createTestProject } from './helpers/project';
import type { TestProject } from './helpers/project';

// `utils/paths` reads import.meta.url, which Jest's CommonJS transform cannot run. Point it at the real templates instead.
jest.mock('../utils/paths', () => ({
  getTemplatesPath: () => jest.requireActual('path').join(__dirname, '../../templates'),
}));

// The spinner writes to the terminal, and is ESM-only.
jest.mock('ora', () => () => ({
  start: jest.fn(),
  stop: jest.fn(),
  succeed: jest.fn(),
  fail: jest.fn(),
  warn: jest.fn(),
}));

// The Android shell is Kotlin, which no Jest test can run. What it hands to
// the page is JavaScript: that is read from the project `gyo create` writes
// and run here. The rest of the shell is only asserted where a wrong line
// has been shipped before.
describe('Android shell', () => {
  let project: TestProject;

  const read = (...segments: string[]): string =>
    fs.readFileSync(project.android(...segments), 'utf-8');
  const activity = (): string => read('app/src/main/java/com/example/demo_app/MainActivity.kt');

  beforeEach(async () => {
    project = await createTestProject();
  });

  afterEach(() => project.remove());

  describe('the back button', () => {
    it('should not be switched off once it has left the app', () => {
      // Android 12 and later move a launcher activity to the back instead of
      // finishing it. A handler that switched itself off before that stayed
      // off: Back never went back in the page again.
      const handler = activity();

      expect(handler).not.toMatch(/isEnabled\s*=\s*false/);
      expect(handler).toContain('moveTaskToBack(true)');
    });

    it('should animate the back gesture on Android 13 to 15', () => {
      expect(read('app/src/main/AndroidManifest.xml')).toContain(
        'android:enableOnBackInvokedCallback="true"'
      );
    });
  });
});
