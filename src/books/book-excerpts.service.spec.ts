import { NotFoundException } from '@nestjs/common';
import { BookExcerptsService } from './book-excerpts.service';

describe('BookExcerptsService - Private Book Excerpts & Highlights', () => {
  let service: BookExcerptsService;
  let mockExcerptRepo: any;
  let mockBookRepo: any;
  let mockI18n: any;

  const mockBook = {
    id: 'book-1',
    title: 'خلف الأبواب الموصدة',
    author: 'منى عبد الحليم',
    coverUrl: 'https://cdn.hayahbook.com/books/covers/cover-1.jpg',
    category: 'روايات',
  };

  const sampleExcerpt = {
    id: 'excerpt-1',
    userId: 'user-1',
    bookId: 'book-1',
    content: 'كان الصباح هادئاً بشكل غريب، كأنّ المدينة تحبس أنفاسها',
    note: 'حبيت الجملة دي اووي',
    chapter: 'الفصل الثالث',
    pageNumber: 42,
    cfiRange: 'epubcfi(/6/14[chap03]!/4/2/12/1:0)',
    createdAt: new Date('2026-11-12T00:00:00.000Z'),
    updatedAt: new Date('2026-11-12T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockExcerptRepo = {
      create: jest.fn((entity) => ({ id: 'new-id', ...entity, createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve({ id: 'saved-id', ...entity })),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(true),
      createQueryBuilder: jest.fn(),
    };

    mockBookRepo = {
      findOne: jest.fn().mockResolvedValue(mockBook),
    };

    mockI18n = {
      t: jest.fn((key: string) => {
        if (key === 'books.not_found') return 'الكتاب غير موجود';
        if (key === 'excerpts.created') return 'تم حفظ المقتطف بنجاح';
        if (key === 'excerpts.updated') return 'تم تعديل المقتطف بنجاح';
        if (key === 'excerpts.deleted') return 'تم حذف المقتطف بنجاح';
        if (key === 'excerpts.not_found') return 'المقتطف غير موجود';
        return key;
      }),
      getCurrentLanguage: jest.fn().mockReturnValue('ar'),
    };

    service = new BookExcerptsService(mockExcerptRepo, mockBookRepo, mockI18n);
  });

  describe('createExcerpt', () => {
    it('creates and saves an excerpt for the authenticated user and book', async () => {
      const res = await service.createExcerpt('user-1', 'book-1', {
        content: 'كان الصباح هادئاً بشكل غريب',
        note: 'ملاحظة شخصية',
        chapter: 'الفصل الثالث',
        pageNumber: 42,
      });

      expect(mockBookRepo.findOne).toHaveBeenCalledWith({ where: { id: 'book-1' } });
      expect(mockExcerptRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        bookId: 'book-1',
        content: 'كان الصباح هادئاً بشكل غريب',
        note: 'ملاحظة شخصية',
        chapter: 'الفصل الثالث',
        pageNumber: 42,
        cfiRange: null,
      });
      expect(mockExcerptRepo.save).toHaveBeenCalled();
      expect(res.message).toBe('تم حفظ المقتطف بنجاح');
      expect(res.data.content).toBe('كان الصباح هادئاً بشكل غريب');
    });

    it('throws NotFoundException if book does not exist', async () => {
      mockBookRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createExcerpt('user-1', 'invalid-book', {
          content: 'some text',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getExcerptsForBook', () => {
    it('returns paginated excerpts strictly belonging to the caller for that book', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[sampleExcerpt], 1]),
      };
      mockExcerptRepo.createQueryBuilder.mockReturnValue(qb);

      const res = await service.getExcerptsForBook('user-1', 'book-1', {
        page: 1,
        limit: 10,
        search: 'الصباح',
      });

      expect(mockBookRepo.findOne).toHaveBeenCalledWith({ where: { id: 'book-1' } });
      expect(qb.where).toHaveBeenCalledWith('excerpt.userId = :userId', { userId: 'user-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('excerpt.bookId = :bookId', { bookId: 'book-1' });
      expect(res.total).toBe(1);
      expect(res.book.title).toBe('خلف الأبواب الموصدة');
      expect(res.data[0].content).toContain('كان الصباح هادئاً');
    });
  });

  describe('getMyBooksWithExcerpts', () => {
    it('returns books with excerpt counts grouped per book for the caller', async () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getRawMany: jest.fn().mockResolvedValue([
          {
            bookId: 'book-1',
            title: 'خلف الأبواب الموصدة',
            author: 'منى عبد الحليم',
            coverUrl: 'https://cdn.hayahbook.com/books/covers/cover-1.jpg',
            category: 'روايات',
            excerptsCount: '5',
            latestExcerptAt: new Date('2026-11-12T00:00:00.000Z'),
          },
        ]),
      };
      mockExcerptRepo.createQueryBuilder.mockReturnValue(qb);

      const res = await service.getMyBooksWithExcerpts('user-1');
      expect(res.data.length).toBe(1);
      expect(res.data[0].excerptsCount).toBe(5);
      expect(res.data[0].title).toBe('خلف الأبواب الموصدة');
    });
  });

  describe('Strict Ownership and Security', () => {
    it('getExcerptById returns excerpt if owned by caller', async () => {
      mockExcerptRepo.findOne.mockResolvedValueOnce({ ...sampleExcerpt, book: mockBook });

      const res = await service.getExcerptById('user-1', 'excerpt-1');
      expect(res.id).toBe('excerpt-1');
      expect(res.content).toBe(sampleExcerpt.content);
      expect(res.book.title).toBe('خلف الأبواب الموصدة');
    });

    it('getExcerptById throws NotFoundException if another user attempts to read it', async () => {
      mockExcerptRepo.findOne.mockResolvedValueOnce(sampleExcerpt); // owned by user-1

      // user-2 tries to access user-1's excerpt
      await expect(service.getExcerptById('user-2', 'excerpt-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updateExcerpt updates content and note if caller is owner', async () => {
      const existing = { ...sampleExcerpt };
      mockExcerptRepo.findOne.mockResolvedValueOnce(existing);

      const res = await service.updateExcerpt('user-1', 'excerpt-1', {
        note: 'ملاحظة معدلة جديدة',
      });

      expect(mockExcerptRepo.save).toHaveBeenCalled();
      expect(res.message).toBe('تم تعديل المقتطف بنجاح');
      expect(existing.note).toBe('ملاحظة معدلة جديدة');
    });

    it('updateExcerpt throws NotFoundException if caller is not owner', async () => {
      mockExcerptRepo.findOne.mockResolvedValueOnce(sampleExcerpt);

      await expect(
        service.updateExcerpt('user-2', 'excerpt-1', { note: 'اختراق' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deleteExcerpt removes excerpt if caller is owner', async () => {
      mockExcerptRepo.findOne.mockResolvedValueOnce(sampleExcerpt);

      const res = await service.deleteExcerpt('user-1', 'excerpt-1');
      expect(mockExcerptRepo.remove).toHaveBeenCalledWith(sampleExcerpt);
      expect(res.success).toBe(true);
      expect(res.message).toBe('تم حذف المقتطف بنجاح');
    });

    it('deleteExcerpt throws NotFoundException if caller is not owner', async () => {
      mockExcerptRepo.findOne.mockResolvedValueOnce(sampleExcerpt);

      await expect(service.deleteExcerpt('user-2', 'excerpt-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
