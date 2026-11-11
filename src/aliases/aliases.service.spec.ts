import { ConflictException, BadRequestException } from '@nestjs/common';
import { AliasesService, PRESET_DEFINITIONS } from './aliases.service';

describe('AliasesService - Unique Nickname & Picture-Only Presets', () => {
  let service: AliasesService;
  let mockAliasRepo: any;
  let mockUserRepo: any;
  let mockCommentRepo: any;
  let mockUserBookRepo: any;
  let mockUploadService: any;
  let mockI18n: any;
  let mockDataSource: any;

  beforeEach(() => {
    mockAliasRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      exists: jest.fn().mockResolvedValue(true),
      save: jest.fn((entity) => Promise.resolve({ id: 'saved-id', ...entity })),
      create: jest.fn((entity) => entity),
      createQueryBuilder: jest.fn(),
    };
    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-1', name: 'أحمد' }),
    };
    mockCommentRepo = {};
    mockUserBookRepo = {};
    mockUploadService = {
      uploadAliasAvatar: jest.fn(),
      deleteFileByUrl: jest.fn(),
    };
    mockI18n = {
      t: jest.fn((key: string) => {
        if (key === 'aliases.nickname_already_taken') return 'هذا الاسم المستعار مستخدم بالفعل، يرجى اختيار اسم آخر';
        if (key === 'aliases.nickname_available') return 'الاسم المستعار متاح';
        if (key === 'aliases.nickname_required') return 'الاسم المستعار مطلوب';
        return key;
      }),
      getCurrentLanguage: jest.fn().mockReturnValue('ar'),
    };
    mockDataSource = {
      transaction: jest.fn(async (cb) => {
        const manager = {
          query: jest.fn(),
          getRepository: jest.fn().mockReturnValue(mockAliasRepo),
        };
        return cb(manager);
      }),
    };

    service = new AliasesService(
      mockAliasRepo,
      mockUserRepo,
      mockCommentRepo,
      mockUserBookRepo,
      mockUploadService,
      mockI18n,
      mockDataSource,
    );
  });

  describe('getPresets', () => {
    it('returns only pictures (id, key, avatarUrl) with NO names or suggested nicknames', () => {
      const presets = service.getPresets();
      expect(presets.length).toBe(PRESET_DEFINITIONS.length);
      presets.forEach((p) => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('key');
        expect(p).toHaveProperty('avatarUrl');
        expect((p as any).name_ar).toBeUndefined();
        expect((p as any).name_en).toBeUndefined();
        expect((p as any).displayName).toBeUndefined();
        expect((p as any).suggestedNickname_ar).toBeUndefined();
        expect((p as any).suggestedNickname_en).toBeUndefined();
      });
    });
  });

  describe('checkNicknameAvailability', () => {
    it('throws BadRequestException if nickname is empty or blank', async () => {
      await expect(service.checkNicknameAvailability('')).rejects.toThrow(BadRequestException);
      await expect(service.checkNicknameAvailability('   ')).rejects.toThrow(BadRequestException);
    });

    it('returns available: false when nickname is already in use', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'alias-1', nickname: 'ExistingUser' }),
      };
      mockAliasRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.checkNicknameAvailability('existinguser');
      expect(result.available).toBe(false);
      expect(result.message).toBe('هذا الاسم المستعار مستخدم بالفعل، يرجى اختيار اسم آخر');
    });

    it('returns available: true when nickname is not in use', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockAliasRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.checkNicknameAvailability('UniqueNickname');
      expect(result.available).toBe(true);
      expect(result.message).toBe('الاسم المستعار متاح');
    });
  });

  describe('createAlias with unique nickname', () => {
    it('rejects creation with ConflictException if nickname is already taken (case-insensitively)', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'other-alias', nickname: 'ExistingNick' }),
      };
      mockAliasRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.createAlias('user-1', { nickname: 'existingnick' }),
      ).rejects.toThrow(ConflictException);

      expect(mockI18n.t).toHaveBeenCalledWith('aliases.nickname_already_taken');
    });

    it('rejects creation with ConflictException if user already has an alias', async () => {
      mockAliasRepo.findOne.mockResolvedValue({
        id: 'existing-alias',
        userId: 'user-1',
        nickname: 'OldAlias',
      });

      await expect(
        service.createAlias('user-1', { nickname: 'BrandNewNick' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates alias successfully when nickname is unique and user has no alias', async () => {
      mockAliasRepo.findOne.mockResolvedValue(null);
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockAliasRepo.createQueryBuilder.mockReturnValue(qb);
      mockAliasRepo.update = jest.fn();

      const created = await service.createAlias('user-1', { nickname: 'BrandNewNick' });
      expect(created).toBeDefined();
      expect(created.nickname).toBe('BrandNewNick');
      expect((created as any).canEdit).toBe(true);
    });
  });

  describe('updateAlias with 30-day edit cooldown rule', () => {
    it('rejects update with BadRequestException if last modification was less than 30 days ago', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      mockAliasRepo.findOne.mockResolvedValue({
        id: 'alias-1',
        userId: 'user-1',
        nickname: 'CurrentNick',
        lastModifiedAt: tenDaysAgo,
      });

      await expect(
        service.updateAlias('user-1', 'alias-1', { nickname: 'UpdatedNick' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows update if last modification was more than 30 days ago (or never modified)', async () => {
      const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      mockAliasRepo.findOne.mockResolvedValue({
        id: 'alias-1',
        userId: 'user-1',
        nickname: 'CurrentNick',
        lastModifiedAt: thirtyFiveDaysAgo,
      });

      const qb: any = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockAliasRepo.createQueryBuilder.mockReturnValue(qb);

      const updated = await service.updateAlias('user-1', 'alias-1', {
        nickname: 'NewAllowedNick',
      });
      expect(updated).toBeDefined();
      expect(updated.nickname).toBe('NewAllowedNick');
      expect(updated.lastModifiedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateAlias with unique nickname', () => {
    it('rejects update with ConflictException if new nickname is already taken by another alias', async () => {
      mockAliasRepo.findOne.mockResolvedValue({
        id: 'alias-1',
        userId: 'user-1',
        nickname: 'OldNick',
      });

      const qb: any = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ id: 'other-alias', nickname: 'TakenNick' }),
      };
      mockAliasRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.updateAlias('user-1', 'alias-1', { nickname: 'TakenNick' }),
      ).rejects.toThrow(ConflictException);

      expect(mockI18n.t).toHaveBeenCalledWith('aliases.nickname_already_taken');
    });

    it('allows updating alias details when nickname remains the same or is unique', async () => {
      mockAliasRepo.findOne.mockResolvedValue({
        id: 'alias-1',
        userId: 'user-1',
        nickname: 'MyCurrentNick',
      });

      const qb: any = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null), // no other alias with this nickname
      };
      mockAliasRepo.createQueryBuilder.mockReturnValue(qb);

      const updated = await service.updateAlias('user-1', 'alias-1', {
        nickname: 'MyCurrentNick',
      });
      expect(updated).toBeDefined();
      expect(updated.nickname).toBe('MyCurrentNick');
    });
  });
});

