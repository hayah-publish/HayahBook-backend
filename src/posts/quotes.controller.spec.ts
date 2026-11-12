import { Test, TestingModule } from '@nestjs/testing';
import { QuotesController } from './quotes.controller';
import { PostsService } from './posts.service';

describe('QuotesController', () => {
  let controller: QuotesController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;

  const mockQuoteData = {
    id: 'quote-uuid-1',
    type: 'snippet',
    content: 'أحياناً نصمت لأننا نعرف كلامنا لن يغير شيئاً',
    quote: 'أحياناً نصمت لأننا نعرف كلامنا لن يغير شيئاً',
    category: 'رومانسي',
    book: {
      id: 'book-uuid-1',
      title: 'عادات التعافي',
      author: 'محمود علي',
      coverUrl: 'https://cdn.hayahbook.com/books/covers/sample.jpg',
    },
    publisher: {
      id: 'user-uuid-1',
      name: 'Ahmed Murad',
      profileUrl: null,
      role: 'user',
    },
    reactionsCount: { total: 55, agree: 40, love: 10, applaud: 5, insightful: 0, disagree: 0 },
    commentsCount: 80,
    sharesCount: 22,
    bookmarksCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategories = {
    data: [
      { id: 'f1a2b3c4-d5e6-47f8-a9b0-c1d2e3f4a5b6', name: 'رومانسي', nameAr: 'رومانسي', nameEn: 'Romantic' },
      { id: 'a2b3c4d5-e6f7-48a9-b0c1-d2e3f4a5b6c7', name: 'نفسي', nameAr: 'نفسي', nameEn: 'Psychological' },
      { id: 'b3c4d5e6-f7a8-49b0-c1d2-e3f4a5b6c7d8', name: 'تحفيزي', nameAr: 'تحفيزي', nameEn: 'Motivation' },
      { id: 'c4d5e6f7-a8b9-40c1-d2e3-f4a5b6c7d8e9', name: 'حزين', nameAr: 'حزين', nameEn: 'Sadness' },
    ],
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
      getQuotesFeed: jest.fn().mockResolvedValue({
        categories: mockCategories.data,
        data: [mockQuoteData],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      getQuoteCategories: jest.fn().mockReturnValue(mockCategories),
      findOne: jest.fn().mockResolvedValue(mockQuoteData),
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
      controllers: [QuotesController],
      providers: [
        {
          provide: PostsService,
          useValue: postsService,
        },
      ],
    }).compile();

    controller = module.get<QuotesController>(QuotesController);
  });

  it('GET /v1/quotes returns paginated quotes feed with categories', async () => {
    const res = await controller.getQuotes({ page: 1, limit: 20 }, mockUserReq);
    expect(postsService.getQuotesFeed).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      'user-uuid-1',
    );
    expect(res.categories).toBeDefined();
    expect(res.categories.length).toBeGreaterThan(0);
    expect(res.data[0].type).toBe('snippet');
  });

  it('GET /v1/quotes with category filter returns filtered quotes', async () => {
    await controller.getQuotes({ page: 1, limit: 10, category: 'رومانسي' }, mockUserReq);
    expect(postsService.getQuotesFeed).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'رومانسي' }),
      'user-uuid-1',
    );
  });

  it('GET /v1/quotes/categories returns quote categories', async () => {
    const res = await controller.getQuoteCategories();
    expect(postsService.getQuoteCategories).toHaveBeenCalled();
    expect(res.data).toBeDefined();
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('GET /v1/quotes/:id returns a single quote', async () => {
    const res = await controller.getQuoteById('quote-uuid-1', mockUserReq);
    expect(postsService.findOne).toHaveBeenCalledWith('quote-uuid-1', 'user-uuid-1');
    expect(res.id).toBe('quote-uuid-1');
  });

  it('POST /v1/quotes/:id/react reacts to a quote', async () => {
    const res = await controller.reactToQuote(mockUserReq, 'quote-uuid-1', { reaction: 'agree' as any });
    expect(postsService.reactToPost).toHaveBeenCalledWith('user-uuid-1', 'quote-uuid-1', 'agree');
    expect(res.success).toBe(true);
  });

  it('DELETE /v1/quotes/:id/react removes reaction from a quote', async () => {
    const res = await controller.removeQuoteReaction(mockUserReq, 'quote-uuid-1');
    expect(postsService.removeReaction).toHaveBeenCalledWith('user-uuid-1', 'quote-uuid-1');
    expect(res.success).toBe(true);
  });

  it('POST /v1/quotes/:id/share shares a quote', async () => {
    const res = await controller.shareQuote('quote-uuid-1');
    expect(postsService.sharePost).toHaveBeenCalledWith('quote-uuid-1');
    expect(res.success).toBe(true);
  });

  it('DELETE /v1/quotes/:id removes a quote', async () => {
    const res = await controller.deleteQuote(mockUserReq, 'quote-uuid-1');
    expect(postsService.remove).toHaveBeenCalledWith('quote-uuid-1', 'user-uuid-1', false, 'post');
    expect(res.success).toBe(true);
  });
});

