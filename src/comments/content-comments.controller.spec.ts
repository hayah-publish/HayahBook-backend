import { Test, TestingModule } from '@nestjs/testing';
import { ContentCommentsController } from './content-comments.controller';
import { CommentsService } from './comments.service';

describe('ContentCommentsController', () => {
  let controller: ContentCommentsController;
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
      getPostComments: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentCommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<ContentCommentsController>(ContentCommentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getContentComments', () => {
    it('delegates to service.getPostComments with content ID and query', async () => {
      const query = { sort: 'newest', page: 1, limit: 10 };
      const res = await controller.getContentComments('content-id-1', query, mockUserReq);
      expect(service.getPostComments).toHaveBeenCalledWith('content-id-1', query, 'user-1');
      expect(res.total).toBe(0);
    });
  });

  describe('createContentComment', () => {
    it('delegates to service.createComment with content ID and dto', async () => {
      const dto = { content: 'comment content' };
      const res = await controller.createContentComment(mockUserReq, 'content-id-1', dto);
      expect(service.createComment).toHaveBeenCalledWith('user-1', dto, 'content-id-1', undefined);
      expect(res.data.id).toBe('comment-1');
    });
  });
});
