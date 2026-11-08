import { Test, TestingModule } from '@nestjs/testing';
import { ArticlesController } from './articles.controller';
import { PostsService } from './posts.service';
import { InterestsService } from '../interests/interests.service';
import { BadRequestException } from '@nestjs/common';

describe('ArticlesController', () => {
  let controller: ArticlesController;
  let postsService: Partial<Record<keyof PostsService, jest.Mock>>;
  let interestsService: Partial<Record<keyof InterestsService, jest.Mock>>;

  const mockCategories = [
    {
      id: '9ad36706-9991-4fc0-a66e-c65c034acf71',
      displayName: 'Current events',
      name_ar: 'احداث حالية',
      name_en: 'Current events',
      category: 'Articles',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: '1a31fd07-744e-4896-b787-b1d4c96ea222',
      displayName: 'Self development',
      name_ar: 'تطوير الذات',
      name_en: 'Self development',
      category: 'Articles',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
  ];

  const mockArticleResponse = {
    message: 'تم نشر المقال بنجاح',
    data: {
      id: 'article-uuid-1',
      type: 'article',
      title: 'قوة العادات وكيف تغير حياتك',
      coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/user1_cover.jpg',
      category: 'تطوير الذات',
      categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
      content: 'نص المقال الكامل...',
      cleanContent: 'نص المقال الكامل...',
      htmlContent: '<p>نص المقال الكامل...</p>',
      images: [],
      videoUrl: null,
      link: null,
      links: [],
      book: null,
      publisher: {
        id: 'user-1',
        name: 'أحمد',
        profileUrl: null,
        role: 'user',
      },
      mentions: [],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(async () => {
    postsService = {
      createArticle: jest.fn().mockImplementation((userId, dto, files) => {
        if (!dto.agreeToTerms) throw new BadRequestException('يجب الموافقة على الشروط والخصوصية لمجتمع Hayahbook');
        if (!dto.title) throw new BadRequestException('عنوان المقال مطلوب');
        if (!dto.content) throw new BadRequestException('نص المقال مطلوب');
        if (!dto.category && !dto.categoryId) throw new BadRequestException('تصنيف المقال مطلوب');
        if (!dto.coverImageUrl && (!files || files.length === 0)) {
          throw new BadRequestException('الصورة الرئيسية للمقال مطلوبة');
        }
        return Promise.resolve(mockArticleResponse);
      }),
      findAll: jest.fn().mockResolvedValue({
        data: [mockArticleResponse.data],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      }),
      findOne: jest.fn().mockResolvedValue(mockArticleResponse.data),
      remove: jest.fn().mockResolvedValue({ message: 'تم حذف المقال بنجاح' }),
    };

    interestsService = {
      getArticleCategories: jest.fn().mockResolvedValue(mockCategories),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        {
          provide: PostsService,
          useValue: postsService,
        },
        {
          provide: InterestsService,
          useValue: interestsService,
        },
      ],
    }).compile();

    controller = module.get<ArticlesController>(ArticlesController);
  });

  it('GET /v1/articles/categories returns article categories', async () => {
    const result = await controller.getCategories();
    expect(result).toHaveLength(2);
    expect(result[0].name_en).toBe('Current events');
    expect(interestsService.getArticleCategories).toHaveBeenCalled();
  });

  it('POST /v1/articles creates article successfully when all mandatory fields are provided', async () => {
    const req: any = { user: { userId: 'user-1', role: 'user' } };
    const dto: any = {
      title: 'قوة العادات وكيف تغير حياتك',
      content: 'نص المقال الكامل...',
      category: 'تطوير الذات',
      categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
      coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/user1_cover.jpg',
      agreeToTerms: true,
    };

    const result = await controller.createArticle(req, dto);
    expect(result.message).toBe('تم نشر المقال بنجاح');
    expect(result.data.title).toBe('قوة العادات وكيف تغير حياتك');
    expect(result.data.coverImageUrl).toBeTruthy();
    expect(result.data.category).toBe('تطوير الذات');
    expect(result.data.content).toBe('نص المقال الكامل...');
  });

  it('POST /v1/articles fails if agreeToTerms is missing or false', async () => {
    const req: any = { user: { userId: 'user-1', role: 'user' } };
    const dto: any = {
      title: 'قوة العادات',
      content: 'نص المقال...',
      category: 'تطوير الذات',
      coverImageUrl: 'https://cdn.hayahbook.com/articles/covers/user1_cover.jpg',
      agreeToTerms: false,
    };

    await expect(controller.createArticle(req, dto)).rejects.toThrow(BadRequestException);
  });

  it('POST /v1/articles fails if title is missing', async () => {
    const req: any = { user: { userId: 'user-1', role: 'user' } };
    const dto: any = {
      agreeToTerms: true,
      title: '',
      content: 'نص المقال...',
      category: 'تطوير الذات',
      coverImageUrl: 'https://example.com/cover.jpg',
    };

    await expect(controller.createArticle(req, dto)).rejects.toThrow(BadRequestException);
  });

  it('POST /v1/articles fails if cover image is missing', async () => {
    const req: any = { user: { userId: 'user-1', role: 'user' } };
    const dto: any = {
      agreeToTerms: true,
      title: 'عنوان المقال',
      content: 'نص المقال...',
      category: 'تطوير الذات',
    };

    await expect(controller.createArticle(req, dto, [])).rejects.toThrow(BadRequestException);
  });

  it('POST /v1/articles fails if category is missing', async () => {
    const req: any = { user: { userId: 'user-1', role: 'user' } };
    const dto: any = {
      agreeToTerms: true,
      title: 'عنوان المقال',
      content: 'نص المقال...',
      coverImageUrl: 'https://example.com/cover.jpg',
    };

    await expect(controller.createArticle(req, dto)).rejects.toThrow(BadRequestException);
  });

  it('POST /v1/articles fails if content is missing', async () => {
    const req: any = { user: { userId: 'user-1', role: 'user' } };
    const dto: any = {
      agreeToTerms: true,
      title: 'عنوان المقال',
      content: '',
      category: 'تطوير الذات',
      coverImageUrl: 'https://example.com/cover.jpg',
    };

    await expect(controller.createArticle(req, dto)).rejects.toThrow(BadRequestException);
  });

  it('GET /v1/articles filters posts by type=article', async () => {
    const res = await controller.getArticles({ page: 1, limit: 10 });
    expect(postsService.findAll).toHaveBeenCalledWith({ page: 1, limit: 10, type: 'article' });
    expect(res.data).toHaveLength(1);
    expect(res.data[0].type).toBe('article');
  });

  it('GET /v1/articles/:id returns single article', async () => {
    const res = await controller.getArticleById('article-uuid-1');
    expect(postsService.findOne).toHaveBeenCalledWith('article-uuid-1');
    expect(res.id).toBe('article-uuid-1');
  });

  it('DELETE /v1/articles/:id deletes article', async () => {
    const req: any = { user: { userId: 'user-1', role: 'user' } };
    const res = await controller.deleteArticle(req, 'article-uuid-1');
    expect(postsService.remove).toHaveBeenCalledWith('article-uuid-1', 'user-1', false);
    expect(res.message).toBe('تم حذف المقال بنجاح');
  });
});

