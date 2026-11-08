import { Test, TestingModule } from '@nestjs/testing';
import { HomeController } from './home.controller';
import { PostsService } from '../posts/posts.service';

describe('HomeController', () => {
  let controller: HomeController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;

  beforeEach(async () => {
    postsService = {
      getHomeFeed: jest.fn().mockResolvedValue({
        counts: { all: 10, posts: 5, articles: 3, visuals: 1, snippets: 1 },
        data: [],
        total: 10,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      getFeedCounts: jest.fn().mockResolvedValue({
        all: 10,
        posts: 5,
        articles: 3,
        visuals: 1,
        snippets: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        {
          provide: PostsService,
          useValue: postsService,
        },
      ],
    }).compile();

    controller = module.get<HomeController>(HomeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates getHomeFeed to postsService.getHomeFeed', async () => {
    const query = { page: 1, limit: 10, type: 'all' };
    const res = await controller.getHomeFeed(query);

    expect(postsService.getHomeFeed).toHaveBeenCalledWith(query);
    expect(res.total).toBe(10);
    expect(res.counts.all).toBe(10);
  });

  it('delegates getFeed to postsService.getHomeFeed', async () => {
    const query = { page: 2, limit: 5 };
    const res = await controller.getFeed(query);

    expect(postsService.getHomeFeed).toHaveBeenCalledWith(query);
    expect(res.total).toBe(10);
  });

  it('delegates getFeedCounts to postsService.getFeedCounts', async () => {
    const res = await controller.getFeedCounts();

    expect(postsService.getFeedCounts).toHaveBeenCalled();
    expect(res.posts).toBe(5);
  });
});
