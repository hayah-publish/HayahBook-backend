import { Test, TestingModule } from '@nestjs/testing';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';

describe('BookmarksController', () => {
  let controller: BookmarksController;
  let service: Partial<Record<keyof BookmarksService, jest.Mock>>;

  const mockUserReq: any = {
    user: {
      userId: 'user-uuid-1',
      email: 'user@example.com',
      role: 'user',
    },
  };

  beforeEach(async () => {
    service = {
      findAll: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        counts: { all: 0, posts: 0, articles: 0, visuals: 0, snippets: 0 },
      }),
      getCounts: jest.fn().mockResolvedValue({
        all: 5,
        posts: 2,
        articles: 1,
        visuals: 1,
        snippets: 1,
      }),
      checkSaved: jest.fn().mockResolvedValue({
        postId: 'post-1',
        isSaved: true,
      }),
      toggleBookmark: jest.fn().mockResolvedValue({
        message: 'تم حفظ العنصر بنجاح',
        isSaved: true,
        bookmarksCount: 3,
      }),
      removeBookmark: jest.fn().mockResolvedValue({
        message: 'تمت إزالة العنصر من المحفوظات',
        isSaved: false,
        bookmarksCount: 2,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookmarksController],
      providers: [
        {
          provide: BookmarksService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<BookmarksController>(BookmarksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getBookmarks', () => {
    it('delegates to service.findAll with user id and query parameters', async () => {
      const query = { page: 1, limit: 10, type: 'articles' };
      const res = await controller.getBookmarks(mockUserReq, query);

      expect(service.findAll).toHaveBeenCalledWith('user-uuid-1', query);
      expect(res.totalPages).toBe(1);
    });
  });

  describe('getCounts', () => {
    it('delegates to service.getCounts with user id', async () => {
      const res = await controller.getCounts(mockUserReq);

      expect(service.getCounts).toHaveBeenCalledWith('user-uuid-1');
      expect(res.all).toBe(5);
    });
  });

  describe('checkSaved', () => {
    it('delegates to service.checkSaved with user id and post id', async () => {
      const res = await controller.checkSaved(mockUserReq, 'post-1');

      expect(service.checkSaved).toHaveBeenCalledWith('user-uuid-1', 'post-1');
      expect(res.isSaved).toBe(true);
    });
  });

  describe('toggleBookmarkParam', () => {
    it('delegates to service.toggleBookmark with user id and param id', async () => {
      const res = await controller.toggleBookmarkParam(mockUserReq, 'post-1');

      expect(service.toggleBookmark).toHaveBeenCalledWith('user-uuid-1', 'post-1');
      expect(res.isSaved).toBe(true);
      expect(res.bookmarksCount).toBe(3);
    });
  });

  describe('toggleBookmarkBody', () => {
    it('delegates to service.toggleBookmark with user id and body postId', async () => {
      const res = await controller.toggleBookmarkBody(mockUserReq, {
        postId: 'post-1',
      });

      expect(service.toggleBookmark).toHaveBeenCalledWith('user-uuid-1', 'post-1');
      expect(res.isSaved).toBe(true);
    });
  });

  describe('removeBookmark', () => {
    it('delegates to service.removeBookmark with user id and param id', async () => {
      const res = await controller.removeBookmark(mockUserReq, 'post-1');

      expect(service.removeBookmark).toHaveBeenCalledWith('user-uuid-1', 'post-1');
      expect(res.isSaved).toBe(false);
      expect(res.bookmarksCount).toBe(2);
    });
  });
});
