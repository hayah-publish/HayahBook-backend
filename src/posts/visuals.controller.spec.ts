import { Test, TestingModule } from '@nestjs/testing';
import { VisualsController } from './visuals.controller';
import { PostsService } from './posts.service';

describe('VisualsController', () => {
  let controller: VisualsController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;

  const mockVisualData = {
    id: 'visual-uuid-1',
    type: 'visual',
    content: 'فيديو ممتع عن فن القراءة السريعة واستيعاب الأفكار',
    videoUrl: 'https://cdn.hayahbook.com/videos/speed-reading.mp4',
    containVideo: true,
    images: [],
    category: 'المرئيات',
    publisher: {
      id: 'user-uuid-1',
      name: 'Ahmed Murad',
      profileUrl: null,
      role: 'user',
    },
    reactionsCount: { total: 35, agree: 20, love: 10, applaud: 5, insightful: 0, disagree: 0 },
    commentsCount: 15,
    sharesCount: 8,
    bookmarksCount: 4,
    createdAt: new Date(),
    updatedAt: new Date(),
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
      findAll: jest.fn().mockResolvedValue({
        data: [mockVisualData],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      findOne: jest.fn().mockResolvedValue(mockVisualData),
      remove: jest.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
      reactToPost: jest.fn().mockResolvedValue({ success: true, reaction: 'love' }),
      removeReaction: jest.fn().mockResolvedValue({ success: true }),
      getPostReactions: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      sharePost: jest.fn().mockResolvedValue({ success: true, sharesCount: 9 }),
      toggleComments: jest.fn().mockResolvedValue({ success: true, commentsDisabled: true }),
      reportPost: jest.fn().mockResolvedValue({ success: true }),
      getPostMenu: jest.fn().mockResolvedValue({ menuActions: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisualsController],
      providers: [
        {
          provide: PostsService,
          useValue: postsService,
        },
      ],
    }).compile();

    controller = module.get<VisualsController>(VisualsController);
  });

  it('GET /v1/visuals returns paginated visual feed', async () => {
    const res = await controller.getVisuals({ page: 1, limit: 20 }, mockUserReq);
    expect(postsService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'visuals', page: 1, limit: 20 }),
      'user-uuid-1',
    );
    expect(res.data[0].containVideo).toBe(true);
  });

  it('GET /v1/visuals/:id returns single visual post', async () => {
    const res = await controller.getVisualById('visual-uuid-1', mockUserReq);
    expect(postsService.findOne).toHaveBeenCalledWith('visual-uuid-1', 'user-uuid-1');
    expect(res.id).toBe('visual-uuid-1');
  });

  it('POST /v1/visuals/:id/react reacts to visual', async () => {
    const res = await controller.reactToVisual(mockUserReq, 'visual-uuid-1', { reaction: 'love' as any });
    expect(postsService.reactToPost).toHaveBeenCalledWith('user-uuid-1', 'visual-uuid-1', 'love');
    expect(res.success).toBe(true);
  });

  it('DELETE /v1/visuals/:id/react removes reaction from visual', async () => {
    const res = await controller.removeVisualReaction(mockUserReq, 'visual-uuid-1');
    expect(postsService.removeReaction).toHaveBeenCalledWith('user-uuid-1', 'visual-uuid-1');
    expect(res.success).toBe(true);
  });

  it('GET /v1/visuals/:id/reacts gets reactions list for visual', async () => {
    const res = await controller.getVisualReactions(mockUserReq, 'visual-uuid-1', { page: 1, limit: 10 });
    expect(postsService.getPostReactions).toHaveBeenCalledWith('visual-uuid-1', { page: 1, limit: 10 }, 'user-uuid-1');
    expect(res.data).toBeDefined();
  });

  it('POST /v1/visuals/:id/share shares visual', async () => {
    const res = await controller.shareVisual('visual-uuid-1');
    expect(postsService.sharePost).toHaveBeenCalledWith('visual-uuid-1');
    expect(res.success).toBe(true);
  });

  it('DELETE /v1/visuals/:id deletes visual', async () => {
    const res = await controller.deleteVisual(mockUserReq, 'visual-uuid-1');
    expect(postsService.remove).toHaveBeenCalledWith('visual-uuid-1', 'user-uuid-1', false, 'post');
    expect(res.success).toBe(true);
  });
});
