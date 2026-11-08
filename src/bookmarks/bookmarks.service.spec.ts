import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { UserBookmark } from './bookmark.entity';
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';
import { PostsService } from '../posts/posts.service';
import { I18nService } from '../i18n/i18n.service';

describe('BookmarksService', () => {
  let service: BookmarksService;
  let bookmarksRepo: any;
  let postsRepo: any;
  let usersRepo: any;
  let postsService: any;
  let i18nService: any;

  const mockPost: Partial<Post> = {
    id: 'post-uuid-1',
    userId: 'user-author-1',
    type: 'post',
    content: 'محتوى تجريبي',
    images: [],
    videoUrl: null,
    category: null,
    bookmarksCount: 2,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBookmark: Partial<UserBookmark> = {
    id: 'bookmark-uuid-1',
    userId: 'user-viewer-1',
    postId: 'post-uuid-1',
    post: mockPost as Post,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    bookmarksRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ id: 'new-b-id', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    postsRepo = {
      findOne: jest.fn(),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
      decrement: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const transactionManager = {
      getRepository: (entity: unknown) => entity === Post ? postsRepo : bookmarksRepo,
    };
    bookmarksRepo.manager = {
      transaction: (callback: (manager: any) => unknown) => callback(transactionManager),
    };

    usersRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    postsService = {
      formatPost: jest.fn().mockImplementation(async (p) => ({
        id: p.id,
        type: p.type,
        content: p.content,
        bookmarksCount: p.bookmarksCount || 0,
      })),
    };

    i18nService = {
      t: jest.fn().mockImplementation((key) => {
        const dict: Record<string, string> = {
          'bookmarks.saved': 'تم حفظ العنصر بنجاح',
          'bookmarks.removed': 'تمت إزالة العنصر من المحفوظات',
          'bookmarks.already_removed': 'العنصر غير موجود في المحفوظات',
          'bookmarks.not_found': 'العنصر المطلوب غير موجود',
        };
        return dict[key] || key;
      }),
      getCurrentLanguage: jest.fn().mockReturnValue('ar'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookmarksService,
        {
          provide: getRepositoryToken(UserBookmark),
          useValue: bookmarksRepo,
        },
        {
          provide: getRepositoryToken(Post),
          useValue: postsRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: usersRepo,
        },
        {
          provide: PostsService,
          useValue: postsService,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
      ],
    }).compile();

    service = module.get<BookmarksService>(BookmarksService);
  });

  describe('normalizeType', () => {
    it('normalizes tab types for English and Arabic', () => {
      expect(service.normalizeType()).toBe('all');
      expect(service.normalizeType('all')).toBe('all');
      expect(service.normalizeType('الكل')).toBe('all');

      expect(service.normalizeType('posts')).toBe('posts');
      expect(service.normalizeType('post')).toBe('posts');
      expect(service.normalizeType('المنشورات')).toBe('posts');
      expect(service.normalizeType('منشورات')).toBe('posts');

      expect(service.normalizeType('articles')).toBe('articles');
      expect(service.normalizeType('المقالات')).toBe('articles');

      expect(service.normalizeType('visuals')).toBe('visuals');
      expect(service.normalizeType('المرئيات')).toBe('visuals');
      expect(service.normalizeType('فيديو')).toBe('visuals');

      expect(service.normalizeType('snippets')).toBe('snippets');
      expect(service.normalizeType('المقتطفات')).toBe('snippets');
      expect(service.normalizeType('اقتباسات')).toBe('snippets');

      expect(service.normalizeType('unknown')).toBe('all');
    });
  });

  describe('toggleBookmark', () => {
    it('throws NotFoundException when post does not exist', async () => {
      postsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.toggleBookmark('user-1', 'invalid-post-id'),
      ).rejects.toThrow(NotFoundException);
    });

    it('saves bookmark and increments count when item not previously saved', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, bookmarksCount: 5 });
      bookmarksRepo.findOne.mockResolvedValue(null);

      const result = await service.toggleBookmark('user-1', 'post-uuid-1');

      expect(result.isSaved).toBe(true);
      expect(result.bookmarksCount).toBe(6);
      expect(result.message).toBe('تم حفظ العنصر بنجاح');
      expect(postsRepo.increment).toHaveBeenCalledWith(
        { id: 'post-uuid-1' },
        'bookmarksCount',
        1,
      );
    });

    it('removes bookmark and decrements count when item was already saved', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, bookmarksCount: 5 });
      bookmarksRepo.findOne.mockResolvedValue(mockBookmark);

      const result = await service.toggleBookmark('user-viewer-1', 'post-uuid-1');

      expect(result.isSaved).toBe(false);
      expect(result.bookmarksCount).toBe(4);
      expect(result.message).toBe('تمت إزالة العنصر من المحفوظات');
      expect(bookmarksRepo.delete).toHaveBeenCalledWith({ id: mockBookmark.id });
      expect(postsRepo.decrement).toHaveBeenCalledWith(
        { id: 'post-uuid-1' },
        'bookmarksCount',
        1,
      );
    });
  });

  describe('removeBookmark', () => {
    it('removes bookmark and decrements count if bookmark exists', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, bookmarksCount: 3 });
      bookmarksRepo.findOne.mockResolvedValue(mockBookmark);

      const result = await service.removeBookmark('user-viewer-1', 'post-uuid-1');

      expect(result.isSaved).toBe(false);
      expect(result.bookmarksCount).toBe(2);
      expect(result.message).toBe('تمت إزالة العنصر من المحفوظات');
    });

    it('returns already_removed message if bookmark not present', async () => {
      postsRepo.findOne.mockResolvedValue({ ...mockPost, bookmarksCount: 3 });
      bookmarksRepo.findOne.mockResolvedValue(null);

      const result = await service.removeBookmark('user-viewer-1', 'post-uuid-1');

      expect(result.isSaved).toBe(false);
      expect(result.bookmarksCount).toBe(3);
      expect(result.message).toBe('العنصر غير موجود في المحفوظات');
    });
  });

  describe('checkSaved', () => {
    it('returns true when saved and false when not saved', async () => {
      bookmarksRepo.findOne.mockResolvedValueOnce({ id: 'b-1' });
      const savedRes = await service.checkSaved('user-1', 'post-1');
      expect(savedRes.isSaved).toBe(true);

      bookmarksRepo.findOne.mockResolvedValueOnce(null);
      const unsavedRes = await service.checkSaved('user-1', 'post-2');
      expect(unsavedRes.isSaved).toBe(false);
    });
  });

  describe('getCounts', () => {
    it('accurately counts items across the 5 tabs', async () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ all: '5', posts: '1', articles: '1', visuals: '2', snippets: '1' }),
      };
      bookmarksRepo.createQueryBuilder.mockReturnValue(qb);

      const counts = await service.getCounts('user-1');
      expect(counts.all).toBe(5);
      expect(counts.posts).toBe(1);
      expect(counts.articles).toBe(1);
      expect(counts.visuals).toBe(2);
      expect(counts.snippets).toBe(1);
    });
  });

  describe('findAll', () => {
    it('returns paginated saved items with tab counts', async () => {
      const qb: any = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockBookmark], 1]),
      };

      // Mock getCounts query builder
      const countsQb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ all: '1', posts: '1', articles: '0', visuals: '0', snippets: '0' }),
      };

      bookmarksRepo.createQueryBuilder
        .mockReturnValueOnce(qb)
        .mockReturnValueOnce(countsQb);

      const result = await service.findAll('user-viewer-1', {
        type: 'all',
        page: 1,
        limit: 10,
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].isSaved).toBe(true);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.counts.all).toBe(1);
    });
  });
});

