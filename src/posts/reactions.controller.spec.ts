import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReactionsController } from './reactions.controller';
import { PostsService } from './posts.service';

describe('ReactionsController', () => {
  let controller: ReactionsController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;

  const mockUserReq: any = {
    user: {
      userId: 'user-uuid-1',
      email: 'user@example.com',
      role: 'user',
    },
  };

  beforeEach(async () => {
    postsService = {
      reactToPost: jest.fn().mockResolvedValue({
        message: 'تم التفاعل بنجاح',
        action: 'added',
        userReaction: 'love',
        reactionsCount: { total: 1, agree: 0, love: 1, applaud: 0, insightful: 0, disagree: 0 },
        topReactions: ['love'],
      }),
      removeReaction: jest.fn().mockResolvedValue({
        message: 'تمت إزالة التفاعل بنجاح',
        action: 'removed',
        userReaction: null,
        reactionsCount: { total: 0, agree: 0, love: 0, applaud: 0, insightful: 0, disagree: 0 },
        topReactions: [],
      }),
      getPostReactions: jest.fn().mockResolvedValue({
        counts: { total: 1, agree: 0, love: 1, applaud: 0, insightful: 0, disagree: 0 },
        data: [],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReactionsController],
      providers: [
        {
          provide: PostsService,
          useValue: postsService,
        },
      ],
    }).compile();

    controller = module.get<ReactionsController>(ReactionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('reactParam', () => {
    it('reacts to any item (post, article, visual, snippet) via path parameter', async () => {
      const res = await controller.reactParam('item-uuid-1', { reaction: 'love' }, mockUserReq);
      expect(postsService.reactToPost).toHaveBeenCalledWith('user-uuid-1', 'item-uuid-1', 'love');
      expect(res.action).toBe('added');
      expect(res.userReaction).toBe('love');
    });
  });

  describe('reactBody', () => {
    it('reacts to any item via JSON body targetId', async () => {
      const res = await controller.reactBody(
        { targetId: 'item-uuid-2', reaction: 'insightful' },
        mockUserReq,
      );
      expect(postsService.reactToPost).toHaveBeenCalledWith('user-uuid-1', 'item-uuid-2', 'insightful');
      expect(res.action).toBe('added');
    });

    it('reacts to any item via JSON body postId or id', async () => {
      await controller.reactBody({ id: 'item-uuid-3', reaction: 'agree' }, mockUserReq);
      expect(postsService.reactToPost).toHaveBeenCalledWith('user-uuid-1', 'item-uuid-3', 'agree');
    });

    it('throws BadRequestException if no target ID is present in body', async () => {
      await expect(controller.reactBody({ reaction: 'love' }, mockUserReq)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeReaction', () => {
    it('removes reaction via path parameter', async () => {
      const res = await controller.removeReaction('item-uuid-1', mockUserReq);
      expect(postsService.removeReaction).toHaveBeenCalledWith('user-uuid-1', 'item-uuid-1');
      expect(res.action).toBe('removed');
    });
  });

  describe('getReactions', () => {
    it('gets reactions modal list for any item', async () => {
      const res = await controller.getReactions('item-uuid-1', { type: 'all' }, mockUserReq);
      expect(postsService.getPostReactions).toHaveBeenCalledWith('item-uuid-1', { type: 'all' }, 'user-uuid-1');
      expect(res.total).toBe(1);
    });
  });
});

