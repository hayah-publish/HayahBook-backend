import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommentsService } from './comments.service';
import { Comment } from './comment.entity';
import { CommentReaction } from './comment-reaction.entity';
import { CommentMute } from './comment-mute.entity';
import { CommentReport } from './comment-report.entity';
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';
import { UserUserFollow } from '../users/user-user-follow.entity';
import { UploadService } from '../upload/upload.service';
import { I18nService } from '../i18n/i18n.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentsRepo: any;
  let commentReactionsRepo: any;
  let commentMutesRepo: any;
  let commentReportsRepo: any;
  let postsRepo: any;
  let usersRepo: any;
  let userFollowRepo: any;
  let uploadService: any;
  let i18nService: any;

  const mockPost: any = {
    id: 'post-1',
    userId: 'author-post-1',
    commentsCount: 5,
  };

  beforeEach(async () => {
    commentsRepo = {
      create: jest.fn().mockImplementation((dto) => ({
        id: 'comment-new-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
      decrement: jest.fn().mockResolvedValue({ affected: 1 }),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        transaction: jest.fn(async (cb) =>
          cb({
            query: jest.fn().mockResolvedValue([]),
            getRepository: jest.fn((entity) => {
              if (entity === Post) return postsRepo;
              return commentsRepo;
            }),
          }),
        ),
      },
      createQueryBuilder: jest.fn(),
    };

    commentReactionsRepo = {
      create: jest
        .fn()
        .mockImplementation((dto) => ({ id: 'react-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    commentMutesRepo = {
      create: jest.fn().mockImplementation((dto) => ({ id: 'mute-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    commentReportsRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation((dto) => ({ id: 'report-1', ...dto })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    postsRepo = {
      findOne: jest.fn().mockResolvedValue(mockPost),
      increment: jest.fn().mockResolvedValue({ affected: 1 }),
      decrement: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    usersRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockImplementation(({ where }) => {
        const id = where?.id || 'user-1';
        return Promise.resolve({
          id,
          name:
            id === 'author-comment-1'
              ? 'Author 1'
              : id === 'sara-ali'
                ? 'Sara Ali'
                : 'User ' + id,
          profileUrl: 'https://cdn.hayahbook.com/avatars/' + id + '.jpg',
          role: 'user',
          userType: 'Reader',
        });
      }),
    };

    userFollowRepo = {
      find: jest.fn().mockResolvedValue([{ followingId: 'friend-1' }]),
      findOne: jest.fn(),
    };

    uploadService = {
      uploadCommentImage: jest
        .fn()
        .mockResolvedValue(
          'https://cdn.hayahbook.com/comments/images/image.jpg',
        ),
      deleteFileByUrl: jest.fn().mockResolvedValue(undefined),
    };

    i18nService = {
      t: jest.fn().mockImplementation((k) => k),
      getCurrentLanguage: jest.fn().mockReturnValue('ar'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentsRepo },
        {
          provide: getRepositoryToken(CommentReaction),
          useValue: commentReactionsRepo,
        },
        {
          provide: getRepositoryToken(CommentMute),
          useValue: commentMutesRepo,
        },
        {
          provide: getRepositoryToken(CommentReport),
          useValue: commentReportsRepo,
        },
        { provide: getRepositoryToken(Post), useValue: postsRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        {
          provide: getRepositoryToken(UserUserFollow),
          useValue: userFollowRepo,
        },
        { provide: UploadService, useValue: uploadService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createComment', () => {
    it('creates a root comment successfully using contentId instead of postId', async () => {
      const res = await service.createComment('user-1', {
        contentId: 'post-1',
        content: 'تعليق باستخدام contentId',
      });

      expect(postsRepo.increment).toHaveBeenCalledWith(
        { id: 'post-1' },
        'commentsCount',
        1,
      );
      expect(res.data.content).toBe('تعليق باستخدام contentId');
    });

    it('creates a root comment successfully and increments post commentsCount', async () => {
      const res = await service.createComment('user-1', {
        postId: 'post-1',
        content: 'تعليق رائع ومميز',
      });

      expect(postsRepo.increment).toHaveBeenCalledWith(
        { id: 'post-1' },
        'commentsCount',
        1,
      );
      expect(res.data.content).toBe('تعليق رائع ومميز');
      expect(res.data.parentId).toBeNull();
      expect(res.data.publisher.id).toBe('user-1');
      expect(res.data.permissions.canEdit).toBe(true);
      expect(res.data.permissions.canDelete).toBe(true);
    });

    it('uploads image when file is provided with the comment', async () => {
      const mockFile: any = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 1024,
      };
      const res = await service.createComment(
        'user-1',
        { postId: 'post-1', content: 'صورة رائعة' },
        undefined,
        mockFile,
      );

      expect(uploadService.uploadCommentImage).toHaveBeenCalledWith(
        'user-1',
        mockFile,
      );
      expect(res.data.imageUrl).toBe(
        'https://cdn.hayahbook.com/comments/images/image.jpg',
      );
    });

    it('creates a comment with user mentions and populates mentioned users', async () => {
      const mentionedUser = {
        id: 'user-2',
        name: 'Sarah Harby',
        profileUrl: 'https://cdn.hayahbook.com/sarah.jpg',
        role: 'user',
        userType: 'Reader',
      };
      usersRepo.find.mockResolvedValueOnce([mentionedUser]);

      const res = await service.createComment('user-1', {
        postId: 'post-1',
        content: 'مرحباً بالصديقة @user-2',
        mentions: ['user-2'],
      });

      expect(res.data.mentions).toHaveLength(1);
      expect(res.data.mentions[0].id).toBe('user-2');
      expect(res.data.mentions[0].name).toBe('Sarah Harby');
    });

    it('throws NotFoundException when post does not exist', async () => {
      postsRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.createComment('user-1', { postId: 'invalid', content: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createReply', () => {
    it('creates a reply to a root comment and increments parent repliesCount and post commentsCount', async () => {
      const rootComment: any = {
        id: 'root-comment-1',
        postId: 'post-1',
        parentId: null,
        userId: 'author-comment-1',
        post: mockPost,
      };
      commentsRepo.findOne.mockResolvedValueOnce(rootComment);

      const res = await service.createReply('user-1', 'root-comment-1', {
        content: 'أتفق معك تماماً',
      });

      expect(commentsRepo.increment).toHaveBeenCalledWith(
        { id: 'root-comment-1' },
        'repliesCount',
        1,
      );
      expect(postsRepo.increment).toHaveBeenCalledWith(
        { id: 'post-1' },
        'commentsCount',
        1,
      );
      expect(res.data.parentId).toBe('root-comment-1');
      expect(res.data.replyToUser?.id).toBe('author-comment-1');
    });

    it('flattens nested reply to stay under root comment for clean mobile layout', async () => {
      const nestedReply: any = {
        id: 'nested-reply-1',
        postId: 'post-1',
        parentId: 'root-comment-1', // Already a reply!
        userId: 'sara-ali',
        post: mockPost,
      };
      commentsRepo.findOne.mockResolvedValueOnce(nestedReply);

      const res = await service.createReply('user-1', 'nested-reply-1', {
        content: '@Sara Ali رد على رد',
      });

      // The new reply's parentId is the root comment
      expect(res.data.parentId).toBe('root-comment-1');
      // The replyToUser is Sara Ali
      expect(res.data.replyToUser?.id).toBe('sara-ali');
    });
  });

  describe('reactToComment', () => {
    const mockComment: any = {
      id: 'comment-1',
      postId: 'post-1',
      likesCount: 1,
      reactionsCount: {
        total: 1,
        agree: 0,
        love: 1,
        applaud: 0,
        insightful: 0,
        disagree: 0,
      },
    };

    it('adds new reaction when user has not reacted yet', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({
        ...mockComment,
        likesCount: 0,
        reactionsCount: { total: 0 },
      });
      commentReactionsRepo.findOne.mockResolvedValueOnce(null);

      const res = await service.reactToComment('user-1', 'comment-1', 'love');
      expect(res.action).toBe('added');
      expect(res.userReaction).toBe('love');
      expect(res.reactionsCount.love).toBe(1);
      expect(res.topReactions).toContain('love');
    });

    it('toggles OFF reaction when same reaction is clicked again', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({ ...mockComment });
      commentReactionsRepo.findOne.mockResolvedValueOnce({
        id: 'react-1',
        reactionType: 'love',
      });

      const res = await service.reactToComment('user-1', 'comment-1', 'love');
      expect(res.action).toBe('removed');
      expect(res.userReaction).toBeNull();
      expect(res.reactionsCount.love).toBe(0);
      expect(commentReactionsRepo.delete).toHaveBeenCalledWith({
        id: 'react-1',
      });
    });

    it('switches reaction when different reaction is selected', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({ ...mockComment });
      commentReactionsRepo.findOne.mockResolvedValueOnce({
        id: 'react-1',
        reactionType: 'love',
      });

      const res = await service.reactToComment(
        'user-1',
        'comment-1',
        'insightful',
      );
      expect(res.action).toBe('updated');
      expect(res.userReaction).toBe('insightful');
      expect(res.reactionsCount.love).toBe(0);
      expect(res.reactionsCount.insightful).toBe(1);
    });

    it('throws BadRequestException on invalid reaction type', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({ ...mockComment });
      await expect(
        service.reactToComment('user-1', 'comment-1', 'unknown_type'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateComment', () => {
    it('allows comment author to update content and sets isEdited to true', async () => {
      const comment: any = {
        id: 'comment-1',
        userId: 'user-1',
        content: 'القديم',
        isEdited: false,
        post: mockPost,
      };
      commentsRepo.findOne.mockResolvedValueOnce(comment);

      const res = await service.updateComment(
        'user-1',
        'comment-1',
        'المحتوى الجديد',
      );
      expect(res.data.content).toBe('المحتوى الجديد');
      expect(res.data.isEdited).toBe(true);
    });

    it('throws ForbiddenException if non-author attempts to edit', async () => {
      const comment: any = { id: 'comment-1', userId: 'user-other' };
      commentsRepo.findOne.mockResolvedValueOnce(comment);

      await expect(
        service.updateComment('user-1', 'comment-1', 'تعديل غير مصرح'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteComment', () => {
    it('allows comment author to delete comment and decrements post commentsCount', async () => {
      const comment: any = {
        id: 'comment-1',
        userId: 'user-1',
        postId: 'post-1',
        parentId: null,
        post: mockPost,
      };
      commentsRepo.findOne.mockResolvedValueOnce(comment);
      commentsRepo.count.mockResolvedValueOnce(2); // Has 2 replies

      const res = await service.deleteComment('user-1', 'comment-1');
      expect(res.message).toBe('comments.deleted');
    });

    it('allows post owner to delete anyone’s comment on their post (moderation)', async () => {
      const comment: any = {
        id: 'comment-1',
        userId: 'stranger-user',
        postId: 'post-1',
        post: { id: 'post-1', userId: 'author-post-1' }, // user is author of post
      };
      commentsRepo.findOne.mockResolvedValueOnce(comment);
      commentsRepo.count.mockResolvedValueOnce(0);

      const res = await service.deleteComment('author-post-1', 'comment-1');
      expect(res.message).toBe('comments.deleted');
    });

    it('throws ForbiddenException if unauthorized user tries to delete', async () => {
      const comment: any = {
        id: 'comment-1',
        userId: 'stranger',
        postId: 'post-1',
        post: { id: 'post-1', userId: 'other-author' },
      };
      commentsRepo.findOne.mockResolvedValueOnce(comment);

      await expect(
        service.deleteComment('user-1', 'comment-1', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('togglePinComment', () => {
    it('allows post owner to pin a comment and unpins previous pinned comment', async () => {
      const comment: any = {
        id: 'comment-1',
        postId: 'post-1',
        isPinned: false,
        post: { id: 'post-1', userId: 'author-post-1' },
      };
      commentsRepo.findOne.mockResolvedValueOnce(comment);

      const res = await service.togglePinComment('author-post-1', 'comment-1');
      expect(commentsRepo.update).toHaveBeenCalledWith(
        { postId: 'post-1', isPinned: true },
        { isPinned: false, pinnedAt: null },
      );
      expect(res.isPinned).toBe(true);
    });

    it('throws ForbiddenException if non-post-owner tries to pin', async () => {
      const comment: any = {
        id: 'comment-1',
        postId: 'post-1',
        post: { id: 'post-1', userId: 'author-post-1' },
      };
      commentsRepo.findOne.mockResolvedValueOnce(comment);

      await expect(
        service.togglePinComment('random-user', 'comment-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('toggleHideComment', () => {
    it('toggles isHidden boolean on comment', async () => {
      const comment: any = {
        id: 'comment-1',
        userId: 'user-1',
        isHidden: false,
        post: mockPost,
      };
      commentsRepo.findOne.mockResolvedValueOnce(comment);

      const res = await service.toggleHideComment('user-1', 'comment-1');
      expect(res.isHidden).toBe(true);
    });
  });

  describe('toggleMuteComment', () => {
    it('mutes comment when not muted and unmutes when already muted', async () => {
      commentsRepo.findOne.mockResolvedValue({ id: 'comment-1' });

      // First call: not muted -> mutes
      commentMutesRepo.findOne.mockResolvedValueOnce(null);
      const res1 = await service.toggleMuteComment('user-1', 'comment-1');
      expect(res1.isMuted).toBe(true);

      // Second call: already muted -> unmutes
      commentMutesRepo.findOne.mockResolvedValueOnce({ id: 'mute-1' });
      const res2 = await service.toggleMuteComment('user-1', 'comment-1');
      expect(res2.isMuted).toBe(false);
    });
  });

  describe('reportComment', () => {
    it('creates comment report successfully', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({ id: 'comment-1' });
      const res = await service.reportComment(
        'user-1',
        'comment-1',
        'محتوى مسيء',
      );
      expect(commentReportsRepo.create).toHaveBeenCalledWith({
        commentId: 'comment-1',
        userId: 'user-1',
        reason: 'محتوى مسيء',
      });
      expect(res.message).toBe('comments.reported');
    });

    it('rejects when author attempts to report their own comment', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({
        id: 'comment-1',
        userId: 'user-1',
      });
      await expect(
        service.reportComment('user-1', 'comment-1', 'spam'),
      ).rejects.toThrow();
    });

    it('rejects when user already reported the same comment', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({
        id: 'comment-1',
        userId: 'author-9',
      });
      commentReportsRepo.findOne.mockResolvedValueOnce({ id: 'report-prev' });
      await expect(
        service.reportComment('user-1', 'comment-1', 'spam'),
      ).rejects.toThrow();
    });

    it('handles something_else with notes correctly', async () => {
      commentsRepo.findOne.mockResolvedValueOnce({
        id: 'comment-2',
        userId: 'other-user',
      });
      const res = await service.reportComment(
        'user-1',
        'comment-2',
        'something_else',
        'Detailed notes here',
      );
      expect(commentReportsRepo.create).toHaveBeenCalledWith({
        commentId: 'comment-2',
        userId: 'user-1',
        reason: 'something_else: Detailed notes here',
        details: 'Detailed notes here',
      });
      expect(res.message).toBe('comments.reported');
      expect(res.reason).toBe('something_else');
      expect(res.details).toBe('Detailed notes here');
    });
  });

  describe('getReportReasons', () => {
    it('returns the 8 report reasons with localized displayName in Arabic and English', () => {
      const arReasons = service.getReportReasons('ar') as any;
      expect(arReasons).toHaveLength(8);
      expect(arReasons[0].id).toBe('2f7dc7e9-df71-4fc3-84d0-53f608b75f14');
      expect(arReasons[0].displayName).toBe('محتوى غير مرغوب فيه');
      expect(arReasons[0].name_ar).toBe('محتوى غير مرغوب فيه');
      expect(arReasons[0].name_en).toBe('Spam');

      const enReasons = service.getReportReasons('en') as any;
      expect(enReasons).toHaveLength(8);
      expect(enReasons[0].id).toBe('2f7dc7e9-df71-4fc3-84d0-53f608b75f14');
      expect(enReasons[0].displayName).toBe('Spam');
      expect(enReasons[0].name_en).toBe('Spam');
      expect(enReasons[0].name_ar).toBe('محتوى غير مرغوب فيه');
    });

    it('returns metadata title and subtitle when includeMeta is true', () => {
      const metaResponse = service.getReportReasons('en', true) as any;
      expect(metaResponse).toHaveProperty('title');
      expect(metaResponse).toHaveProperty('subtitle');
      expect(metaResponse).toHaveProperty('reasons');
      expect(metaResponse.reasons).toHaveLength(8);
    });
  });

  describe('getSortOptions and normalizeSort', () => {
    it('returns 4 standard sorting options matching the design sheet', () => {
      const options = service.getSortOptions();
      expect(options).toHaveLength(4);
      expect(options[0].key).toBe('most_relevant');
      expect(options[1].key).toBe('newest');
      expect(options[2].key).toBe('all_comments');
      expect(options[3].key).toBe('oldest');
    });

    it('normalizes various English and Arabic sort inputs correctly', () => {
      expect(service.normalizeSort(undefined)).toBe('most_relevant');
      expect(service.normalizeSort('most_relevant')).toBe('most_relevant');
      expect(service.normalizeSort('الأكثر صلة')).toBe('most_relevant');
      expect(service.normalizeSort('friends')).toBe('most_relevant');
      expect(service.normalizeSort('newest')).toBe('newest');
      expect(service.normalizeSort('الأحدث')).toBe('newest');
      expect(service.normalizeSort('all_comments')).toBe('all_comments');
      expect(service.normalizeSort('كل التعليقات')).toBe('all_comments');
      expect(service.normalizeSort('oldest')).toBe('oldest');
    });
  });

  describe('getPostComments', () => {
    it('fetches comments and applies most_relevant ordering with friends boost', async () => {
      const mockQb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      commentsRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.getPostComments(
        'post-1',
        { sort: 'most_relevant' },
        'user-1',
      );
      expect(res.sort).toBe('most_relevant');
      expect(userFollowRepo.find).toHaveBeenCalledWith({
        where: { followerId: 'user-1' },
        select: { followingId: true },
      });
      expect(mockQb.orderBy).toHaveBeenCalledWith('comment.isPinned', 'DESC');
    });

    it('does not filter out hidden comments when sort is all_comments', async () => {
      const mockQb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      commentsRepo.createQueryBuilder.mockReturnValue(mockQb);

      const res = await service.getPostComments(
        'post-1',
        { sort: 'all_comments' },
        'user-1',
      );
      expect(res.sort).toBe('all_comments');
      // When all_comments is selected, andWhere with is_hidden should NOT be called
      expect(mockQb.andWhere).not.toHaveBeenCalledWith(
        expect.stringContaining('is_hidden'),
        expect.anything(),
      );
    });
  });

  describe('getCommentReactions', () => {
    it('throws NotFoundException if comment does not exist', async () => {
      commentsRepo.findOne.mockResolvedValue(null);
      await expect(
        service.getCommentReactions('non-existent', { type: 'all' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns tabbed counts and paginated user reactions list', async () => {
      commentsRepo.findOne.mockResolvedValue({ id: 'comment-1' });

      const mockCountQb: any = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { type: 'love', count: '3' },
          { type: 'agree', count: '2' },
        ]),
      };

      const mockListQb: any = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'react-1',
              reactionType: 'love',
              createdAt: new Date(),
              user: {
                id: 'reactor-1',
                name: 'Reactor User',
                profileUrl: null,
                userType: 'reader',
              },
            },
          ],
          1,
        ]),
      };

      commentReactionsRepo.createQueryBuilder
        .mockReturnValueOnce(mockCountQb)
        .mockReturnValueOnce(mockListQb);

      userFollowRepo.find.mockResolvedValue([{ followingId: 'reactor-1' }]);

      const result = await service.getCommentReactions(
        'comment-1',
        { page: 1, limit: 20 },
        'current-user',
      );

      expect(result.counts.all).toBe(5);
      expect(result.counts.love).toBe(3);
      expect(result.counts.agree).toBe(2);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].reaction).toBe('love');
      expect(result.data[0].reactionIcon).toBe('❤️');
      expect(result.data[0].user.isFollowing).toBe(true);
      expect(result.total).toBe(1);
    });
  });
});

describe('CommentsService hidden reply visibility', () => {
  let service: CommentsService;
  let commentsRepo: any;
  const postOwnerId = 'post-owner';
  beforeEach(async () => {
    commentsRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: 'root', post: { userId: postOwnerId } }),
      createQueryBuilder: jest.fn(),
    };
    const qb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    commentsRepo.createQueryBuilder.mockReturnValue(qb);
    const module = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentsRepo },
        {
          provide: getRepositoryToken(CommentReaction),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(CommentMute),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: getRepositoryToken(CommentReport), useValue: {} },
        { provide: getRepositoryToken(Post), useValue: {} },
        { provide: getRepositoryToken(User), useValue: {} },
        { provide: getRepositoryToken(UserUserFollow), useValue: {} },
        { provide: UploadService, useValue: {} },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compile();
    service = module.get(CommentsService);
  });

  it('hides replies from anonymous viewers by default', async () => {
    await service.getCommentReplies('root', {}, undefined);
    expect(commentsRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
      'reply.isHidden = false',
    );
  });

  it('allows a reply author to see their own hidden reply', async () => {
    await service.getCommentReplies('root', {}, 'reply-author');
    expect(commentsRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith(
      '(reply.isHidden = false OR reply.userId = :currentUserId)',
      { currentUserId: 'reply-author' },
    );
  });

  it('allows the post owner and all_comments mode to see hidden replies', async () => {
    await service.getCommentReplies('root', {}, postOwnerId);
    expect(commentsRepo.createQueryBuilder().andWhere).not.toHaveBeenCalled();
    commentsRepo.createQueryBuilder.mockClear();
    await service.getCommentReplies(
      'root',
      { sort: 'all_comments' },
      undefined,
    );
    expect(commentsRepo.createQueryBuilder().andWhere).not.toHaveBeenCalled();
  });
});

describe('CommentsService identity options and unique anonymous formatting', () => {
  it('returns unique anonymousName and anonymousNumber in getIdentityOptions', async () => {
    const user = {
      id: 'user-1',
      name: 'Ahmed Murad',
      profileUrl: null,
      userType: 'Reader',
      role: 'user',
      anonymousNumber: 58214,
    };
    const usersRepo = {
      findOne: jest.fn().mockResolvedValue(user),
    };
    const aliasRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const i18n = {
      t: (key: string) => key,
      getCurrentLanguage: () => 'ar',
    };

    const service = new CommentsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      usersRepo as never,
      {} as never,
      {} as never,
      i18n as never,
      {} as never,
      {} as never,
      aliasRepo as never,
    );

    const optionsAr = await service.getIdentityOptions('user-1', 'ar');
    expect(optionsAr.anonymousOption.anonymousNumber).toBe(58214);
    expect(optionsAr.anonymousOption.anonymousName).toBe('مستخدم مجهول - 58214');

    const optionsEn = await service.getIdentityOptions('user-1', 'en');
    expect(optionsEn.anonymousOption.anonymousNumber).toBe(58214);
    expect(optionsEn.anonymousOption.anonymousName).toBe('Anonymous Reader - 58214');
  });

  it('formats anonymous comment publisher with unique number and hidden user id', async () => {
    const i18n = {
      t: (key: string) => key,
      getCurrentLanguage: () => 'ar',
    };
    const service = new CommentsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      i18n as never,
    );

    const comment: any = {
      id: 'comment-1',
      postId: 'post-1',
      identityType: 'anonymous',
      isAnonymous: true,
      user: {
        id: 'real-user-id',
        name: 'Real Name',
        anonymousNumber: 48192,
      },
    };

    const formattedAr = await service.formatComment(comment);
    expect(formattedAr.publisher.id).toBeNull();
    expect(formattedAr.publisher.name).toBe('مستخدم مجهول - 48192');
    expect(formattedAr.publisher.isAnonymous).toBe(true);

    i18n.getCurrentLanguage = () => 'en';
    const formattedEn = await service.formatComment(comment);
    expect(formattedEn.publisher.id).toBeNull();
    expect(formattedEn.publisher.name).toBe('Anonymous Reader - 48192');
  });
});
