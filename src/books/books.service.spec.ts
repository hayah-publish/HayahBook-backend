import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BooksService } from './books.service';
import { Book } from './book.entity';
import { Audiobook } from './audiobook.entity';
import { UserBook } from './user-book.entity';
import { User } from '../users/user.entity';
import { I18nService } from '../i18n/i18n.service';
import { DataSource } from 'typeorm';

describe('BooksService', () => {
  let service: BooksService;

  const mockRepository = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn((dto) => dto),
    save: jest.fn((item) => Promise.resolve(item)),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    preload: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksService,
        I18nService,
        {
          provide: getRepositoryToken(Book),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(Audiobook),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(UserBook),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<BooksService>(BooksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('filters content type and paginates in the database', async () => {
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    mockRepository.createQueryBuilder.mockReturnValue(qb);
    await service.getMyBooks('user-1', { type: 'both', page: 2, limit: 5 });
    expect(qb.andWhere).toHaveBeenCalledWith(
      'ub.bookId IS NOT NULL AND ub.audiobookId IS NOT NULL',
    );
    expect(qb.skip).toHaveBeenCalledWith(5);
    expect(qb.take).toHaveBeenCalledWith(5);
  });

  it('locks a reading transition and updates status plus counters in one transaction', async () => {
    const book = {
      id: 'book-1',
      title: 'Book',
      author: 'Author',
      category: 'Fiction',
      readsCount: 4,
      views: 10,
      rating: 4.5,
      coverUrl: null,
    };
    mockRepository.findOne
      .mockReset()
      .mockResolvedValueOnce(book)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const existing = {
      id: 'history-1',
      userId: 'user-1',
      bookId: 'book-1',
      audiobookId: null,
      status: 'reading',
      progress: 50,
      startedAt: new Date(),
      finishedAt: null,
      rating: null,
      notes: null,
    };
    const historyRepo = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve(value)),
    };
    const manager = {
      query: jest.fn().mockResolvedValue([]),
      getRepository: jest.fn(() => historyRepo),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    const dataSource = (service as any).dataSource;
    dataSource.transaction.mockImplementation((callback: (m: any) => unknown) =>
      Promise.resolve(callback(manager)),
    );

    const result = await service.updateReadingStatus('user-1', 'book-1', {
      status: 'finished',
    });

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      ['user-1:book-1:'],
    );
    expect(manager.increment).toHaveBeenCalledWith(
      Book,
      { id: 'book-1' },
      'readsCount',
      1,
    );
    expect(historyRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'finished', progress: 100 }),
    );
    expect(result.data.status).toBe('finished');
  });
});
