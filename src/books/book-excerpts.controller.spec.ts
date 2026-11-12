import { Test, TestingModule } from '@nestjs/testing';
import {
  BookExcerptsController,
  DirectExcerptsController,
} from './book-excerpts.controller';
import { BookExcerptsService } from './book-excerpts.service';
import { PostsService } from '../posts/posts.service';

describe('BookExcerptsController & DirectExcerptsController', () => {
  let controller: BookExcerptsController;
  let directController: DirectExcerptsController;

  const mockService = {
    createExcerpt: jest.fn().mockResolvedValue({
      message: 'تم حفظ المقتطف بنجاح',
      data: { id: 'excerpt-1', content: 'نص مقتطف تجريبي' },
    }),
    getExcerptsForBook: jest.fn().mockResolvedValue({
      book: { id: 'book-1', title: 'خلف الأبواب الموصدة' },
      data: [{ id: 'excerpt-1', content: 'نص مقتطف تجريبي' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    }),
    getMyBooksWithExcerpts: jest.fn().mockResolvedValue({
      data: [
        {
          bookId: 'book-1',
          title: 'خلف الأبواب الموصدة',
          excerptsCount: 5,
        },
      ],
      total: 1,
    }),
    getExcerptById: jest.fn().mockResolvedValue({
      id: 'excerpt-1',
      content: 'نص مقتطف تجريبي',
      book: { id: 'book-1', title: 'خلف الأبواب الموصدة' },
    }),
    updateExcerpt: jest.fn().mockResolvedValue({
      message: 'تم تعديل المقتطف بنجاح',
      data: { id: 'excerpt-1', note: 'ملاحظة جديدة' },
    }),
    deleteExcerpt: jest.fn().mockResolvedValue({
      message: 'تم حذف المقتطف بنجاح',
      success: true,
    }),
  };

  const mockPostsService = {
    createSnippet: jest.fn().mockResolvedValue({
      message: 'تم نشر المقتطف في ملفك الشخصي بنجاح',
      data: { id: 'post-1', type: 'snippet', content: 'نص مقتطف' },
    }),
  };

  const req = { user: { userId: 'user-1', email: 'test@example.com', role: 'user' } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookExcerptsController, DirectExcerptsController],
      providers: [
        {
          provide: BookExcerptsService,
          useValue: mockService,
        },
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    controller = module.get<BookExcerptsController>(BookExcerptsController);
    directController = module.get<DirectExcerptsController>(DirectExcerptsController);
  });

  describe('BookExcerptsController', () => {
    it('creates an excerpt for a book', async () => {
      const res = await controller.createExcerpt(req, '1f71559f-4980-4b02-be6a-24c4ea3d7ea0', {
        content: 'نص مقتطف',
      });
      expect(res.data).toBeDefined();
      expect(mockService.createExcerpt).toHaveBeenCalledWith(
        'user-1',
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { content: 'نص مقتطف' },
      );
    });

    it('gets excerpts for a book', async () => {
      const res = await controller.getExcerptsForBook(
        req,
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { page: 1, limit: 10 },
      );
      expect(res.data).toBeDefined();
      expect(mockService.getExcerptsForBook).toHaveBeenCalledWith(
        'user-1',
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { page: 1, limit: 10 },
      );
    });

    it('gets my books with excerpts', async () => {
      const res = await controller.getMyBooksWithExcerpts(req, 'خلف', '1', '10');
      expect(res.data).toBeDefined();
      expect(mockService.getMyBooksWithExcerpts).toHaveBeenCalledWith('user-1', {
        search: 'خلف',
        page: 1,
        limit: 10,
      });
    });

    it('gets excerpt by id', async () => {
      const res = await controller.getExcerptById(req, '1f71559f-4980-4b02-be6a-24c4ea3d7ea0');
      expect(res.data).toBeDefined();
      expect(mockService.getExcerptById).toHaveBeenCalledWith(
        'user-1',
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
      );
    });

    it('updates an excerpt', async () => {
      const res = await controller.updateExcerpt(
        req,
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { note: 'ملاحظة جديدة' },
      );
      expect(res.data).toBeDefined();
      expect(mockService.updateExcerpt).toHaveBeenCalledWith(
        'user-1',
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { note: 'ملاحظة جديدة' },
      );
    });

    it('deletes an excerpt', async () => {
      const res = await controller.deleteExcerpt(req, '1f71559f-4980-4b02-be6a-24c4ea3d7ea0');
      expect(res.success).toBe(true);
      expect(mockService.deleteExcerpt).toHaveBeenCalledWith(
        'user-1',
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
      );
    });

    it('shares an excerpt to user profile as a snippet', async () => {
      const res = await controller.shareExcerptToProfile(
        req,
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { content: 'ملاحظة شخصية' },
      );
      expect(res.data).toBeDefined();
      expect(mockPostsService.createSnippet).toHaveBeenCalledWith('user-1', {
        excerptId: '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        content: 'ملاحظة شخصية',
        showBookDetails: undefined,
      });
    });
  });

  describe('DirectExcerptsController', () => {
    it('direct controller handles getMyBooksWithExcerpts', async () => {
      const res = await directController.getMyBooksWithExcerpts(req);
      expect(res.data).toBeDefined();
    });

    it('direct controller handles shareExcerptToProfile', async () => {
      const res = await directController.shareExcerptToProfile(
        req,
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { content: 'تعليق مقتطف' },
      );
      expect(res.data).toBeDefined();
    });

    it('direct controller handles getExcerptById', async () => {
      const res = await directController.getExcerptById(req, '1f71559f-4980-4b02-be6a-24c4ea3d7ea0');
      expect(res.data).toBeDefined();
    });

    it('direct controller handles updateExcerpt', async () => {
      const res = await directController.updateExcerpt(
        req,
        '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        { note: 'ملاحظة محدثة' },
      );
      expect(res.data).toBeDefined();
    });

    it('direct controller handles deleteExcerpt', async () => {
      const res = await directController.deleteExcerpt(req, '1f71559f-4980-4b02-be6a-24c4ea3d7ea0');
      expect(res.success).toBe(true);
    });
  });
});
