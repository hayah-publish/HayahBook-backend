import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';

describe('PostsService public post formatting', () => {
  const service = Object.create(PostsService.prototype) as PostsService;

  it('does not include the publisher email in public responses', async () => {
    const post = {
      id: 'post-1',
      type: 'post',
      content: 'Hello',
      images: [],
      videoUrl: null,
      linkUrl: null,
      linkTitle: null,
      mentions: [],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'private@example.com',
        name: 'Person',
        profileUrl: null,
        role: 'user',
      },
      book: null,
      audiobook: null,
    } as any;

    const response = await (service as any).formatPost(post);

    expect(response.publisher).toEqual({
      id: 'user-1',
      name: 'Person',
      profileUrl: null,
      role: 'user',
    });
    expect(response.publisher).not.toHaveProperty('email');
  });

  describe('Inline links in post content', () => {
    it('formats markdown link [title](url) so the title appears in text and links array is populated', async () => {
      const post = {
        id: 'post-2',
        type: 'post',
        content: 'مرحباً بكم، يمكنكم زيارة [موقعنا الرسمي](https://hayahbook.com) لمزيد من التفاصيل.',
        images: [],
        videoUrl: null,
        linkUrl: null,
        linkTitle: null,
        mentions: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        user: { id: 'user-1', name: 'Person', profileUrl: null, role: 'user' },
        book: null,
        audiobook: null,
      } as any;

      const response = await (service as any).formatPost(post);

      // 1. content is returned as-is
      expect(response.content).toBe(post.content);

      // 2. cleanContent and htmlContent are omitted to unify with single editor model
      expect((response as any).cleanContent).toBeUndefined();
      expect((response as any).htmlContent).toBeUndefined();

      // 3. links array contains parsed link metadata
      expect(response.links).toHaveLength(1);
      expect(response.links[0]).toEqual({
        url: 'https://hayahbook.com',
        title: 'موقعنا الرسمي',
        displayText: 'موقعنا الرسمي',
        startIndex: 25,
        endIndex: 38,
      });

      // 4. Primary link object is populated
      expect(response.link).toEqual({
        url: 'https://hayahbook.com',
        title: 'موقعنا الرسمي',
      });
    });

    it('handles multiple inline links in the middle of post content', async () => {
      const post = {
        id: 'post-3',
        type: 'post',
        content:
          'تابعونا على [منصة إكس](https://x.com/hayah) وعلى [قناة يوتيوب](https://youtube.com/c/hayah) للمزيد.',
        images: [],
        videoUrl: null,
        linkUrl: null,
        linkTitle: null,
        mentions: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        user: { id: 'user-1', name: 'Person', profileUrl: null, role: 'user' },
        book: null,
        audiobook: null,
      } as any;

      const response = await (service as any).formatPost(post);

      expect(response.content).toBe(post.content);
      expect((response as any).cleanContent).toBeUndefined();
      expect((response as any).htmlContent).toBeUndefined();
      expect(response.links).toHaveLength(2);
      expect(response.links[0].title).toBe('منصة إكس');
      expect(response.links[0].url).toBe('https://x.com/hayah');
      expect(response.links[1].title).toBe('قناة يوتيوب');
      expect(response.links[1].url).toBe('https://youtube.com/c/hayah');
    });

    it('supports the Facebook way: pasting raw URLs in content without custom names', async () => {
      const post = {
        id: 'post-fb-1',
        type: 'post',
        content:
          'منشور عادي برابط فيسبوك ستايل تفضلوا بزيارة https://hayahbook.com/books، نتمنى أن ينال إعجابكم!',
        images: [],
        videoUrl: null,
        linkUrl: null,
        linkTitle: null,
        mentions: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        user: { id: 'user-1', name: 'Person', profileUrl: null, role: 'user' },
        book: null,
        audiobook: null,
      } as any;

      const response = await (service as any).formatPost(post);

      // In Facebook style, raw URL remains in the text with its punctuation
      expect(response.content).toBe(
        'منشور عادي برابط فيسبوك ستايل تفضلوا بزيارة https://hayahbook.com/books، نتمنى أن ينال إعجابكم!',
      );
      expect((response as any).cleanContent).toBeUndefined();
      expect((response as any).htmlContent).toBeUndefined();

      // Auto-detected Facebook-style preview card link
      expect(response.link).toEqual({
        url: 'https://hayahbook.com/books',
        title: 'hayahbook.com',
      });

      expect(response.links).toHaveLength(1);
      expect(response.links[0].displayText).toBe('https://hayahbook.com/books');
    });

    it('supports both styles simultaneously in the same post content', async () => {
      const post = {
        id: 'post-both-1',
        type: 'post',
        content:
          'زوروا [موقعنا الرسمي](https://hayahbook.com) أو تابعوا حسابنا المباشر https://x.com/hayahbook وشكراً.',
        images: [],
        videoUrl: null,
        linkUrl: null,
        linkTitle: null,
        mentions: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        user: { id: 'user-1', name: 'Person', profileUrl: null, role: 'user' },
        book: null,
        audiobook: null,
      } as any;

      const response = await (service as any).formatPost(post);

      expect(response.content).toBe(post.content);
      expect((response as any).cleanContent).toBeUndefined();
      expect((response as any).htmlContent).toBeUndefined();

      expect(response.links).toHaveLength(2);
      expect(response.links[0].title).toBe('موقعنا الرسمي');
      expect(response.links[0].displayText).toBe('موقعنا الرسمي');
      expect(response.links[1].title).toBe('x.com');
      expect(response.links[1].displayText).toBe('https://x.com/hayahbook');
    });

    it('escapes HTML special characters in parseContentLinks to prevent XSS', () => {
      const parsed = (service as any).parseContentLinks(
        '<script>alert("hack")</script> زوروا [موقع آمن](https://safe.com?a=1&b=2)',
      );

      expect(parsed.htmlContent).not.toContain('<script>');
      expect(parsed.htmlContent).toContain('&lt;script&gt;');
      expect(parsed.htmlContent).toContain(
        '<a href="https://safe.com?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">موقع آمن</a>',
      );
    });

    it('auto-formats raw URL in content with title from link DTO', () => {
      const content = 'زوروا موقعنا https://hayahbook.com لمزيد من الكتب';
      const formatted = (service as any).formatContentWithLinks(content, [
        { url: 'https://hayahbook.com', title: 'حياة بوك' },
      ]);

      expect(formatted).toBe('زوروا موقعنا [حياة بوك](https://hayahbook.com) لمزيد من الكتب');
    });

    it('auto-formats standalone title in content with URL from link DTO', () => {
      const content = 'تطبيق حياة بوك هو الأفضل للقراءة الرقمية';
      const formatted = (service as any).formatContentWithLinks(content, [
        { url: 'https://hayahbook.com', title: 'حياة بوك' },
      ]);

      expect(formatted).toBe(
        'تطبيق [حياة بوك](https://hayahbook.com) هو الأفضل للقراءة الرقمية',
      );
    });

    it('normalizes HTML <a> tags in content to markdown [title](url)', () => {
      const content =
        'اقرأ المزيد في <a href="https://example.com/blog">مدونتنا</a> الآن.';
      const formatted = (service as any).formatContentWithLinks(content, []);

      expect(formatted).toBe(
        'اقرأ المزيد في [مدونتنا](https://example.com/blog) الآن.',
      );
    });
  });

  describe('CreatePostDto validation and transformations', () => {
    it('successfully transforms stringified JSON links (multipart/form-data)', async () => {
      const payload = {
        content: 'منشور تجريبي مع روابط',
        links: JSON.stringify([
          { url: 'https://hayahbook.com', title: 'موقعنا' },
          { url: 'https://example.com', title: 'مثال' },
        ]),
      };

      const dto = plainToInstance(CreatePostDto, payload);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.links).toHaveLength(2);
      expect(dto.links![0].url).toBe('https://hayahbook.com');
      expect(dto.links![0].title).toBe('موقعنا');
      expect(dto.links![1].url).toBe('https://example.com');
      expect(dto.links![1].title).toBe('مثال');
    });

    it('successfully validates direct JS array links (application/json)', async () => {
      const payload = {
        content: 'منشور تجريبي مع روابط',
        links: [
          { url: 'https://hayahbook.com', title: 'موقعنا' },
        ],
      };

      const dto = plainToInstance(CreatePostDto, payload);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
      expect(dto.links).toHaveLength(1);
      expect(dto.links![0].url).toBe('https://hayahbook.com');
    });

    it('rejects invalid URLs in links array', async () => {
      const payload = {
        content: 'منشور مع رابط غير صالح',
        links: [{ url: 'invalid-url', title: 'خطأ' }],
      };

      const dto = plainToInstance(CreatePostDto, payload);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('links');
    });
  });

  describe('PostsService.createPost with links integration', () => {
    it('creates and saves a post transforming plain URL and title into inline markdown link', async () => {
      let savedPostData: any = null;

      const mockPostsRepo: any = {
        create: jest.fn().mockImplementation((data) => ({ ...data, id: 'post-uuid-1', createdAt: new Date(), updatedAt: new Date() })),
        save: jest.fn().mockImplementation(async (entity) => {
          savedPostData = entity;
          return { ...entity, id: 'post-uuid-1', createdAt: new Date(), updatedAt: new Date() };
        }),
      };

      const mockUsersRepo: any = {
        findOne: jest.fn().mockResolvedValue({
          id: 'user-uuid-1',
          name: 'علي أحمد',
          profileUrl: 'https://cdn.example.com/avatar.jpg',
          role: 'user',
        }),
        find: jest.fn().mockResolvedValue([]),
      };

      const mockBooksRepo: any = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      const mockAudiobooksRepo: any = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      const mockUploadService: any = {
        uploadPostImages: jest.fn(),
        uploadPostVideo: jest.fn(),
        deleteFileByUrl: jest.fn(),
      };

      const mockI18n: any = {
        t: jest.fn().mockImplementation((key) => key),
      };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      const dto: CreatePostDto = {
        content: 'تفضلوا بزيارة https://hayahbook.com للحصول على الكتب',
        link: { url: 'https://hayahbook.com', title: 'منصة حياة بوك' },
      };

      const result = await postService.createPost('user-uuid-1', dto);

      // Verify saved in repository with inline markdown link
      expect(savedPostData.content).toBe(
        'تفضلوا بزيارة [منصة حياة بوك](https://hayahbook.com) للحصول على الكتب',
      );

      // Verify formatted response
      expect(result.data.content).toBe(
        'تفضلوا بزيارة [منصة حياة بوك](https://hayahbook.com) للحصول على الكتب',
      );
      expect((result.data as any).cleanContent).toBeUndefined();
      expect((result.data as any).htmlContent).toBeUndefined();
      expect(result.data.links[0].title).toBe('منصة حياة بوك');
      expect(result.data.links[0].url).toBe('https://hayahbook.com');
      expect(result.data.link).toEqual({
        url: 'https://hayahbook.com',
        title: 'منصة حياة بوك',
      });
    });

    it('auto-detects ebook when bookId is an ebook UUID', async () => {
      let savedPostData: any = null;
      const mockPostsRepo: any = {
        create: jest.fn().mockImplementation((data) => ({
          ...data,
          id: 'post-uuid-ebook',
          createdAt: new Date(),
          updatedAt: new Date(),
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
        })),
        save: jest.fn().mockImplementation((post) => {
          savedPostData = post;
          return Promise.resolve(post);
        }),
      };

      const mockUsersRepo: any = {
        findOne: jest.fn().mockResolvedValue({ id: 'user-1', name: 'User 1' }),
        find: jest.fn().mockResolvedValue([]),
      };

      const mockBooksRepo: any = {
        findOne: jest.fn().mockResolvedValue({
          id: 'ebook-uuid-1',
          title: 'عقدك النفسية',
          author: 'يوسف الحسني',
          coverUrl: 'https://cdn.example.com/cover.jpg',
          rating: 4.8,
          views: 100,
          readsCount: 50,
        }),
      };

      const mockAudiobooksRepo: any = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      const mockUploadService: any = {
        uploadPostImages: jest.fn(),
        uploadPostVideo: jest.fn(),
        deleteFileByUrl: jest.fn(),
      };

      const mockI18n: any = {
        t: jest.fn().mockImplementation((key) => key),
      };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      const result = await postService.createPost('user-1', {
        content: 'منشور رائع عن كتاب',
        bookId: 'ebook-uuid-1',
      });

      expect(savedPostData.bookId).toBe('ebook-uuid-1');
      expect(result.data.book).toBeDefined();
      expect(result.data.book?.id).toBe('ebook-uuid-1');
      expect(result.data.book?.type).toBe('ebook');
      expect(result.data.book?.hasEbook).toBe(true);
      expect(result.data.book?.hasAudio).toBe(false);
    });

    it('auto-detects audiobook when bookId contains an audiobook UUID', async () => {
      let savedPostData: any = null;
      const mockPostsRepo: any = {
        create: jest.fn().mockImplementation((data) => ({
          ...data,
          id: 'post-uuid-audio',
          createdAt: new Date(),
          updatedAt: new Date(),
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
        })),
        save: jest.fn().mockImplementation((post) => {
          savedPostData = post;
          return Promise.resolve(post);
        }),
      };

      const mockUsersRepo: any = {
        findOne: jest.fn().mockResolvedValue({ id: 'user-1', name: 'User 1' }),
        find: jest.fn().mockResolvedValue([]),
      };

      // Not found in Books table
      const mockBooksRepo: any = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      // Found in Audiobooks table
      const mockAudiobooksRepo: any = {
        findOne: jest.fn().mockResolvedValue({
          id: 'audiobook-uuid-1',
          title: 'كتاب صوتي مميز',
          author: 'أحمد كمال',
          narrator: 'صوت القارئ',
          coverUrl: 'https://cdn.example.com/audio-cover.jpg',
          rating: 4.9,
          views: 200,
          listensCount: 150,
          bookId: null,
        }),
      };

      const mockUploadService: any = {
        uploadPostImages: jest.fn(),
        uploadPostVideo: jest.fn(),
        deleteFileByUrl: jest.fn(),
      };

      const mockI18n: any = {
        t: jest.fn().mockImplementation((key) => key),
      };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      // Sent in single bookId key:
      const result = await postService.createPost('user-1', {
        content: 'استمعوا لهذا الكتاب الصوتي',
        bookId: 'audiobook-uuid-1',
      });

      expect(savedPostData.audiobookId).toBe('audiobook-uuid-1');
      expect(result.data.book).toBeDefined();
      expect(result.data.book?.id).toBe('audiobook-uuid-1');
      expect(result.data.book?.type).toBe('audiobook');
      expect(result.data.book?.hasAudio).toBe(true);
      expect(result.data.book?.hasEbook).toBe(false);
    });

    it('rejects if all keys are empty or content has only whitespace', async () => {
      const mockPostsRepo: any = { create: jest.fn(), save: jest.fn() };
      const mockUsersRepo: any = { findOne: jest.fn(), find: jest.fn() };
      const mockBooksRepo: any = { findOne: jest.fn() };
      const mockAudiobooksRepo: any = { findOne: jest.fn() };
      const mockUploadService: any = { uploadPostImages: jest.fn(), uploadPostVideo: jest.fn() };
      const mockI18n: any = { t: jest.fn().mockImplementation((k) => k) };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      // Empty object
      await expect(
        postService.createPost('user-1', {} as any),
      ).rejects.toThrow(BadRequestException);

      // Whitespace only
      await expect(
        postService.createPost('user-1', { content: '     ' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows publishing a post with only images and no content', async () => {
      let savedPostData: any = null;
      const mockPostsRepo: any = {
        create: jest.fn().mockImplementation((data) => ({
          ...data,
          id: 'post-uuid-images',
          createdAt: new Date(),
          updatedAt: new Date(),
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
        })),
        save: jest.fn().mockImplementation((post) => {
          savedPostData = post;
          return Promise.resolve(post);
        }),
      };
      const mockUsersRepo: any = {
        findOne: jest.fn().mockResolvedValue({ id: 'user-1', name: 'User 1' }),
        find: jest.fn().mockResolvedValue([]),
      };
      const mockBooksRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
      const mockAudiobooksRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
      const mockUploadService: any = {
        uploadPostImages: jest.fn().mockResolvedValue({
          urls: ['https://cdn.example.com/img1.jpg'],
          message: 'ok',
        }),
        uploadPostVideo: jest.fn(),
      };
      const mockI18n: any = { t: jest.fn().mockImplementation((k) => k) };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      const fakeImageFile = {
        buffer: Buffer.from('fake'),
        mimetype: 'image/jpeg',
        fieldname: 'images',
        originalname: 'img.jpg',
        size: 1024,
      } as any;

      const result = await postService.createPost(
        'user-1',
        {},
        [fakeImageFile],
      );

      expect(result.data.images).toContain('https://cdn.example.com/img1.jpg');
      expect(result.data.content).toBe('');
      expect(savedPostData.content).toBe('');
    });

    it('allows publishing a post with only video and whitespace content', async () => {
      let savedPostData: any = null;
      const mockPostsRepo: any = {
        create: jest.fn().mockImplementation((data) => ({
          ...data,
          id: 'post-uuid-video',
          createdAt: new Date(),
          updatedAt: new Date(),
          likesCount: 0,
          commentsCount: 0,
          sharesCount: 0,
        })),
        save: jest.fn().mockImplementation((post) => {
          savedPostData = post;
          return Promise.resolve(post);
        }),
      };
      const mockUsersRepo: any = {
        findOne: jest.fn().mockResolvedValue({ id: 'user-1', name: 'User 1' }),
        find: jest.fn().mockResolvedValue([]),
      };
      const mockBooksRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
      const mockAudiobooksRepo: any = { findOne: jest.fn().mockResolvedValue(null) };
      const mockUploadService: any = {
        uploadPostImages: jest.fn(),
        uploadPostVideo: jest.fn().mockResolvedValue({
          videoUrl: 'https://cdn.example.com/video.mp4',
          message: 'ok',
        }),
      };
      const mockI18n: any = { t: jest.fn().mockImplementation((k) => k) };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      const fakeVideoFile = {
        buffer: Buffer.from('fake'),
        mimetype: 'video/mp4',
        fieldname: 'video',
        originalname: 'vid.mp4',
        size: 2048,
      } as any;

      const result = await postService.createPost(
        'user-1',
        { content: '   ' },
        [fakeVideoFile],
      );

      expect(result.data.videoUrl).toBe('https://cdn.example.com/video.mp4');
      expect(result.data.content).toBe('');
    });

    it('rejects if total images exceed 10', async () => {
      const mockPostsRepo: any = { create: jest.fn(), save: jest.fn() };
      const mockUsersRepo: any = { findOne: jest.fn(), find: jest.fn() };
      const mockBooksRepo: any = { findOne: jest.fn() };
      const mockAudiobooksRepo: any = { findOne: jest.fn() };
      const mockUploadService: any = { uploadPostImages: jest.fn(), uploadPostVideo: jest.fn() };
      const mockI18n: any = { t: jest.fn().mockImplementation((k) => k) };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      const fakeFiles = Array.from({ length: 11 }).map(
        (_, i) =>
          ({
            buffer: Buffer.from('f'),
            mimetype: 'image/jpeg',
            fieldname: 'images',
            originalname: `img${i}.jpg`,
            size: 100,
          }) as any,
      );

      await expect(
        postService.createPost('user-1', { content: 'test' }, fakeFiles),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if more than 1 video is uploaded', async () => {
      const mockPostsRepo: any = { create: jest.fn(), save: jest.fn() };
      const mockUsersRepo: any = { findOne: jest.fn(), find: jest.fn() };
      const mockBooksRepo: any = { findOne: jest.fn() };
      const mockAudiobooksRepo: any = { findOne: jest.fn() };
      const mockUploadService: any = { uploadPostImages: jest.fn(), uploadPostVideo: jest.fn() };
      const mockI18n: any = { t: jest.fn().mockImplementation((k) => k) };

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      const fakeVideoFiles = [
        {
          buffer: Buffer.from('v1'),
          mimetype: 'video/mp4',
          fieldname: 'video',
          originalname: 'v1.mp4',
          size: 100,
        },
        {
          buffer: Buffer.from('v2'),
          mimetype: 'video/mp4',
          fieldname: 'video',
          originalname: 'v2.mp4',
          size: 100,
        },
      ] as any;

      await expect(
        postService.createPost('user-1', { content: 'test' }, fakeVideoFiles),
      ).rejects.toThrow(BadRequestException);
    });

    it('normalizes feed tab types for English and Arabic', () => {
      const mockPostsRepo: any = {};
      const mockUsersRepo: any = {};
      const mockBooksRepo: any = {};
      const mockAudiobooksRepo: any = {};
      const mockUploadService: any = {};
      const mockI18n: any = {};

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      expect(postService.normalizeFeedType()).toBe('all');
      expect(postService.normalizeFeedType('all')).toBe('all');
      expect(postService.normalizeFeedType('الكل')).toBe('all');

      expect(postService.normalizeFeedType('posts')).toBe('posts');
      expect(postService.normalizeFeedType('المنشورات')).toBe('posts');

      expect(postService.normalizeFeedType('articles')).toBe('articles');
      expect(postService.normalizeFeedType('المقالات')).toBe('articles');

      expect(postService.normalizeFeedType('visuals')).toBe('visuals');
      expect(postService.normalizeFeedType('المرئيات')).toBe('visuals');

      expect(postService.normalizeFeedType('snippets')).toBe('snippets');
      expect(postService.normalizeFeedType('المقتطفات')).toBe('snippets');
    });

    it('getFeedCounts calculates correct counts across all 5 tabs', async () => {
      const qb: any = {
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { post_type: 'post', post_video_url: null, post_category: null },
          { post_type: 'article', post_video_url: null, post_category: 'تطوير الذات' },
          { post_type: 'visual', post_video_url: 'https://cdn.example.com/v.mp4', post_category: null },
          { post_type: 'snippet', post_video_url: null, post_category: 'مقتطفات' },
        ]),
      };
      const mockPostsRepo: any = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
      const mockUsersRepo: any = {};
      const mockBooksRepo: any = {};
      const mockAudiobooksRepo: any = {};
      const mockUploadService: any = {};
      const mockI18n: any = {};

      const postService = new PostsService(
        mockPostsRepo,
        mockUsersRepo,
        mockBooksRepo,
        mockAudiobooksRepo,
        mockUploadService,
        mockI18n,
      );

      const counts = await postService.getFeedCounts();
      expect(counts.all).toBe(4);
      expect(counts.posts).toBe(1);
      expect(counts.articles).toBe(1);
      expect(counts.visuals).toBe(1);
      expect(counts.snippets).toBe(1);
    });
  });
});
