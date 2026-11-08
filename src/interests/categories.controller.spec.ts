import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { InterestsService } from './interests.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: Partial<Record<keyof InterestsService, jest.Mock>>;

  const mockArticleCategories = [
    {
      id: 'uuid-1',
      displayName: 'احداث حالية',
      name_ar: 'احداث حالية',
      name_en: 'Current events',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-2',
      displayName: 'تاريخ وتراث',
      name_ar: 'تاريخ وتراث',
      name_en: 'History and heritage',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-3',
      displayName: 'ثقافة وفنون',
      name_ar: 'ثقافة وفنون',
      name_en: 'Culture and arts',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-4',
      displayName: 'معرفة وتعليم',
      name_ar: 'معرفة وتعليم',
      name_en: 'Knowledge and education',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-5',
      displayName: 'أعمال ومهارات',
      name_ar: 'أعمال ومهارات',
      name_en: 'Business and skills',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-6',
      displayName: 'تطوير الذات',
      name_ar: 'تطوير الذات',
      name_en: 'Self development',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-7',
      displayName: 'مجتمع وحياة',
      name_ar: 'مجتمع وحياة',
      name_en: 'Society and life',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-8',
      displayName: 'مقالات حرة',
      name_ar: 'مقالات حرة',
      name_en: 'Free articles',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
    {
      id: 'uuid-9',
      displayName: 'سفر وأماكن',
      name_ar: 'سفر وأماكن',
      name_en: 'Travel and places',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    },
  ];

  beforeEach(async () => {
    service = {
      getArticleCategories: jest.fn().mockResolvedValue(mockArticleCategories),
      findAll: jest.fn().mockImplementation(async (opts) => {
        if (opts?.category === 'articles') return mockArticleCategories;
        return mockArticleCategories;
      }),
      getCategoriesSummary: jest.fn().mockResolvedValue([
        {
          key: 'articles',
          displayName: 'المقالات',
          name_ar: 'المقالات',
          name_en: 'Articles',
          count: 9,
          items: mockArticleCategories,
        },
      ]),
      saveSingleCategory: jest.fn().mockResolvedValue({
        success: true,
        message: 'تم حفظ الفئة بنجاح',
        data: mockArticleCategories[5],
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        {
          provide: InterestsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  it('getArticleCategories returns the 9 article categories matching exact design', async () => {
    const result = await controller.getArticleCategories();
    expect(result).toHaveLength(9);
    expect(result[0]).toMatchObject({
      displayName: 'احداث حالية',
      name_ar: 'احداث حالية',
      name_en: 'Current events',
      category: 'المقالات',
      category_ar: 'المقالات',
      category_en: 'Articles',
    });
    expect(result[7]).toMatchObject({
      displayName: 'مقالات حرة',
      name_ar: 'مقالات حرة',
      name_en: 'Free articles',
    });
    expect(service.getArticleCategories).toHaveBeenCalled();
  });

  it('getCategories with ?type=article delegates to findAll with category filter', async () => {
    const result = await controller.getCategories('article', undefined);
    expect(service.findAll).toHaveBeenCalledWith({ category: 'article' });
    expect(result).toHaveLength(9);
  });

  it('getCategories without query returns categories summary', async () => {
    const result = await controller.getCategories(undefined, undefined);
    expect(service.getCategoriesSummary).toHaveBeenCalled();
    expect(result[0].key).toBe('articles');
  });

  it('getByCategory delegates to findAll with path parameter', async () => {
    await controller.getByCategory('articles');
    expect(service.findAll).toHaveBeenCalledWith({ category: 'articles' });
  });

  it('saveCategory saves selection for authenticated user', async () => {
    const req: any = { user: { userId: 'user-uuid' } };
    const res = await controller.saveCategory(req, { categoryId: 'uuid-6' });
    expect(service.saveSingleCategory).toHaveBeenCalledWith('user-uuid', 'uuid-6');
    expect(res.success).toBe(true);
    expect(res.data.name_ar).toBe('تطوير الذات');
  });
});

