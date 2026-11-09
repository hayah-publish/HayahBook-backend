import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { countWords } from './validators/word-count.validator';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { PostsService } from './posts.service';

describe('Word Count Limits - Posts (max 500) and Articles (500 - 5000)', () => {
  describe('countWords utility', () => {
    it('returns 0 for empty, null, or undefined', () => {
      expect(countWords('')).toBe(0);
      expect(countWords(null)).toBe(0);
      expect(countWords(undefined)).toBe(0);
      expect(countWords('   ')).toBe(0);
    });

    it('accurately counts English words', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('This is a test post for HayahBook platform.')).toBe(8);
    });

    it('accurately counts Arabic words', () => {
      expect(countWords('هذا منشور تجريبي رائع')).toBe(4);
      expect(countWords('بسم الله الرحمن الرحيم')).toBe(4);
    });

    it('accurately handles HTML tags and entities', () => {
      expect(countWords('<p>هذا&nbsp;مقال&nbsp;تجريبي</p>')).toBe(3);
      expect(countWords('<div><p>فقرة أولى</p><br/><span>فقرة ثانية</span></div>')).toBe(4);
    });

    it('accurately handles irregular whitespace and newlines', () => {
      expect(countWords('كلمة1 \n\n كلمة2 \t\t كلمة3   كلمة4')).toBe(4);
    });
  });

  describe('CreatePostDto validation', () => {
    it('allows post when content is missing (e.g. image-only post)', async () => {
      const dto = plainToInstance(CreatePostDto, {});
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });

    it('allows post with 500 words or less', async () => {
      const content = Array(500).fill('كلمة').join(' ');
      const dto = plainToInstance(CreatePostDto, { content });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });

    it('rejects post with more than 500 words (501 words)', async () => {
      const content = Array(501).fill('كلمة').join(' ');
      const dto = plainToInstance(CreatePostDto, { content });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeDefined();
      expect(contentError?.constraints?.maxWords).toBe('posts.max_words_exceeded');
    });
  });

  describe('CreateArticleDto validation', () => {
    const validBaseArticle = {
      title: 'عنوان المقال',
      categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
      coverImageUrl: 'https://cdn.hayahbook.com/covers/article.jpg',
      agreeToTerms: true,
    };

    it('rejects article with less than 500 words (e.g. 10 words)', async () => {
      const content = Array(10).fill('كلمة').join(' ');
      const dto = plainToInstance(CreateArticleDto, {
        ...validBaseArticle,
        content,
      });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeDefined();
      expect(contentError?.constraints?.minWords).toBe('articles.min_words_required');
    });

    it('rejects article with 499 words', async () => {
      const content = Array(499).fill('كلمة').join(' ');
      const dto = plainToInstance(CreateArticleDto, {
        ...validBaseArticle,
        content,
      });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeDefined();
      expect(contentError?.constraints?.minWords).toBe('articles.min_words_required');
    });

    it('allows article with exactly 500 words', async () => {
      const content = Array(500).fill('كلمة').join(' ');
      const dto = plainToInstance(CreateArticleDto, {
        ...validBaseArticle,
        content,
      });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });

    it('allows article with 5000 words', async () => {
      const content = Array(5000).fill('كلمة').join(' ');
      const dto = plainToInstance(CreateArticleDto, {
        ...validBaseArticle,
        content,
      });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });

    it('rejects article with more than 5000 words (5001 words)', async () => {
      const content = Array(5001).fill('كلمة').join(' ');
      const dto = plainToInstance(CreateArticleDto, {
        ...validBaseArticle,
        content,
      });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeDefined();
      expect(contentError?.constraints?.maxWords).toBe('articles.max_words_exceeded');
    });
  });

  describe('PostsService business logic validation', () => {
    let service: PostsService;
    let mockPostRepo: any;
    let mockReactionRepo: any;
    let mockUserRepo: any;
    let mockFollowRepo: any;
    let mockBookRepo: any;
    let mockAudiobookRepo: any;
    let mockI18nService: any;
    let mockUploadService: any;
    let mockInterestsService: any;
    let mockDataSource: any;

    beforeEach(() => {
      mockPostRepo = {
        create: jest.fn((entity) => entity),
        save: jest.fn((entity) => Promise.resolve({ id: 'saved-id', ...entity, createdAt: new Date(), updatedAt: new Date() })),
      };
      mockReactionRepo = {};
      mockUserRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'user-1', name: 'أحمد', profileUrl: null, role: 'user' }),
      };
      mockFollowRepo = {};
      mockBookRepo = {};
      mockAudiobookRepo = {};
      mockI18nService = {
        t: jest.fn((key: string) => {
          if (key === 'posts.max_words_exceeded') return 'يجب ألا يتجاوز محتوى المنشور 500 كلمة';
          if (key === 'articles.min_words_required') return 'يجب ألا يقل محتوى المقال عن 500 كلمة';
          if (key === 'articles.max_words_exceeded') return 'يجب ألا يتجاوز محتوى المقال 5000 كلمة';
          return key;
        }),
      };
      mockUploadService = {
        uploadMedia: jest.fn(),
      };
      mockInterestsService = {
        getArticleCategories: jest.fn().mockResolvedValue([
          { id: '1a31fd07-744e-4896-b787-b1d4c96ea222', name_ar: 'تطوير الذات', name_en: 'Self development' },
        ]),
      };
      mockDataSource = {
        createQueryRunner: jest.fn(),
      };

      service = new PostsService(
        mockPostRepo,
        mockUserRepo,
        mockBookRepo,
        mockAudiobookRepo,
        mockUploadService,
        mockI18nService,
        mockInterestsService,
        mockFollowRepo,
        mockDataSource,
        mockReactionRepo,
      );
    });

    it('PostsService.createPost throws BadRequestException if post exceeds 500 words', async () => {
      const content = Array(501).fill('كلمة').join(' ');
      await expect(
        service.createPost('user-1', { content }),
      ).rejects.toThrow(BadRequestException);
      expect(mockI18nService.t).toHaveBeenCalledWith('posts.max_words_exceeded');
    });

    it('PostsService.createArticle throws BadRequestException if article has less than 500 words', async () => {
      const content = Array(499).fill('كلمة').join(' ');
      await expect(
        service.createArticle('user-1', {
          title: 'عنوان المقال',
          content,
          categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
          coverImageUrl: 'https://cdn.hayahbook.com/covers/article.jpg',
          agreeToTerms: true,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockI18nService.t).toHaveBeenCalledWith('articles.min_words_required');
    });

    it('PostsService.createArticle throws BadRequestException if article exceeds 5000 words', async () => {
      const content = Array(5001).fill('كلمة').join(' ');
      await expect(
        service.createArticle('user-1', {
          title: 'عنوان المقال',
          content,
          categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
          coverImageUrl: 'https://cdn.hayahbook.com/covers/article.jpg',
          agreeToTerms: true,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockI18nService.t).toHaveBeenCalledWith('articles.max_words_exceeded');
    });

    it('PostsService.createArticle succeeds with content between 500 and 5000 words', async () => {
      const content = Array(550).fill('كلمة').join(' ');
      const result = await service.createArticle('user-1', {
        title: 'عنوان المقال التجريبي',
        content,
        categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
        coverImageUrl: 'https://cdn.hayahbook.com/covers/article.jpg',
        agreeToTerms: true,
      });
      expect(result.data).toBeDefined();
      expect(result.data.type).toBe('article');
    });
  });
});
