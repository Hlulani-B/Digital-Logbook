import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isDisposableEmailDomain,
  validateEmailForAuth,
  suggestEmailCorrection,
} from '../validation';

describe('validation', () => {
  describe('isValidEmail', () => {
    it('returns true for a standard email address', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
    });

    it('returns false for missing @', () => {
      expect(isValidEmail('userexample.com')).toBe(false);
    });

    it('returns false for missing domain extension', () => {
      expect(isValidEmail('user@example')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidEmail('')).toBe(false);
    });

    it('trims whitespace before validating', () => {
      expect(isValidEmail('  user@example.com  ')).toBe(true);
    });
  });

  describe('isDisposableEmailDomain', () => {
    it('returns true for known disposable domains', () => {
      expect(isDisposableEmailDomain('me@tempmail.com')).toBe(true);
      expect(isDisposableEmailDomain('me@yopmail.com')).toBe(true);
      expect(isDisposableEmailDomain('me@10minutemail.com')).toBe(true);
    });

    it('returns false for permanent domains', () => {
      expect(isDisposableEmailDomain('me@gmail.com')).toBe(false);
      expect(isDisposableEmailDomain('me@wits.ac.za')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(isDisposableEmailDomain('me@TEMPMAIL.COM')).toBe(true);
    });
  });

  describe('validateEmailForAuth', () => {
    it('returns null for a valid permanent email', () => {
      expect(validateEmailForAuth('student@wits.ac.za')).toBeNull();
    });

    it('returns an error for empty email', () => {
      expect(validateEmailForAuth('')).toBe('Please enter your email address.');
    });

    it('returns an error for malformed email', () => {
      expect(validateEmailForAuth('not-an-email')).toBe(
        'Please enter a valid email address (e.g. name@example.com).'
      );
    });

    it('returns an error for disposable email domains', () => {
      expect(validateEmailForAuth('temp@mailinator.com')).toBe(
        'Please use a permanent email address. Temporary or disposable email domains are not allowed.'
      );
    });
  });

  describe('suggestEmailCorrection', () => {
    it('suggests gmail.com for gmail.comm', () => {
      expect(suggestEmailCorrection('nasintontela@gmail.comm')).toBe('nasintontela@gmail.com');
    });

    it('suggests outlook.com for outlok.com', () => {
      expect(suggestEmailCorrection('user@outlok.com')).toBe('user@outlook.com');
    });

    it('suggests hotmail.com for hotmial.com', () => {
      expect(suggestEmailCorrection('user@hotmial.com')).toBe('user@hotmail.com');
    });

    it('returns null for a correct email', () => {
      expect(suggestEmailCorrection('user@gmail.com')).toBeNull();
    });

    it('returns null for unknown domains', () => {
      expect(suggestEmailCorrection('user@some-random-domain.co.za')).toBeNull();
    });

    it('is case-insensitive', () => {
      expect(suggestEmailCorrection('User@GMAIL.COMM')).toBe('user@gmail.com');
    });
  });
});
