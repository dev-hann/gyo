import {
  DEFAULT_PORT,
  WEB_SERVER_TIMEOUT_MS,
  PROCESS_KILL_TIMEOUT_MS,
  LOCALHOST,
} from '../core/constants';

describe('constants', () => {
  describe('DEFAULT_PORT', () => {
    it('should be 3000', () => {
      expect(DEFAULT_PORT).toBe(3000);
    });

    it('should be a number', () => {
      expect(typeof DEFAULT_PORT).toBe('number');
    });
  });

  describe('WEB_SERVER_TIMEOUT_MS', () => {
    it('should be 30000', () => {
      expect(WEB_SERVER_TIMEOUT_MS).toBe(30000);
    });

    it('should be a number', () => {
      expect(typeof WEB_SERVER_TIMEOUT_MS).toBe('number');
    });

    it('should represent 30 seconds', () => {
      expect(WEB_SERVER_TIMEOUT_MS / 1000).toBe(30);
    });
  });

  describe('PROCESS_KILL_TIMEOUT_MS', () => {
    it('should be 2000', () => {
      expect(PROCESS_KILL_TIMEOUT_MS).toBe(2000);
    });

    it('should be a number', () => {
      expect(typeof PROCESS_KILL_TIMEOUT_MS).toBe('number');
    });

    it('should represent 2 seconds', () => {
      expect(PROCESS_KILL_TIMEOUT_MS / 1000).toBe(2);
    });
  });

  describe('LOCALHOST', () => {
    it('should be localhost', () => {
      expect(LOCALHOST).toBe('localhost');
    });

    it('should be a string', () => {
      expect(typeof LOCALHOST).toBe('string');
    });

    it('should match common localhost hostname', () => {
      expect(LOCALHOST).toMatch(/localhost/);
    });
  });

  describe('timeout relationships', () => {
    it('should have web server timeout greater than process kill timeout', () => {
      expect(WEB_SERVER_TIMEOUT_MS).toBeGreaterThan(PROCESS_KILL_TIMEOUT_MS);
    });
  });
});
