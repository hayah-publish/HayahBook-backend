import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import type { ReactionType } from './post-reaction.entity';

describe('Post Reactions Feature', () => {
  let service: PostsService;
  let mockPostsRepo: any;
  let mockUsersRepo: any;
  let mockReactionRepo: any;
  let mockUserFollowRepo: any;
  let mockI18n: any;

  beforeEach(() => {
    mockPostsRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(),
    };

    mockUsersRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockReactionRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((dto) => ({ id: 'reaction-uuid-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    mockUserFollowRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    mockI18n = {
      t: jest.fn().mockImplementation((key: string) => key),
      getCurrentLanguage: jest.fn().mockReturnValue('ar'),
    };

    service = new PostsService(
      mockPostsRepo,
      mockUsersRepo,
      {} as any, // booksRepo
      {} as any, // audiobooksRepo
      {} as any, // uploadService
      mockI18n,
      undefined, // dataSource
      mockUserFollowRepo,
      undefined, // interestsService
      mockReactionRepo,
    );
  });

  describe('normalizeReactionType', () => {
    it('normalizes English reaction types correctly', () => {
      expect(service.normalizeReactionType('agree')).toBe('agree');
      expect(service.normalizeReactionType('love')).toBe('love');
      expect(service.normalizeReactionType('applaud')).toBe('applaud');
      expect(service.normalizeReactionType('insightful')).toBe('insightful');
      expect(service.normalizeReactionType('disagree')).toBe('disagree');
    });

    it('normalizes Arabic reaction types correctly', () => {
      expect(service.normalizeReactionType('اتفق')).toBe('agree');
      expect(service.normalizeReactionType('احببته')).toBe('love');
      expect(service.normalizeReactionType('أحببته')).toBe('love');
      expect(service.normalizeReactionType('احسنت')).toBe('applaud');
      expect(service.normalizeReactionType('أحسنت')).toBe('applaud');
      expect(service.normalizeReactionType('يستحق التفكير')).toBe('insightful');
      expect(service.normalizeReactionType('اعترض')).toBe('disagree');
      expect(service.normalizeReactionType('أعترض')).toBe('disagree');
    });

    it('normalizes alternative synonyms and trims whitespace', () => {
      expect(service.normalizeReactionType('  bravo  ')).toBe('applaud');
      expect(service.normalizeReactionType('clap')).toBe('applaud');
      expect(service.normalizeReactionType('heart')).toBe('love');
      expect(service.normalizeReactionType('like')).toBe('agree');
      expect(service.normalizeReactionType('thoughtful')).toBe('insightful');
    });

    it('returns null for unknown or empty input', () => {
      expect(service.normalizeReactionType('unknown')).toBeNull();
      expect(service.normalizeReactionType('sad')).toBeNull();
      expect(service.normalizeReactionType('')).toBeNull();
      expect(service.normalizeReactionType(undefined)).toBeNull();
    });
  });

  describe('getReactionLabels', () => {
    it('returns accurate labels and icons for all 5 reactions', () => {
      const reactions: ReactionType[] = ['agree', 'love', 'applaud', 'insightful', 'disagree'];
      const icons = ['🤝', '❤️', '👏', '💭', '🙅'];
      const arLabels = ['اتفق', 'احببته', 'احسنت', 'يستحق التفكير', 'اعترض'];

      reactions.forEach((type, idx) => {
        const labels = service.getReactionLabels(type);
        expect(labels.icon).toBe(icons[idx]);
        expect(labels.ar).toBe(arLabels[idx]);
        expect(labels.en).toBeDefined();
      });
    });
  });

  describe('reactToPost', () => {
    const postMock = {
      id: 'post-1',
      likesCount: 0,
      reactionsCount: {
        total: 0,
        agree: 0,
        love: 0,
        applaud: 0,
        insightful: 0,
        disagree: 0,
      },
    } as any;

    it('throws NotFoundException if post is not found', async () => {
      mockPostsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.reactToPost('user-1', 'post-none', 'agree'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid reaction type', async () => {
      mockPostsRepo.findOne.mockResolvedValue({ ...postMock });

      await expect(
        service.reactToPost('user-1', 'post-1', 'invalid_reaction'),
      ).rejects.toThrow(BadRequestException);
    });

    it('Case 1: Adds reaction when user has not reacted before', async () => {
      mockPostsRepo.findOne.mockResolvedValue({ ...postMock });
      mockReactionRepo.findOne.mockResolvedValue(null);

      const result = await service.reactToPost('user-1', 'post-1', 'اتفق');

      expect(result.action).toBe('added');
      expect(result.userReaction).toBe('agree');
      expect(result.reactionsCount.agree).toBe(1);
      expect(result.reactionsCount.total).toBe(1);
      expect(result.topReactions).toEqual(['agree']);
      expect(mockReactionRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        postId: 'post-1',
        reactionType: 'agree',
      });
      expect(mockReactionRepo.save).toHaveBeenCalled();
      expect(mockPostsRepo.save).toHaveBeenCalled();
    });

    it('Case 2: Toggles OFF (removes) when same reaction is sent again', async () => {
      const activePost = {
        ...postMock,
        likesCount: 1,
        reactionsCount: {
          total: 1,
          agree: 1,
          love: 0,
          applaud: 0,
          insightful: 0,
          disagree: 0,
        },
      };
      mockPostsRepo.findOne.mockResolvedValue(activePost);
      mockReactionRepo.findOne.mockResolvedValue({
        id: 'reaction-1',
        postId: 'post-1',
        userId: 'user-1',
        reactionType: 'agree',
      });

      const result = await service.reactToPost('user-1', 'post-1', 'agree');

      expect(result.action).toBe('removed');
      expect(result.userReaction).toBeNull();
      expect(result.reactionsCount.agree).toBe(0);
      expect(result.reactionsCount.total).toBe(0);
      expect(result.topReactions).toEqual([]);
      expect(mockReactionRepo.delete).toHaveBeenCalledWith({ id: 'reaction-1' });
      expect(mockPostsRepo.save).toHaveBeenCalled();
    });

    it('Case 3: Switches reaction when different reaction is sent', async () => {
      const activePost = {
        ...postMock,
        likesCount: 1,
        reactionsCount: {
          total: 1,
          agree: 1,
          love: 0,
          applaud: 0,
          insightful: 0,
          disagree: 0,
        },
      };
      mockPostsRepo.findOne.mockResolvedValue(activePost);
      const existingReaction = {
        id: 'reaction-1',
        postId: 'post-1',
        userId: 'user-1',
        reactionType: 'agree',
      };
      mockReactionRepo.findOne.mockResolvedValue(existingReaction);

      const result = await service.reactToPost('user-1', 'post-1', 'احببته');

      expect(result.action).toBe('updated');
      expect(result.userReaction).toBe('love');
      expect(result.reactionsCount.agree).toBe(0);
      expect(result.reactionsCount.love).toBe(1);
      // Total reactions count remains 1!
      expect(result.reactionsCount.total).toBe(1);
      expect(result.topReactions).toEqual(['love']);
      expect(existingReaction.reactionType).toBe('love');
      expect(mockReactionRepo.save).toHaveBeenCalledWith(existingReaction);
    });
  });

  describe('removeReaction', () => {
    it('removes reaction explicitly if it exists', async () => {
      const post = {
        id: 'post-1',
        likesCount: 2,
        reactionsCount: {
          total: 2,
          agree: 1,
          love: 1,
          applaud: 0,
          insightful: 0,
          disagree: 0,
        },
      };
      mockPostsRepo.findOne.mockResolvedValue(post);
      mockReactionRepo.findOne.mockResolvedValue({
        id: 'reaction-1',
        postId: 'post-1',
        userId: 'user-1',
        reactionType: 'agree',
      });

      const result = await service.removeReaction('user-1', 'post-1');

      expect(result.action).toBe('removed');
      expect(result.userReaction).toBeNull();
      expect(result.reactionsCount.agree).toBe(0);
      expect(result.reactionsCount.love).toBe(1);
      expect(result.reactionsCount.total).toBe(1);
      expect(result.topReactions).toEqual(['love']);
      expect(mockReactionRepo.delete).toHaveBeenCalledWith({ id: 'reaction-1' });
    });
  });

  describe('getPostReactions', () => {
    it('returns tab counts, total, and user reaction list with isFollowing populated', async () => {
      mockPostsRepo.findOne.mockResolvedValue({ id: 'post-1' });

      // Mock aggregated counts query
      const rawCounts = [
        { type: 'agree', count: '5' },
        { type: 'love', count: '10' },
        { type: 'applaud', count: '12' },
        { type: 'insightful', count: '4' },
        { type: 'disagree', count: '6' },
      ];

      const countsQb = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(rawCounts),
      };

      const userItems = [
        {
          id: 'react-1',
          userId: 'user-sarah',
          postId: 'post-1',
          reactionType: 'love',
          createdAt: new Date(),
          user: {
            id: 'user-sarah',
            name: 'Sarah Harby',
            profileUrl: 'https://example.com/sarah.jpg',
            userType: 'reader',
            isVerified: true,
          },
        },
      ];

      const listQb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([userItems, 1]),
      };

      mockReactionRepo.createQueryBuilder
        .mockReturnValueOnce(countsQb)
        .mockReturnValueOnce(listQb);

      mockUserFollowRepo.find.mockResolvedValue([
        { followingId: 'user-sarah' },
      ]);

      const result = await service.getPostReactions(
        'post-1',
        { page: 1, limit: 20, type: 'all' },
        'current-user-id',
      );

      expect(result.counts.all).toBe(37);
      expect(result.counts.agree).toBe(5);
      expect(result.counts.love).toBe(10);
      expect(result.counts.applaud).toBe(12);
      expect(result.counts.insightful).toBe(4);
      expect(result.counts.disagree).toBe(6);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].reaction).toBe('love');
      expect(result.data[0].reactionIcon).toBe('❤️');
      expect(result.data[0].reactionLabelAr).toBe('احببته');
      expect(result.data[0].user.name).toBe('Sarah Harby');
      expect(result.data[0].user.isVerified).toBe(true);
      expect(result.data[0].user.isFollowing).toBe(true);
    });
  });

  describe('formatPost with reactions', () => {
    it('formats post with reactionsCount, sorted topReactions, and userReaction', async () => {
      const post = {
        id: 'post-1',
        type: 'post',
        content: 'محتوى المنشور التجريبي',
        likesCount: 15,
        reactionsCount: {
          total: 15,
          agree: 3,
          love: 8,
          applaud: 4,
          insightful: 0,
          disagree: 0,
        },
        commentsCount: 2,
        sharesCount: 1,
        bookmarksCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { id: 'author-1', name: 'Author', role: 'user' },
      } as any;

      const formatted = await service.formatPost(post, undefined, 'love');

      expect(formatted.likesCount).toBe(15);
      expect(formatted.reactionsCount).toEqual({
        total: 15,
        agree: 3,
        love: 8,
        applaud: 4,
        insightful: 0,
        disagree: 0,
      });
      // Top 3 sorted descending: love (8), applaud (4), agree (3)
      expect(formatted.topReactions).toEqual(['love', 'applaud', 'agree']);
      expect(formatted.userReaction).toBe('love');
    });
  });
});

