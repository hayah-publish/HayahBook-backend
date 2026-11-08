import { UsersService } from './users.service';

describe('UsersService admin assignment', () => {
  const usersRepository = {
    create: jest.fn((value) => value),
    save: jest.fn((value) => value),
    update: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
  };
  const config = { get: jest.fn().mockReturnValue('admin@example.com') };
  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(
      usersRepository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      config as never,
      { t: (key: string) => key } as never,
    );
  });

  it('does not grant admin privileges before password signup email verification', async () => {
    const user = await service.createUserWithPassword(
      'admin@example.com',
      'hashed-password',
    );
    expect(user.role).toBe('user');
    expect(user.emailVerified).toBe(false);
  });

  it('grants the configured admin role only after email verification', async () => {
    const user = { id: 'user-1', email: 'admin@example.com', role: 'user' as const };
    jest.spyOn(service, 'findById').mockResolvedValue(user as never);
    await service.markEmailVerified('user-1');
    expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
      role: 'admin',
    });
  });
});
