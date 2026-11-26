import { toDefaultPackageName, toPackageNameSegment } from '../core/package-name';

describe('toPackageNameSegment', () => {
  it('should keep a name made of letters and digits', () => {
    expect(toPackageNameSegment('myapp2')).toBe('myapp2');
  });

  it('should turn hyphens into underscores', () => {
    expect(toPackageNameSegment('gyo-shell')).toBe('gyo_shell');
  });

  it('should keep underscores', () => {
    expect(toPackageNameSegment('my_valid_app')).toBe('my_valid_app');
  });

  it('should prefix a name that starts with a digit', () => {
    expect(toPackageNameSegment('2fast')).toBe('app_2fast');
  });

  it('should prefix Java keywords', () => {
    expect(toPackageNameSegment('new')).toBe('app_new');
    expect(toPackageNameSegment('class')).toBe('app_class');
  });

  it('should return a valid Java package segment for every accepted project name', () => {
    const accepted = /^[a-z0-9]([a-z0-9\-_]*[a-z0-9])?$/;
    const names = [
      'a',
      '1',
      '9',
      'new',
      'class',
      'true',
      'gyo-shell',
      'my_valid_app',
      'x-y_z',
      'for',
    ];

    for (const name of names) {
      expect(accepted.test(name)).toBe(true);
      expect(toPackageNameSegment(name)).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});

describe('toDefaultPackageName', () => {
  it('should place the segment under com.example', () => {
    expect(toDefaultPackageName('gyo-shell')).toBe('com.example.gyo_shell');
  });
});
