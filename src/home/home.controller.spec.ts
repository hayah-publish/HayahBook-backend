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
        if ((query.following || query.scope === 'following') && !userId) {
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
    it('delegates to postsService.getHomeFeed publicly when not following', async () => {
      const mockReq: any = { headers: {} };
      const query = { page: 1, limit: 10, type: 'all' };
      const res = await controller.getHomeFeed(mockReq, query);

      expect(postsService.getHomeFeed).toHaveBeenCalledWith(query, undefined);
      expect(res.total).toBe(10);
      expect(res.counts.all).toBe(10);
    });

    it('passes resolved userId when token is present with following=true', async () => {
      const mockReq: any = { user: { userId: 'user-viewer-1' } };
      const query = { type: 'posts', following: true };
      const res = await controller.getHomeFeed(mockReq, query);

      expect(postsService.getHomeFeed).toHaveBeenCalledWith(query, 'user-viewer-1');
      expect(res.counts.posts).toBe(5);
    });

    it('throws UnauthorizedException when following=true is requested without token', async () => {
      const mockReq: any = { headers: {} };
      const query = { following: true };

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
  });

  describe('getFeedCounts', () => {
    it('delegates to postsService.getFeedCounts without followedIds when public', async () => {
      const mockReq: any = { headers: {} };
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
  });
});
