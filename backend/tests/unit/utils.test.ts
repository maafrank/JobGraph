import {
  hashPassword,
  comparePassword,
  isValidEmail,
  isValidPassword,
} from '../../common/src/utils';

describe('Utils', () => {
  describe('Password hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'Test123!';
      const hash = await hashPassword(password);
      const isValid = await comparePassword('WrongPassword!', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('Email validation', () => {
    it('should validate correct email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid email', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });
  });

  describe('Password validation', () => {
    it('should validate strong password', () => {
      expect(isValidPassword('Test123!')).toBe(true);
      expect(isValidPassword('MyP@ssw0rd')).toBe(true);
    });

    it('should reject weak password', () => {
      expect(isValidPassword('test')).toBe(false); // Too short
      expect(isValidPassword('testtest')).toBe(false); // No uppercase
      expect(isValidPassword('TESTTEST')).toBe(false); // No lowercase
      expect(isValidPassword('TestTest')).toBe(false); // No number
      expect(isValidPassword('TestTest1')).toBe(false); // No special char
    });
  });
});
