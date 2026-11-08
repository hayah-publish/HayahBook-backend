import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
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

      // 1. cleanContent displays the title instead of the URL
      expect(response.cleanContent).toBe(
        'مرحباً بكم، يمكنكم زيارة موقعنا الرسمي لمزيد من التفاصيل.',
      );

      // 2. htmlContent renders clickable <a> tag targeting the URL
      expect(response.htmlContent).toContain(
        '<a href="https://hayahbook.com" target="_blank" rel="noopener noreferrer">موقعنا الرسمي</a>',
      );

      // 3. links array contains parsed link metadata
      expect(response.links).toHaveLength(1);
      expect(response.links[0]).toEqual({
        url: 'https://hayahbook.com',
        title: 'موقعنا الرسمي',
        displayText: 'موقعنا الرسمي',
        startIndex: 25,
        endIndex: 38,
      });

      // Verification: cleanContent substring at indices matches displayText
      expect(
        response.cleanContent.slice(
          response.links[0].startIndex,
          response.links[0].endIndex,
        ),
      ).toBe('موقعنا الرسمي');

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

      expect(response.cleanContent).toBe(
        'تابعونا على منصة إكس وعلى قناة يوتيوب للمزيد.',
      );
      expect(response.links).toHaveLength(2);
      expect(response.links[0].title).toBe('منصة إكس');
      expect(response.links[0].url).toBe('https://x.com/hayah');
      expect(response.links[1].title).toBe('قناة يوتيوب');
      expect(response.links[1].url).toBe('https://youtube.com/c/hayah');

      expect(
        response.cleanContent.slice(
          response.links[0].startIndex,
          response.links[0].endIndex,
        ),
      ).toBe('منصة إكس');
      expect(
        response.cleanContent.slice(
          response.links[1].startIndex,
          response.links[1].endIndex,
        ),
      ).toBe('قناة يوتيوب');
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
      expect(response.cleanContent).toBe(
        'منشور عادي برابط فيسبوك ستايل تفضلوا بزيارة https://hayahbook.com/books، نتمنى أن ينال إعجابكم!',
      );

      // In HTML, the URL itself is clickable
      expect(response.htmlContent).toContain(
        '<a href="https://hayahbook.com/books" target="_blank" rel="noopener noreferrer">https://hayahbook.com/books</a>،',
      );

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

      // Custom link shows custom name, raw link shows raw URL
      expect(response.cleanContent).toBe(
        'زوروا موقعنا الرسمي أو تابعوا حسابنا المباشر https://x.com/hayahbook وشكراً.',
      );

      expect(response.htmlContent).toContain(
        '<a href="https://hayahbook.com" target="_blank" rel="noopener noreferrer">موقعنا الرسمي</a>',
      );
      expect(response.htmlContent).toContain(
        '<a href="https://x.com/hayahbook" target="_blank" rel="noopener noreferrer">https://x.com/hayahbook</a>',
      );

      expect(response.links).toHaveLength(2);
      expect(response.links[0].title).toBe('موقعنا الرسمي');
      expect(response.links[0].displayText).toBe('موقعنا الرسمي');
      expect(response.links[1].title).toBe('x.com');
      expect(response.links[1].displayText).toBe('https://x.com/hayahbook');
    });

    it('escapes HTML special characters in htmlContent to prevent XSS', async () => {
      const post = {
        id: 'post-4',
        type: 'post',
        content:
          '<script>alert("hack")</script> زوروا [موقع آمن](https://safe.com?a=1&b=2)',
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

      expect(response.htmlContent).not.toContain('<script>');
      expect(response.htmlContent).toContain('&lt;script&gt;');
      expect(response.htmlContent).toContain(
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
      expect(result.data.cleanContent).toBe(
        'تفضلوا بزيارة منصة حياة بوك للحصول على الكتب',
      );
      expect(result.data.htmlContent).toContain(
        '<a href="https://hayahbook.com" target="_blank" rel="noopener noreferrer">منصة حياة بوك</a>',
      );
      expect(result.data.links[0].title).toBe('منصة حياة بوك');
      expect(result.data.links[0].url).toBe('https://hayahbook.com');
      expect(result.data.link).toEqual({
        url: 'https://hayahbook.com',
        title: 'منصة حياة بوك',
      });
    });
  });
});
