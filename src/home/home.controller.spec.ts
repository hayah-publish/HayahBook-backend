import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { HomeController } from './home.controller';
import { PostsService } from '../posts/posts.service';
import { I18nService } from '../i18n/i18n.service';

describe('HomeController', () => {
  let controller: HomeController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;
  let i18nService: Partial<Record<keyof I18nService, jest.Mock>>;

  beforeEach(async () => {
    postsService = {
      getHomeFeed: jest.fn().mockImplementation((query, userId) => {
        if (!userId) {
          throw new UnauthorizedException('Unauthorized');
        }
        return Promise.resolve({
          counts: { all: 10, posts: 5, articles: 3, visuals: 1, snippets: 1 },
          data: [],
          total: 10,
          page: 1,
          limit: 20,
          totalPages: 1,
        });
      }),
      getFeedCounts: jest.fn().mockResolvedValue({
        all: 10,
        posts: 5,
        articles: 3,
        visuals: 1,
        snippets: 1,
      }),
      getFollowedUserIds: jest.fn().mockResolvedValue(['user-followed-1']),
      reactToPost: jest.fn().mockResolvedValue({
        message: 'تم التفاعل بنجاح',
        action: 'added',
        userReaction: 'love',
      }),
      removeReaction: jest.fn().mockResolvedValue({
        message: 'تمت إزالة التفاعل بنجاح',
        action: 'removed',
        userReaction: null,
      }),
      getPostReactions: jest.fn().mockResolvedValue({
        counts: { total: 1 },
        data: [],
      }),
      getHomeFilters: jest.fn().mockReturnValue({
        message: 'تم جلب خيارات وتصنيفات فلترة الصفحة الرئيسية بنجاح',
        data: [
          {
            id: 'history-and-documentaries',
            name: 'التاريخ والوثائقيات',
            displayName: 'التاريخ والوثائقيات',
            nameAr: 'التاريخ والوثائقيات',
            nameEn: 'History and Documentaries',
            subcategories: [
              {
                id: 'all',
                name: 'الكل',
                displayName: 'الكل',
                nameAr: 'الكل',
                nameEn: 'All',
              },
              {
                id: 'civilizations',
                name: 'حضارات',
                displayName: 'حضارات',
                nameAr: 'حضارات',
                nameEn: 'Civilizations',
              },
            ],
          },
        ],
      }),
    };

    i18nService = {
      t: jest.fn().mockImplementation((k) => k),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
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

    controller = module.get<HomeController>(HomeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHomeFeed', () => {
    it('delegates to postsService.getHomeFeed for authenticated user when following=false (For You)', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const query = { page: 1, limit: 10, type: 'all' };
      const res = await controller.getHomeFeed(mockReq, query);

      expect(postsService.getHomeFeed).toHaveBeenCalledWith(query, 'user-viewer-1');
      expect(res.total).toBe(10);
      expect(res.counts.all).toBe(10);
    });

    it('passes resolved userId when token is present with following=true (Following)', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const query = { type: 'posts', following: true };
      const res = await controller.getHomeFeed(mockReq, query);

      expect(postsService.getHomeFeed).toHaveBeenCalledWith(query, 'user-viewer-1');
      expect(res.counts.posts).toBe(5);
    });

    it('throws UnauthorizedException when getHomeFeed is requested without token (no guest mode)', async () => {
      const mockReq: any = { headers: {} };
      const query = { following: false };

      await expect(controller.getHomeFeed(mockReq, query)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getFollowingFeed', () => {
    it('calls getHomeFeed forcing following=true and using req.user.userId', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const query = { type: 'articles' };
      const res = await controller.getFollowingFeed(mockReq, query);

      expect(postsService.getHomeFeed).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'articles', following: true }),
        'user-viewer-1',
      );
      expect(res.counts.articles).toBe(3);
    });

    it('throws UnauthorizedException when getFollowingFeed is requested without token', async () => {
      const mockReq: any = { headers: {} };
      const query = { type: 'articles' };

      await expect(controller.getFollowingFeed(mockReq, query)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getFeedCounts', () => {
    it('delegates to postsService.getFeedCounts without followedIds when following=false for authenticated user', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const res = await controller.getFeedCounts(mockReq, {});

      expect(postsService.getFeedCounts).toHaveBeenCalledWith(undefined);
      expect(res.posts).toBe(5);
    });

    it('retrieves followedIds and passes to getFeedCounts when following=true', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const res = await controller.getFeedCounts(mockReq, { following: true });

      expect(postsService.getFollowedUserIds).toHaveBeenCalledWith('user-viewer-1');
      expect(postsService.getFeedCounts).toHaveBeenCalledWith(['user-followed-1']);
      expect(res.all).toBe(10);
    });

    it('throws UnauthorizedException when getFeedCounts is requested without token', async () => {
      const mockReq: any = { headers: {} };
      await expect(controller.getFeedCounts(mockReq, {})).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('feed items reactions', () => {
    it('reacts to feed item via reactToFeedItem', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const res = await controller.reactToFeedItem('item-1', { reaction: 'love' }, mockReq);

      expect(postsService.reactToPost).toHaveBeenCalledWith('user-viewer-1', 'item-1', 'love');
      expect(res.action).toBe('added');
    });

    it('throws UnauthorizedException when reactToFeedItem is called without token', async () => {
      const mockReq: any = { headers: {} };
      await expect(controller.reactToFeedItem('item-1', { reaction: 'love' }, mockReq)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('removes reaction via removeFeedItemReaction', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const res = await controller.removeFeedItemReaction('item-1', mockReq);

      expect(postsService.removeReaction).toHaveBeenCalledWith('user-viewer-1', 'item-1');
      expect(res.action).toBe('removed');
    });

    it('gets reactions list via getFeedItemReactions', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const res = await controller.getFeedItemReactions('item-1', { type: 'all' }, mockReq);

      expect(postsService.getPostReactions).toHaveBeenCalledWith('item-1', { type: 'all' }, 'user-viewer-1');
      expect(res.counts.total).toBe(1);
    });
  });

  describe('getHomeFilters', () => {
    it('returns hierarchical categories and subcategories taxonomy', async () => {
      const mockReq: any = { headers: { 'accept-language': 'ar' } };
      const res = await controller.getHomeFilters('ar', mockReq);

      expect(postsService.getHomeFilters).toHaveBeenCalledWith('ar');
      expect(res.data).toBeDefined();
      expect(res.data[0].id).toBe('history-and-documentaries');
      expect(res.data[0].subcategories[1].nameAr).toBe('حضارات');
    });

    it('supports English lang resolution from headers when query is not provided', async () => {
      const mockReq: any = { headers: { 'accept-language': 'en-US,en;q=0.9' } };
      await controller.getHomeFilters(undefined, mockReq);

      expect(postsService.getHomeFilters).toHaveBeenCalledWith('en');
    });
  });
});
