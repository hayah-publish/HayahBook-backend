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
    const user = {
      id: 'user-1',
      email: 'admin@example.com',
      role: 'user' as const,
    };
    jest.spyOn(service, 'findById').mockResolvedValue(user as never);
    await service.markEmailVerified('user-1');
    expect(usersRepository.update).toHaveBeenCalledWith('user-1', {
      role: 'admin',
    });
  });
});

describe('UsersService paginated follow lists', () => {
  it('applies database pagination and SQL search to following pages', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const qb: any = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest
        .fn()
        .mockResolvedValue([
          [
            {
              followingId: 'target-1',
              following: {
                id: 'target-1',
                name: 'Target',
                userType: 'Reader',
                followersCount: 3,
              },
              createdAt: new Date(),
            },
          ],
          1,
        ]),
    };
    const followRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qb),
      find: jest.fn().mockResolvedValue([{ followingId: 'target-1' }]),
    };
    const service = new UsersService(
      usersRepo as never,
      followRepo as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      { t: (key: string) => key } as never,
    );
    const result = await service.getFollowingPage(
      'user-1',
      'viewer-1',
      'Tar',
      2,
      5,
    );
    expect(qb.andWhere).toHaveBeenCalledWith('following.name ILIKE :search', {
      search: '%Tar%',
    });
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
      data: [{ id: 'target-1', isFollowing: true }],
    });
  });
});

describe('UsersService unique anonymous number generation', () => {
  it('generates a 5-digit number within 10000..99999', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const service = new UsersService(
      usersRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      { t: (key: string) => key } as never,
    );

    const num = await service.generateUniqueAnonymousNumber();
    expect(num).toBeGreaterThanOrEqual(10000);
    expect(num).toBeLessThanOrEqual(99999);
  });

  it('increments beyond 99999 if maximum is reached', async () => {
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'exists' }),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 99999 }),
      }),
    };
    const service = new UsersService(
      usersRepo as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: jest.fn() } as never,
      { t: (key: string) => key } as never,
    );

    const num = await service.generateUniqueAnonymousNumber();
    expect(num).toBe(100000);
  });
});
