import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { countWords, extractVisibleText } from './validators/word-count.validator';
import { sanitizeMarkdown } from './utils/markdown-sanitizer.util';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { PostsService } from './posts.service';

describe('Word Count Limits & Markdown Formatting (Articles 501-5000, Posts max 500)', () => {
  describe('extractVisibleText and countWords utility', () => {
    it('returns 0 for empty, null, or undefined', () => {
      expect(countWords('')).toBe(0);
      expect(countWords(null)).toBe(0);
      expect(countWords(undefined)).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(extractVisibleText('')).toBe('');
    });

    it('accurately counts English words', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('This is a test post for HayahBook platform.')).toBe(8);
      expect(countWords("Don't stop believing!")).toBe(3);
    });

    it('accurately counts Arabic words', () => {
      expect(countWords('هذا منشور تجريبي رائع')).toBe(4);
      expect(countWords('بسم الله الرحمن الرحيم')).toBe(4);
    });

    it('accurately handles Arabic text with diacritics (tashkeel)', () => {
      expect(countWords('كِتَابٌ قَيِّمٌ وَمُفِيدٌ جِدًّا')).toBe(4);
    });

    it('accurately handles HTML tags and entities', () => {
      expect(countWords('<p>هذا&nbsp;مقال&nbsp;تجريبي</p>')).toBe(3);
      expect(countWords('<div><p>فقرة أولى</p><br/><span>فقرة ثانية</span></div>')).toBe(4);
    });

    it('accurately handles irregular whitespace and newlines', () => {
      expect(countWords('كلمة1 \n\n كلمة2 \t\t كلمة3   كلمة4')).toBe(4);
    });

    it('excludes blockquote markers (> and >>) from visible word count', () => {
      const quote = '> الحكمة ضالة المؤمن حيثما وجدها فهو أحق بها';
      expect(countWords(quote)).toBe(8);

      const nestedQuote = '>> اقتباس متداخل مهم جداً';
      expect(countWords(nestedQuote)).toBe(4);
    });

    it('excludes bulleted list markers (-, *, +) from visible word count', () => {
      const list = '- العنصر الأول\n* العنصر الثاني\n+ العنصر الثالث';
      expect(countWords(list)).toBe(6);
    });

    it('excludes numbered list markers (1., 2.) from visible word count', () => {
      const numberedList = '1. الخطوة الأولى في القراءة\n2. الخطوة الثانية في الفهم';
      expect(countWords(numberedList)).toBe(8);
    });

    it('extracts visible title from hyperlinks and excludes url from word count', () => {
      const linkText = 'يرجى مراجعة [موقع كتاب الحياة](https://hayahbook.com/about) للمزيد من التفاصيل.';
      // Visible text: "يرجى مراجعة موقع كتاب الحياة للمزيد من التفاصيل." (8 words)
      expect(countWords(linkText)).toBe(8);
    });

    it('excludes standalone URLs from word count', () => {
      const text = 'زوروا https://hayahbook.com اليوم';
      // Visible text: "زوروا اليوم" (2 words)
      expect(countWords(text)).toBe(2);
    });

    it('ignores standalone symbols and separators (---, ***, >)', () => {
      expect(countWords('> --- *** > - .')).toBe(0);
    });

    it('handles backslash escaping for markdown syntax', () => {
      const escaped = '\\> هذا ليس اقتباساً بل سطر عادي';
      expect(countWords(escaped)).toBe(6);
    });
  });

  describe('Markdown Sanitizer', () => {
    it('removes unsafe <script> tags and preserves markdown', () => {
      const input = '<script>alert("xss")</script>> هذا اقتباس آمن';
      const sanitized = sanitizeMarkdown(input);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('> هذا اقتباس آمن');
    });

    it('removes unsafe <iframe>, <object>, and <style> tags', () => {
      const input = '<iframe src="evil.com"></iframe><style>body{color:red}</style>- عنصر قائمة';
      const sanitized = sanitizeMarkdown(input);
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).not.toContain('<style');
      expect(sanitized).toContain('- عنصر قائمة');
    });

    it('escapes raw HTML so inline event handlers cannot execute', () => {
      const input = '<img src="cover.jpg" onerror="alert(1)">';
      const sanitized = sanitizeMarkdown(input);
      expect(sanitized).toContain('&lt;img');
      expect(sanitized).toContain('onerror');
      expect(sanitized).not.toContain('<img');
    });

    it('neutralizes unsafe javascript: and data: links in markdown', () => {
      const input = '[اضغط هنا](javascript:alert(1)) و [رابط آمن](https://hayahbook.com)';
      const sanitized = sanitizeMarkdown(input);
      expect(sanitized).not.toContain('javascript:alert(1)');
      expect(sanitized).toContain('اضغط هنا');
      expect(sanitized).toContain('[رابط آمن](https://hayahbook.com)');
    });
  });

  describe('CreatePostDto validation', () => {
    it('allows post when content is missing (e.g. image-only post)', async () => {
      const dto = plainToInstance(CreatePostDto, {});
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });

    it('allows post when content is empty string', async () => {
      const dto = plainToInstance(CreatePostDto, { content: '' });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });

    it('rejects post when content has text but 0 words (e.g. only symbols or punctuation)', async () => {
      const dto = plainToInstance(CreatePostDto, { content: '... --- !!!' });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeDefined();
      expect(contentError?.constraints?.minWords).toBe('posts.min_words_required');
    });

    it('allows post with exactly 1 word', async () => {
      const dto = plainToInstance(CreatePostDto, { content: 'كلمة' });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });

    it('allows post with 500 words', async () => {
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

  describe('CreateArticleDto validation (501 - 5000 visible words)', () => {
    const validBaseArticle = {
      title: 'عنوان المقال',
      categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
      coverImageUrl: 'https://cdn.hayahbook.com/covers/article.jpg',
      agreeToTerms: true,
    };

    it('rejects article with less than 501 words (e.g. 10 words)', async () => {
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

    it('rejects article with exactly 500 words', async () => {
      const content = Array(500).fill('كلمة').join(' ');
      const dto = plainToInstance(CreateArticleDto, {
        ...validBaseArticle,
        content,
      });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeDefined();
      expect(contentError?.constraints?.minWords).toBe('articles.min_words_required');
    });

    it('allows article with exactly 501 words', async () => {
      const content = Array(501).fill('كلمة').join(' ');
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

    it('accurately validates 501 words with Markdown syntax (quotes, bullets, links)', async () => {
      // 500 prose words + 1 link with 1 visible word = 501 visible words
      const prose = Array(500).fill('كلمة').join(' ');
      const markdownContent = `> ${prose}\n\n- عنصر إضافي في [رابط](https://hayahbook.com/test)`;
      // prose (500) + 'عنصر' (1) + 'إضافي' (1) + 'في' (1) + 'رابط' (1) = 504 visible words
      const dto = plainToInstance(CreateArticleDto, {
        ...validBaseArticle,
        content: markdownContent,
      });
      const errors = await validate(dto);
      const contentError = errors.find((e) => e.property === 'content');
      expect(contentError).toBeUndefined();
    });
  });

  describe('PostsService business logic validation & formatting preservation', () => {
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
        create: jest.fn((entity) => ({
          ...entity,
          id: 'saved-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        save: jest.fn((entity) => Promise.resolve(entity)),
        findOne: jest.fn(),
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
          if (key === 'articles.min_words_required') return 'يجب ألا يقل محتوى المقال عن 501 كلمة';
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

    it('PostsService.createPost throws BadRequestException if post has text with 0 words', async () => {
      await expect(
        service.createPost('user-1', { content: '... --- !!!' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockI18nService.t).toHaveBeenCalledWith('posts.min_words_required');
    });

    it('PostsService.createArticle throws BadRequestException if article has 500 words', async () => {
      const content = Array(500).fill('كلمة').join(' ');
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

    it('PostsService.createArticle succeeds with 501 words and preserves Markdown formatting', async () => {
      const baseWords = Array(495).fill('كلمة').join(' ');
      const markdown = `> ${baseWords}\n\n- نقطة أولى\n- نقطة ثانية\n1. خطوة أولى\n\n[موقعنا](https://hayahbook.com)`;
      // 495 + 2 + 2 + 2 + 1 = 502 visible words

      const result = await service.createArticle('user-1', {
        title: 'مقال بالماركداون',
        content: markdown,
        categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
        coverImageUrl: 'https://cdn.hayahbook.com/covers/article.jpg',
        agreeToTerms: true,
      });

      expect(result.data).toBeDefined();
      expect(result.data.type).toBe('article');
      expect(result.data.contentFormat).toBe('markdown');
      // Verify formatting is preserved
      expect(result.data.content).toContain('> ');
      expect(result.data.content).toContain('- نقطة أولى');
      expect(result.data.content).toContain('1. خطوة أولى');
      expect(result.data.content).toContain('[موقعنا](https://hayahbook.com)');
    });

    it('PostsService.createArticle sanitizes unsafe scripts and links while preserving markdown', async () => {
      const baseWords = Array(500).fill('كلمة').join(' ');
      const maliciousMarkdown = `<script>alert("xss")</script>\n> ${baseWords}\n\n[اضغط هنا](javascript:alert(1))`;

      const result = await service.createArticle('user-1', {
        title: 'مقال مع كود خبيث',
        content: maliciousMarkdown,
        categoryId: '1a31fd07-744e-4896-b787-b1d4c96ea222',
        coverImageUrl: 'https://cdn.hayahbook.com/covers/article.jpg',
        agreeToTerms: true,
      });

      expect(result.data.content).not.toContain('<script>');
      expect(result.data.content).not.toContain('javascript:alert(1)');
      expect(result.data.content).toContain('اضغط هنا');
      expect(result.data.content).toContain('> ');
    });

    it('PostsService.updatePost preserves formatting and enforces 501-5000 word limits for articles', async () => {
      const articlePost: any = {
        id: 'article-1',
        userId: 'user-1',
        type: 'article',
        title: 'مقال قديم',
        content: Array(600).fill('كلمة').join(' '),
        images: [],
        videoUrl: null,
        linkUrl: null,
        linkTitle: null,
        mentions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPostRepo.findOne.mockResolvedValue(articlePost);

      // 1. Updating with less than 501 words throws
      const tooShort = Array(500).fill('كلمة').join(' ');
      await expect(
        service.updatePost('article-1', 'user-1', { content: tooShort }),
      ).rejects.toThrow(BadRequestException);

      // 2. Updating with 501 words with Markdown succeeds and preserves formatting
      const newMarkdown = `> ${Array(498).fill('كلمة').join(' ')}\n\n- عنصر جديد\n[رابط](https://hayahbook.com)`;
      const updated = await service.updatePost('article-1', 'user-1', { content: newMarkdown });
      expect(updated.data.content).toContain('> ');
      expect(updated.data.content).toContain('- عنصر جديد');
      expect(updated.data.contentFormat).toBe('markdown');
    });
  });
});
