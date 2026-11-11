import { validateNicknameFormat } from './nickname.validator';

describe('NicknameValidator', () => {
  describe('validateNicknameFormat', () => {
    it('accepts valid Arabic nickname with underscores and digits', () => {
      expect(validateNicknameFormat('قارئ_الليل').isValid).toBe(true);
      expect(validateNicknameFormat('قارئ_الليل_123').isValid).toBe(true);
      expect(validateNicknameFormat('محب_الكتب_٩٩').isValid).toBe(true);
      expect(validateNicknameFormat('أحمد_١').isValid).toBe(true);
    });

    it('accepts valid English nickname with underscores and digits', () => {
      expect(validateNicknameFormat('I_am_not_a_vegetable').isValid).toBe(true);
      expect(validateNicknameFormat('cool_reader_99').isValid).toBe(true);
      expect(validateNicknameFormat('book_lover').isValid).toBe(true);
      expect(validateNicknameFormat('Night_Reader').isValid).toBe(true);
    });

    it('rejects nicknames with spaces', () => {
      const res = validateNicknameFormat('I am not a vegetable');
      expect(res.isValid).toBe(false);
      expect(res.message).toContain('مسافات');
    });

    it('rejects nicknames longer than 30 characters', () => {
      const longName = 'a'.repeat(31);
      const res = validateNicknameFormat(longName);
      expect(res.isValid).toBe(false);
      expect(res.message).toContain('30 حرفاً');
    });

    it('rejects nicknames shorter than 2 characters', () => {
      const res = validateNicknameFormat('a');
      expect(res.isValid).toBe(false);
      expect(res.message).toContain('حرفين على الأقل');
    });

    it('rejects mixed Arabic and English characters', () => {
      const res1 = validateNicknameFormat('reader_قارئ');
      expect(res1.isValid).toBe(false);
      expect(res1.message).toContain('الخلط بين الحروف');

      const res2 = validateNicknameFormat('Ahmed_أحمد');
      expect(res2.isValid).toBe(false);
    });

    it('rejects disallowed symbols like hyphens, at-signs, dots', () => {
      expect(validateNicknameFormat('cool-reader').isValid).toBe(false);
      expect(validateNicknameFormat('cool@reader').isValid).toBe(false);
      expect(validateNicknameFormat('cool.reader').isValid).toBe(false);
      expect(validateNicknameFormat('قارئ-الليل').isValid).toBe(false);
    });

    it('rejects nicknames with only digits or underscores', () => {
      expect(validateNicknameFormat('123456').isValid).toBe(false);
      expect(validateNicknameFormat('___').isValid).toBe(false);
      expect(validateNicknameFormat('123_456').isValid).toBe(false);
    });

    it('rejects empty or whitespace-only nicknames', () => {
      expect(validateNicknameFormat('').isValid).toBe(false);
      expect(validateNicknameFormat('   ').isValid).toBe(false);
      expect(validateNicknameFormat(null).isValid).toBe(false);
    });
  });
});
