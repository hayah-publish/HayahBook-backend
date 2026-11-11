import { Test, TestingModule } from '@nestjs/testing';
import { AliasesController } from './aliases.controller';
import { AliasesService } from './aliases.service';

describe('AliasesController', () => {
  let controller: AliasesController;

  const mockAliasesService = {
    getPresets: jest.fn().mockReturnValue([
      { id: 'preset-1', key: 'preset-frog-red', avatarUrl: 'https://cdn.hayahbook.com/presets/alias-monster-green.png' },
    ]),
    checkNicknameAvailability: jest.fn().mockResolvedValue({
      available: true,
      message: 'Nickname is available',
    }),
    getIdentityOptions: jest.fn().mockResolvedValue({
      primary: { id: 'user-1', name: 'Ahmed Murad' },
      aliases: [],
      anonymousOption: { title: 'Comment without showing your name' },
    }),
    getMyAliases: jest.fn().mockResolvedValue([]),
    getMyAlias: jest.fn().mockResolvedValue(null),
    createAlias: jest.fn().mockResolvedValue({
      id: 'alias-1',
      nickname: 'I_am_not_a_vegetable',
      avatarUrl: 'https://cdn.hayahbook.com/presets/alias-monster-green.png',
    }),
    getAliasProfile: jest.fn().mockResolvedValue({
      id: 'alias-1',
      nickname: 'I_am_not_a_vegetable',
      badges: { agreedCount: 44, searchCount: 106 },
    }),
    getAliasComments: jest.fn().mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    }),
    getAliasBookReviews: jest.fn().mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    }),
    getAliasBookRatings: jest.fn().mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    }),
    updateAlias: jest.fn().mockResolvedValue({
      id: 'alias-1',
      nickname: 'Critic_of_critics',
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AliasesController],
      providers: [
        {
          provide: AliasesService,
          useValue: mockAliasesService,
        },
      ],
    }).compile();

    controller = module.get<AliasesController>(AliasesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return presets wrapped in data', () => {
    const res = controller.getPresets();
    expect(res).toEqual({ data: expect.any(Array) });
    expect(mockAliasesService.getPresets).toHaveBeenCalled();
  });

  it('should check nickname availability', async () => {
    const res = await controller.checkNickname('CoolReader');
    expect(res).toEqual({ available: true, message: 'Nickname is available' });
    expect(mockAliasesService.checkNicknameAvailability).toHaveBeenCalledWith('CoolReader', undefined);
  });

  it('should return identity options for user', async () => {
    const req = { user: { userId: 'user-1', role: 'user' } } as any;
    const res = await controller.getIdentityOptions(req, 'ar');
    expect(res).toEqual({ data: expect.any(Object) });
    expect(mockAliasesService.getIdentityOptions).toHaveBeenCalledWith('user-1', 'ar');
  });

  it('should return caller single alias with cooldown info', async () => {
    const req = { user: { userId: 'user-1', role: 'user' } } as any;
    const mockAlias = { id: 'alias-1', nickname: 'reader_1', canEdit: true };
    mockAliasesService.getMyAlias.mockResolvedValueOnce(mockAlias);
    const res = await controller.getMyAlias(req);
    expect(res).toEqual({ data: mockAlias });
    expect(mockAliasesService.getMyAlias).toHaveBeenCalledWith('user-1');
  });

  it('should create an alias', async () => {
    const req = { user: { userId: 'user-1', role: 'user' } } as any;
    const res = await controller.createAlias(req, { nickname: 'I_am_not_a_vegetable' });
    expect(res.data).toBeDefined();
    expect(res.message).toBe('Alias created successfully');
  });

  it('should return alias profile', async () => {
    const res = await controller.getAliasProfile('1f71559f-4980-4b02-be6a-24c4ea3d7ea0');
    expect(res.data).toBeDefined();
  });

  it('should return alias comments', async () => {
    const res = await controller.getAliasComments('1f71559f-4980-4b02-be6a-24c4ea3d7ea0', '1', '10');
    expect(res.data).toBeDefined();
  });

  it('should return alias book reviews', async () => {
    const res = await controller.getAliasBookReviews('1f71559f-4980-4b02-be6a-24c4ea3d7ea0', '1', '10');
    expect(res.data).toBeDefined();
  });

  it('should return alias book ratings', async () => {
    const res = await controller.getAliasBookRatings('1f71559f-4980-4b02-be6a-24c4ea3d7ea0', '1', '10');
    expect(res.data).toBeDefined();
  });
});

