import { Test, TestingModule } from '@nestjs/testing';
import { ReelsController } from './reels.controller';
import { PostsService } from './posts.service';

describe('ReelsController', () => {
  let controller: ReelsController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;

  const mockReel = {
    id: 'reel-uuid-1',
    type: 'visual',
    content: 'جولة سريعة في أعماق المكتبة التراثية',
    videoUrl: 'https://cdn.hayahbook.com/reels/library-tour.mp4',
    aspectRatio: '9:16',
    publisher: {
      id: 'author-uuid-1',
      name: 'Sara Ahmed',
      profileUrl: 'https://cdn.hayahbook.com/avatars/sara.jpg',
      role: 'author',
      isVerified: true,
    },
    socialProof: {
      text: 'Followed by Ahmed Murad and 4 others',
      count: 5,
      followers: [{ id: 'friend-1', name: 'Ahmed Murad', profileUrl: null }],
    },
    reactionsCount: { total: 12000, agree: 8000, love: 3500, applaud: 500, insightful: 0, disagree: 0 },
    commentsCount: 80,
    sharesCount: 22,
    bookmarksCount: 45,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserReq = {
    user: {
      userId: 'user-uuid-1',
      email: 'reader@example.com',
      role: 'user',
    },
  } as any;

  beforeEach(async () => {
    postsService = {
      getReelsFeed: jest.fn().mockResolvedValue({
        data: [mockReel],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      createVisual: jest.fn().mockResolvedValue({
        message: 'تم نشر الريلز بنجاح',
        data: mockReel,
      }),
      findOne: jest.fn().mockResolvedValue(mockReel),
      getPostMenu: jest.fn().mockResolvedValue({ menuActions: [] }),
      reactToPost: jest.fn().mockResolvedValue({ success: true, reaction: 'love' }),
      removeReaction: jest.fn().mockResolvedValue({ success: true }),
      getPostReactions: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      sharePost: jest.fn().mockResolvedValue({ success: true, sharesCount: 23 }),
      toggleComments: jest.fn().mockResolvedValue({ success: true, commentsDisabled: false }),
      reportPost: jest.fn().mockResolvedValue({ success: true }),
      remove: jest.fn().mockResolvedValue({ success: true, message: 'Deleted' }),
      getBookReels: jest.fn().mockResolvedValue({
        book: { id: 'book-uuid-1', title: 'الجلاد تحت جلدي' },
        reels: [mockReel],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReelsController],
      providers: [
        {
          provide: PostsService,
          useValue: postsService,
        },
      ],
    }).compile();

    controller = module.get<ReelsController>(ReelsController);
  });

  it('GET /v1/reels returns smart reels feed with social proof', async () => {
    const res = await controller.getReels({ page: 1, limit: 10 }, mockUserReq);
    expect(postsService.getReelsFeed).toHaveBeenCalledWith(
      { page: 1, limit: 10 },
      'user-uuid-1',
    );
    expect(res.data[0].type).toBe('visual');
    expect(res.data[0].socialProof?.text).toContain('Followed by Ahmed Murad');
  });

  it('POST /v1/reels creates a new reel', async () => {
    const dto = {
      content: 'جولة سريعة في أعماق المكتبة التراثية',
      aspectRatio: '9:16',
      videoUrl: 'https://cdn.hayahbook.com/reels/library-tour.mp4',
    };
    const res = await controller.createReel(mockUserReq, dto as any);
    expect(postsService.createVisual).toHaveBeenCalledWith('user-uuid-1', dto, undefined);
    expect(res.data.id).toBe('reel-uuid-1');
  });

  it('GET /v1/reels/:id gets single reel', async () => {
    const res = await controller.getReelById('reel-uuid-1', mockUserReq);
    expect(postsService.findOne).toHaveBeenCalledWith('reel-uuid-1', 'user-uuid-1');
    expect(res.id).toBe('reel-uuid-1');
  });

  it('POST /v1/reels/:id/react adds reaction', async () => {
    const res = await controller.reactToReel(mockUserReq, 'reel-uuid-1', { reaction: 'love' as any });
    expect(postsService.reactToPost).toHaveBeenCalledWith('user-uuid-1', 'reel-uuid-1', 'love');
    expect(res.success).toBe(true);
  });

  it('DELETE /v1/reels/:id/react removes reaction', async () => {
    const res = await controller.removeReelReaction(mockUserReq, 'reel-uuid-1');
    expect(postsService.removeReaction).toHaveBeenCalledWith('user-uuid-1', 'reel-uuid-1');
    expect(res.success).toBe(true);
  });

  it('POST /v1/reels/:id/share shares reel', async () => {
    const res = await controller.shareReel('reel-uuid-1');
    expect(postsService.sharePost).toHaveBeenCalledWith('reel-uuid-1');
    expect(res.success).toBe(true);
  });

  it('PATCH /v1/reels/:id/toggle-comments toggles comments', async () => {
    const res = await controller.toggleComments(mockUserReq, 'reel-uuid-1', false);
    expect(postsService.toggleComments).toHaveBeenCalledWith('reel-uuid-1', 'user-uuid-1', false, false);
    expect(res.success).toBe(true);
  });

  it('DELETE /v1/reels/:id deletes reel', async () => {
    const res = await controller.deleteReel(mockUserReq, 'reel-uuid-1');
    expect(postsService.remove).toHaveBeenCalledWith('reel-uuid-1', 'user-uuid-1', false, 'post');
    expect(res.success).toBe(true);
  });

  it('GET /v1/reels/book/:bookId returns book details and attached reels', async () => {
    const res = await controller.getBookReels('book-uuid-1', { sort: 'top' }, mockUserReq);
    expect(postsService.getBookReels).toHaveBeenCalledWith('book-uuid-1', { sort: 'top' }, 'user-uuid-1');
    expect(res.book.title).toBe('الجلاد تحت جلدي');
    expect(res.reels).toHaveLength(1);
  });
});

