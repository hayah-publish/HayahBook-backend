import { Test, TestingModule } from '@nestjs/testing';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { PostsService } from '../posts/posts.service';
import { I18nService } from '../i18n/i18n.service';

describe('BooksController', () => {
  let controller: BooksController;

  const mockBooksService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    search: jest.fn(),
    findByType: jest.fn(),
    filterBooks: jest.fn(),
    getCategoryCounts: jest.fn(),
  };

  const mockPostsService = {
    getBookReels: jest.fn().mockResolvedValue({
      book: { id: 'book-uuid-1', title: 'الجلاد تحت جلدي' },
      reels: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BooksController],
      providers: [
        I18nService,
        {
          provide: BooksService,
          useValue: mockBooksService,
        },
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    controller = module.get<BooksController>(BooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET :id/reels calls postsService.getBookReels', async () => {
    const res = await controller.getBookReels('book-uuid-1', { sort: 'top' }, { user: { userId: 'u1' } });
    expect(mockPostsService.getBookReels).toHaveBeenCalledWith('book-uuid-1', { sort: 'top' }, 'u1');
    expect(res.book.title).toBe('الجلاد تحت جلدي');
  });
});
