import { Test, TestingModule } from '@nestjs/testing';
import { SnippetsController } from './snippets.controller';
import { PostsService } from './posts.service';

describe('SnippetsController', () => {
  let controller: SnippetsController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;

  const mockSnippetResponse = {
    message: 'تم نشر المقتطف في ملفك الشخصي بنجاح',
    data: {
      id: 'snippet-uuid-1',
      type: 'snippet',
      content: 'أحياناً نصمت لأننا نعرف كلامنا لن يغير شيئاً',
      quote: 'أحياناً نصمت لأننا نعرف كلامنا لن يغير شيئاً',
      book: {
        id: 'book-uuid-1',
        title: 'عادات التعافي',
        author: 'محمود علي',
        coverUrl: 'https://cdn.hayahbook.com/books/covers/sample.jpg',
      },
      publisher: {
        id: 'user-uuid-1',
        name: 'mahomoud ali',
        profileUrl: null,
        role: 'user',
      },
      reactionsCount: { total: 0, agree: 0, love: 0, applaud: 0, insightful: 0, disagree: 0 },
      commentsCount: 0,
      sharesCount: 0,
      bookmarksCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockUserReq = {
    user: {
      userId: 'user-uuid-1',
      email: 'test@example.com',
      role: 'user',
    },
  } as any;

  beforeEach(async () => {
    postsService = {
      createSnippet: jest.fn().mockResolvedValue(mockSnippetResponse),
      findAll: jest.fn().mockResolvedValue({
        data: [mockSnippetResponse.data],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      findOne: jest.fn().mockResolvedValue(mockSnippetResponse.data),
      remove: jest.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
      reactToPost: jest.fn().mockResolvedValue({ success: true, reaction: 'agree' }),
      removeReaction: jest.fn().mockResolvedValue({ success: true }),
      getPostReactions: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      sharePost: jest.fn().mockResolvedValue({ success: true, sharesCount: 1 }),
      toggleComments: jest.fn().mockResolvedValue({ success: true, commentsDisabled: true }),
      reportPost: jest.fn().mockResolvedValue({ success: true }),
      getPostMenu: jest.fn().mockResolvedValue({ menuActions: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SnippetsController],
      providers: [
        {
          provide: PostsService,
          useValue: postsService,
        },
      ],
    }).compile();

    controller = module.get<SnippetsController>(SnippetsController);
  });

  it('POST /v1/snippets publishes a snippet', async () => {
    const res = await controller.createSnippet(mockUserReq, {
      quote: 'أحياناً نصمت لأننا نعرف كلامنا لن يغير شيئاً',
      bookId: 'book-uuid-1',
    });
    expect(postsService.createSnippet).toHaveBeenCalledWith('user-uuid-1', {
      quote: 'أحياناً نصمت لأننا نعرف كلامنا لن يغير شيئاً',
      bookId: 'book-uuid-1',
    });
    expect(res.data.type).toBe('snippet');
  });

  it('GET /v1/snippets returns paginated snippets feed', async () => {
    const res = await controller.getSnippets({ page: 1, limit: 10 }, mockUserReq);
    expect(postsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'snippet', page: 1, limit: 10 }),
      'user-uuid-1',
    );
    expect(res.data[0].type).toBe('snippet');
  });

  it('GET /v1/snippets/my returns current user snippets', async () => {
    const res = await controller.getMySnippets(mockUserReq, { page: 1, limit: 10 });
    expect(postsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'snippet', userId: 'user-uuid-1' }),
      'user-uuid-1',
    );
    expect(res.data).toBeDefined();
  });

  it('GET /v1/snippets/user/:userId returns snippets for user profile', async () => {
    const res = await controller.getUserSnippets('target-user-uuid', { page: 1, limit: 10 }, mockUserReq);
    expect(postsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'snippet', userId: 'target-user-uuid' }),
      'user-uuid-1',
    );
    expect(res.data).toBeDefined();
  });

  it('GET /v1/snippets/:id returns a single snippet', async () => {
    const res = await controller.getSnippetById('snippet-uuid-1', mockUserReq);
    expect(postsService.findOne).toHaveBeenCalledWith('snippet-uuid-1', 'user-uuid-1');
    expect(res.id).toBe('snippet-uuid-1');
  });

  it('POST /v1/snippets/:id/react reacts to snippet', async () => {
    const res = await controller.reactToSnippet(mockUserReq, 'snippet-uuid-1', { reaction: 'agree' as any });
    expect(postsService.reactToPost).toHaveBeenCalledWith('user-uuid-1', 'snippet-uuid-1', 'agree');
    expect(res.success).toBe(true);
  });

  it('DELETE /v1/snippets/:id removes snippet', async () => {
    const res = await controller.deleteSnippet(mockUserReq, 'snippet-uuid-1');
    expect(postsService.remove).toHaveBeenCalledWith('snippet-uuid-1', 'user-uuid-1', false, 'post');
    expect(res.success).toBe(true);
  });
});

