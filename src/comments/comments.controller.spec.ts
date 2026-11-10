import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

describe('CommentsController', () => {
  let controller: CommentsController;
  let service: Partial<Record<keyof CommentsService, jest.Mock>>;

  const mockUserReq: any = {
    user: {
      userId: 'user-1',
      email: 'user@example.com',
      role: 'user',
    },
  };

  beforeEach(async () => {
    service = {
      createComment: jest.fn().mockResolvedValue({
        message: 'تم نشر التعليق بنجاح',
        data: { id: 'comment-1', content: 'test comment' },
      }),
      createReply: jest.fn().mockResolvedValue({
        message: 'تم نشر الرد بنجاح',
        data: { id: 'reply-1', content: 'test reply' },
      }),
      getSortOptions: jest.fn().mockReturnValue([
        { key: 'most_relevant' },
        { key: 'newest' },
        { key: 'all_comments' },
        { key: 'oldest' },
      ]),
      getReportReasons: jest.fn().mockReturnValue([
        { key: 'spam', displayName: 'Spam', name_ar: 'محتوى غير مرغوب فيه', name_en: 'Spam' },
      ]),
      getPostComments: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      getCommentReplies: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
      reactToComment: jest.fn().mockResolvedValue({
        message: 'تم التفاعل بنجاح',
        action: 'added',
        userReaction: 'love',
      }),
      removeCommentReaction: jest.fn().mockResolvedValue({
        message: 'تمت إزالة التفاعل بنجاح',
        action: 'removed',
        userReaction: null,
      }),
      getCommentReactions: jest.fn().mockResolvedValue({
        counts: { all: 1, total: 1, agree: 1, love: 0, applaud: 0, insightful: 0, disagree: 0 },
        data: [],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      togglePinComment: jest.fn().mockResolvedValue({
        message: 'تم تثبيت التعليق في الأعلى بنجاح',
        isPinned: true,
      }),
      toggleHideComment: jest.fn().mockResolvedValue({
        message: 'تم إخفاء التعليق بنجاح',
        isHidden: true,
      }),
      toggleMuteComment: jest.fn().mockResolvedValue({
        message: 'تم كتم إشعارات هذا التعليق',
        isMuted: true,
      }),
      reportComment: jest.fn().mockResolvedValue({
        message: 'تم إرسال البلاغ بنجاح وسيتم مراجعته',
      }),
      updateComment: jest.fn().mockResolvedValue({
        message: 'تم تعديل التعليق بنجاح',
        data: { id: 'comment-1', content: 'updated' },
      }),
      deleteComment: jest.fn().mockResolvedValue({
        message: 'تم حذف التعليق بنجاح',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<CommentsController>(CommentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createComment', () => {
    it('delegates to service.createComment with user id and dto', async () => {
      const dto = { postId: 'post-1', content: 'hello' };
      const res = await controller.createComment(mockUserReq, dto);

      expect(service.createComment).toHaveBeenCalledWith('user-1', dto, 'post-1', undefined);
      expect(res.data.id).toBe('comment-1');
    });
  });

  describe('getSortOptions', () => {
    it('returns available sorting options', () => {
      const res = controller.getSortOptions();
      expect(res).toHaveLength(4);
      expect(service.getSortOptions).toHaveBeenCalled();
    });
  });

  describe('getReportReasons', () => {
    it('delegates to service.getReportReasons with lang and meta', () => {
      const res = controller.getReportReasons('ar', 'false');
      expect(res).toBeDefined();
      expect(service.getReportReasons).toHaveBeenCalledWith('ar', false);
    });
  });

  describe('createReply', () => {
    it('delegates to service.createReply with comment id', async () => {
      const dto = { content: 'hello reply' };
      const res = await controller.createReply(mockUserReq, 'comment-1', dto);

      expect(service.createReply).toHaveBeenCalledWith('user-1', 'comment-1', dto, undefined);
      expect(res.data.id).toBe('reply-1');
    });

    it('delegates to service.createReply with dto.commentId when id is not passed in url', async () => {
      const dto = { commentId: 'comment-2', content: 'hello reply' };
      const res = await controller.createReply(mockUserReq, undefined, dto);

      expect(service.createReply).toHaveBeenCalledWith('user-1', 'comment-2', dto, undefined);
      expect(res.data.id).toBe('reply-1');
    });
  });

  describe('getComments', () => {
    it('delegates to service.getPostComments with query parameters', async () => {
      const query = { postId: 'post-1', sort: 'most_interactive', page: 1, limit: 10 };
      const res = await controller.getComments(query, mockUserReq);

      expect(service.getPostComments).toHaveBeenCalledWith('post-1', query, 'user-1');
      expect(res.total).toBe(0);
    });

    it('returns empty list if postId is missing', async () => {
      const res = await controller.getComments({});
      expect(res.data).toEqual([]);
      expect(res.total).toBe(0);
    });
  });

  describe('getCommentReplies', () => {
    it('delegates to service.getCommentReplies', async () => {
      const query = { page: 1, limit: 5 };
      const res = await controller.getCommentReplies('comment-1', query, mockUserReq);

      expect(service.getCommentReplies).toHaveBeenCalledWith('comment-1', query, 'user-1');
      expect(res.data).toEqual([]);
    });
  });

  describe('reactToComment', () => {
    it('delegates to service.reactToComment', async () => {
      const res = await controller.reactToComment(mockUserReq, 'comment-1', { reaction: 'love' });
      expect(service.reactToComment).toHaveBeenCalledWith('user-1', 'comment-1', 'love');
      expect(res.action).toBe('added');
    });
  });

  describe('removeCommentReaction', () => {
    it('delegates to service.removeCommentReaction', async () => {
      const res = await controller.removeCommentReaction(mockUserReq, 'comment-1');
      expect(service.removeCommentReaction).toHaveBeenCalledWith('user-1', 'comment-1');
      expect(res.action).toBe('removed');
    });
  });

  describe('togglePin', () => {
    it('delegates to service.togglePinComment', async () => {
      const res = await controller.togglePin(mockUserReq, 'comment-1');
      expect(service.togglePinComment).toHaveBeenCalledWith('user-1', 'comment-1', false);
      expect(res.isPinned).toBe(true);
    });
  });

  describe('toggleHide', () => {
    it('delegates to service.toggleHideComment', async () => {
      const res = await controller.toggleHide(mockUserReq, 'comment-1');
      expect(service.toggleHideComment).toHaveBeenCalledWith('user-1', 'comment-1', false);
      expect(res.isHidden).toBe(true);
    });
  });

  describe('toggleMute', () => {
    it('delegates to service.toggleMuteComment', async () => {
      const res = await controller.toggleMute(mockUserReq, 'comment-1');
      expect(service.toggleMuteComment).toHaveBeenCalledWith('user-1', 'comment-1');
      expect(res.isMuted).toBe(true);
    });
  });

  describe('reportComment', () => {
    it('delegates to service.reportComment', async () => {
      const res = await controller.reportComment(mockUserReq, 'comment-1', { reason: 'spam' });
      expect(service.reportComment).toHaveBeenCalledWith('user-1', 'comment-1', 'spam');
      expect(res.message).toBe('تم إرسال البلاغ بنجاح وسيتم مراجعته');
    });
  });

  describe('updateComment', () => {
    it('delegates to service.updateComment', async () => {
      const res = await controller.updateComment(mockUserReq, 'comment-1', { content: 'updated' });
      expect(service.updateComment).toHaveBeenCalledWith('user-1', 'comment-1', 'updated');
      expect(res.data.content).toBe('updated');
    });
  });

  describe('deleteComment', () => {
    it('delegates to service.deleteComment', async () => {
      const res = await controller.deleteComment(mockUserReq, 'comment-1');
      expect(service.deleteComment).toHaveBeenCalledWith('user-1', 'comment-1', false);
      expect(res.message).toBe('تم حذف التعليق بنجاح');
    });
  });

  describe('getCommentsByPostId', () => {
    it('delegates to service.getPostComments with postId path param', async () => {
      const query = { sort: 'most_interactive', page: 1, limit: 10 };
      const res = await controller.getCommentsByPostId('post-uuid-1', query, mockUserReq);
      expect(service.getPostComments).toHaveBeenCalledWith('post-uuid-1', query, 'user-1');
      expect(res.total).toBe(0);
    });
  });

  describe('getCommentReactions', () => {
    it('delegates to service.getCommentReactions', async () => {
      const query = { page: 1, limit: 20, type: 'all' };
      const res = await controller.getCommentReactions('comment-1', query, mockUserReq);
      expect(service.getCommentReactions).toHaveBeenCalledWith('comment-1', query, 'user-1');
      expect(res.counts.all).toBe(1);
    });
  });

  describe('createCommentByPostId', () => {
    it('delegates to service.createComment with postId path param', async () => {
      const dto = { content: 'nice article' };
      const res = await controller.createCommentByPostId(mockUserReq, 'post-uuid-1', dto);
      expect(service.createComment).toHaveBeenCalledWith('user-1', dto, 'post-uuid-1', undefined);
      expect(res.data.id).toBe('comment-1');
    });
  });
});

