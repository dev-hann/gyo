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
    /** The page's `window`, as far as the script is concerned: where the event goes and who hears it. */
    let page: EventTarget;

    beforeEach(() => {
      page = new EventTarget();
      Object.assign(globalThis, { window: page });
    });

    afterEach(() => {
      delete (globalThis as { window?: unknown }).window;
    });

    /** Runs what the shell asks the page when Back is pressed; true when the page takes it. */
    function askThePage(): unknown {
      const script = activity().match(/askThePageAboutBack = """([\s\S]*?)"""/)?.[1];
      if (script === undefined) {
        throw new Error('The shell does not ask the page about Back');
      }
      // As a script, for its completion value: that is what evaluateJavascript hands back.
      return (0, eval)(script);
    }

    it('should leave the back press to the shell when nothing on the page takes it', () => {
      expect(askThePage()).toBe(false);
    });

    it('should let the page take the back press, as a modal that must stay open does', () => {
      const stay = (event: Event): void => event.preventDefault();
      page.addEventListener('gyo:backbutton', stay);

      expect(askThePage()).toBe(true);

      page.removeEventListener('gyo:backbutton', stay);
    });

    it('should tell the page with a cancelable event on window', () => {
      const heard: Event[] = [];
      const listen = (event: Event): void => {
        heard.push(event);
      };
      page.addEventListener('gyo:backbutton', listen);

      askThePage();

      expect(heard).toHaveLength(1);
      expect(heard[0]).toMatchObject({ type: 'gyo:backbutton', cancelable: true });
      page.removeEventListener('gyo:backbutton', listen);
    });

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
