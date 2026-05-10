import { logger } from '../utils/logger';

describe('logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let originalDebug: string | undefined;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    originalDebug = process.env.DEBUG;
    delete process.env.DEBUG;
    logger.resetVerbose();
    delete process.env.DEBUG;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    if (originalDebug === undefined) {
      delete process.env.DEBUG;
    } else {
      process.env.DEBUG = originalDebug;
    }
  });

  describe('setVerbose / isVerbose', () => {
    it('should return false by default', () => {
      expect(logger.isVerbose()).toBe(false);
    });

    it('should return true after setVerbose(true)', () => {
      logger.setVerbose(true);
      expect(logger.isVerbose()).toBe(true);
    });

    it('should return false after setVerbose(false)', () => {
      logger.setVerbose(true);
      logger.setVerbose(false);
      expect(logger.isVerbose()).toBe(false);
    });
  });

  describe('info', () => {
    it('should call console.log with blue info prefix', () => {
      logger.info('test message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0];
      expect(output[0]).toContain('ℹ');
      expect(output[1]).toBe('test message');
    });
  });

  describe('success', () => {
    it('should call console.log with green success prefix', () => {
      logger.success('done');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0];
      expect(output[0]).toContain('✓');
      expect(output[1]).toBe('done');
    });
  });

  describe('warn', () => {
    it('should call console.log with yellow warning prefix', () => {
      logger.warn('caution');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0];
      expect(output[0]).toContain('⚠');
      expect(output[1]).toBe('caution');
    });
  });

  describe('error', () => {
    it('should call console.log with red error prefix', () => {
      logger.error('failed');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0];
      expect(output[0]).toContain('✗');
      expect(output[1]).toBe('failed');
    });
  });

  describe('debug', () => {
    it('should not log when DEBUG env is not set', () => {
      delete process.env.DEBUG;
      logger.debug('debug msg');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log when DEBUG env is set', () => {
      process.env.DEBUG = '1';
      logger.debug('debug msg');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0];
      expect(output[0]).toContain('🐛');
      expect(output[1]).toBe('debug msg');
    });
  });

  describe('verbose', () => {
    it('should not log when verbose mode is off', () => {
      logger.setVerbose(false);
      logger.verbose('verbose msg');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log when verbose mode is on', () => {
      logger.setVerbose(true);
      logger.verbose('verbose msg');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toBe('verbose msg');
    });
  });

  describe('log', () => {
    it('should call console.log directly', () => {
      logger.log('plain message');
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy.mock.calls[0][0]).toBe('plain message');
    });
  });

  describe('suggestNextSteps', () => {
    it('should print header and steps', () => {
      logger.suggestNextSteps(['step 1', 'step 2']);
      const calls = consoleLogSpy.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(4);
      expect(calls[0][0]).toBe('');
      expect(calls[1][1]).toContain("What's next");
      expect(calls[2][1]).toContain('step 1');
      expect(calls[3][1]).toContain('step 2');
    });

    it('should handle empty steps array', () => {
      logger.suggestNextSteps([]);
      const calls = consoleLogSpy.mock.calls;
      expect(calls.length).toBe(3);
      expect(calls[2][0]).toBe('');
    });
  });
});
