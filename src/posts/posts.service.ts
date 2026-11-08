import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, FindOptionsWhere } from 'typeorm';
import { Post } from './post.entity';
import { User } from '../users/user.entity';
import { Book } from '../books/book.entity';
import { Audiobook } from '../books/audiobook.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { I18nService } from '../i18n/i18n.service';
import { UploadService } from '../upload/upload.service';
import { UploadFile } from '../upload/upload-file.interface';
import { InterestsService } from '../interests/interests.service';

export interface FormattedPostPublisher {
  id: string;
  name: string;
  profileUrl: string | null;
  role: string;
}
export type FormattedPostAuthor = FormattedPostPublisher;

export interface FormattedPostBook {
  id: string;
  title: string;
  author: string | null;
  narrator?: string | null;
  category: string | null;
  coverUrl: string | null;
  rating: number;
  views: number;
  readsCount: number;
  listensCount: number;
  type: 'ebook' | 'audiobook' | 'both';
  hasEbook: boolean;
  hasAudio: boolean;
  availableFormats: ('ebook' | 'audiobook')[];
}

export interface FormattedMentionUser {
  id: string;
  name: string | null;
  profileUrl: string | null;
}

export interface FormattedPostLink {
  url: string;
  title: string | null;
  displayText: string;
  startIndex?: number;
  endIndex?: number;
}

export interface FormattedPost {
  id: string;
  type: 'post' | 'article';
  title?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  categoryId?: string | null;
  categoryDetails?: any;
  agreeToTerms?: boolean;
  content: string;
  cleanContent?: string;
  htmlContent?: string;
  images: string[];
  videoUrl: string | null;
  link: {
    url: string;
    title: string | null;
  } | null;
  links: FormattedPostLink[];
  book: FormattedPostBook | null;
  publisher: FormattedPostPublisher;
  mentions: FormattedMentionUser[];
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Book)
    private readonly booksRepository: Repository<Book>,
    @InjectRepository(Audiobook)
    private readonly audiobooksRepository: Repository<Audiobook>,
    private readonly uploadService: UploadService,
    private readonly i18n: I18nService,
    @Optional()
    private readonly interestsService?: InterestsService,
  ) { }

  async createPost(
    userId: string,
    dto: CreatePostDto,
    files?: UploadFile[],
  ): Promise<{ message: string; data: FormattedPost }> {
    let linkUrl = dto.link?.url || dto.linkUrl || null;
    let linkTitle = dto.link?.title || dto.linkTitle || null;

    if (!linkUrl && Array.isArray(dto.links) && dto.links.length > 0) {
      linkUrl = dto.links[0].url || null;
      linkTitle = dto.links[0].title || null;
    }

    if (!dto.content || !dto.content.trim()) {
      throw new BadRequestException(
        this.i18n.t('posts.content_required'),
      );
    }

    // Collect all explicit links provided in DTO
    const explicitLinks: { url: string; title?: string | null }[] = [];
    if (dto.link?.url) {
      explicitLinks.push({ url: dto.link.url, title: dto.link.title });
    }
    if (dto.linkUrl) {
      explicitLinks.push({ url: dto.linkUrl, title: dto.linkTitle });
    }
    if (Array.isArray(dto.links)) {
      for (const item of dto.links) {
        if (item?.url) {
          explicitLinks.push({ url: item.url, title: item.title });
        }
      }
    }

    // Format content with any inline links from DTO or HTML tags
    const processedContent = this.formatContentWithLinks(
      dto.content.trim(),
      explicitLinks,
    );

    // Auto-detect link from content if not explicitly provided (Facebook-style)
    if (!linkUrl && processedContent) {
      const detected = this.extractLinkFromContent(processedContent);
      if (detected) {
        linkUrl = detected.url;
        linkTitle = detected.title;
      }
    }

    const imageFiles = (files || []).filter(
      (f) =>
        f.mimetype.startsWith('image/') ||
        f.fieldname === 'images' ||
        f.fieldname === 'image',
    );
    const videoFiles = (files || []).filter(
      (f) =>
        f.mimetype.startsWith('video/') ||
        f.fieldname === 'video',
    );

    for (const f of files || []) {
      if (!f.mimetype.startsWith('image/') && !f.mimetype.startsWith('video/')) {
        throw new BadRequestException(this.i18n.t('upload.invalid_file_type'));
      }
    }

    const totalImages = (dto.images?.length || 0) + imageFiles.length;
    if (totalImages > 10) {
      throw new BadRequestException(
        this.i18n.t('upload.images_limit_exceeded'),
      );
    }

    const hasVideoDto = !!dto.videoUrl;
    if (videoFiles.length > 1 || (hasVideoDto && videoFiles.length > 0)) {
      throw new BadRequestException(
        this.i18n.t('upload.video_limit_exceeded'),
      );
    }

    let book: Book | null = null;
    if (dto.bookId) {
      book = await this.booksRepository.findOne({
        where: { id: dto.bookId },
        relations: { audiobooks: true },
      });
    }

    let audiobook: Audiobook | null = null;
    if (dto.audiobookId) {
      audiobook = await this.audiobooksRepository.findOne({
        where: { id: dto.audiobookId },
        relations: { book: true },
      });
    }

    // Auto-link complementary format if available
    if (book && !audiobook) {
      const conditions: FindOptionsWhere<Audiobook>[] = [{ bookId: book.id }];
      if (book.author) {
        conditions.push({ title: book.title, author: book.author });
      } else {
        conditions.push({ title: book.title });
      }
      audiobook = await this.audiobooksRepository.findOne({
        where: conditions,
      });
    } else if (audiobook && !book) {
      if (audiobook.bookId) {
        book = await this.booksRepository.findOne({
          where: { id: audiobook.bookId },
        });
      }
      if (!book) {
        const conditions: FindOptionsWhere<Book>[] = [];
        if (audiobook.author) {
          conditions.push({ title: audiobook.title, author: audiobook.author });
        } else {
          conditions.push({ title: audiobook.title });
        }
        book = await this.booksRepository.findOne({
          where: conditions,
        });
      }
    }

    const uploadedImageUrls: string[] = [];
    let uploadedVideoUrl: string | null = null;
    let saved: Post;
    try {
      if (imageFiles.length > 0) {
        const uploadRes = await this.uploadService.uploadPostImages(userId, imageFiles);
        uploadedImageUrls.push(...uploadRes.urls);
      }
      const finalImages = [...(dto.images || []), ...uploadedImageUrls];

      let finalVideoUrl = dto.videoUrl || null;
      if (videoFiles.length > 0) {
        const uploadRes = await this.uploadService.uploadPostVideo(userId, videoFiles[0]);
        finalVideoUrl = uploadedVideoUrl = uploadRes.videoUrl;
      }

      const post = this.postsRepository.create({
        userId,
        type: dto.type || 'post',
        content: processedContent,
        images: finalImages,
        videoUrl: finalVideoUrl,
        linkUrl,
        linkTitle,
        bookId: book?.id || null,
        audiobookId: audiobook?.id || null,
        book: book || undefined,
        audiobook: audiobook || undefined,
        mentions: dto.mentions || [],
      });

      saved = await this.postsRepository.save(post);
    } catch (error) {
      await Promise.all([
        ...uploadedImageUrls.map((url) => this.uploadService.deleteFileByUrl(url)),
        ...(uploadedVideoUrl ? [this.uploadService.deleteFileByUrl(uploadedVideoUrl)] : []),
      ]);
      throw error;
    }

    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    saved.user = user!;
    saved.book = book;
    saved.audiobook = audiobook;

    const formatted = await this.formatPost(saved);

    return {
      message: this.i18n.t('posts.created'),
      data: formatted,
    };
  }

  /**
   * Create and publish an article with strict validations:
   * 1. Title is MANDATORY (إجباري)
   * 2. Cover image is MANDATORY (إجباري) via uploaded file or valid URL
   * 3. Category is MANDATORY (إجباري) and must belong to the approved 9 article categories
   * 4. Content is MANDATORY (إجباري)
   * 5. Agree to Terms is MANDATORY (إجباري: agreeToTerms === true)
   */
  async createArticle(
    userId: string,
    dto: CreateArticleDto,
    files?: UploadFile[],
  ): Promise<{ message: string; data: FormattedPost }> {
    // 1. Terms acceptance validation (إجباري - يجب أن يكون true)
    const termsAccepted =
      dto.agreeToTerms === true ||
      (dto as any).termsAccepted === true ||
      (dto as any).agreeToTerms === 'true' ||
      (dto as any).termsAccepted === 'true';

    if (!termsAccepted) {
      throw new BadRequestException(this.i18n.t('articles.terms_required'));
    }

    // 2. Title validation (إجباري)
    const title = dto.title?.trim();
    if (!title) {
      throw new BadRequestException(this.i18n.t('articles.title_required'));
    }

    // 3. Content validation (إجباري)
    if (!dto.content || !dto.content.trim()) {
      throw new BadRequestException(this.i18n.t('articles.content_required'));
    }

    // 4. Category validation (إجباري)
    const categoryInput = (dto.categoryId || dto.category || '').trim();
    if (!categoryInput) {
      throw new BadRequestException(this.i18n.t('articles.category_required'));
    }

    let finalCategory = dto.category?.trim() || null;
    let finalCategoryId = dto.categoryId || null;

    if (this.interestsService) {
      const validCategories = await this.interestsService.getArticleCategories();
      const matched = validCategories.find(
        (c) =>
          c.id.toLowerCase() === categoryInput.toLowerCase() ||
          c.name_ar === categoryInput ||
          c.name_en?.toLowerCase() === categoryInput.toLowerCase() ||
          c.displayName?.toLowerCase() === categoryInput.toLowerCase(),
      );

      if (!matched) {
        throw new BadRequestException(this.i18n.t('articles.category_invalid'));
      }
      finalCategoryId = matched.id;
      finalCategory = matched.name_ar;
    }

    // 4. Cover Image validation (إجباري)
    const coverFile = files?.find(
      (f) =>
        f.fieldname === 'cover' ||
        f.fieldname === 'coverImage' ||
        f.fieldname === 'cover_image' ||
        f.fieldname === 'mainImage' ||
        f.fieldname === 'main_image',
    ) || (files?.length === 1 && files[0].mimetype.startsWith('image/') ? files[0] : undefined);

    let finalCoverUrl = dto.coverImageUrl || dto.coverUrl || null;
    if (!coverFile && !finalCoverUrl) {
      throw new BadRequestException(this.i18n.t('articles.cover_required'));
    }

    const remainingFiles = files ? files.filter((f) => f !== coverFile) : [];
    const imageFiles = remainingFiles.filter((f) => f.mimetype.startsWith('image/'));
    const videoFiles = remainingFiles.filter((f) => f.mimetype.startsWith('video/'));

    if (imageFiles.length > 10) {
      throw new BadRequestException(this.i18n.t('upload.images_limit_exceeded'));
    }

    if (videoFiles.length > 1) {
      throw new BadRequestException(this.i18n.t('upload.video_limit_exceeded'));
    }

    let book: Book | null = null;
    if (dto.bookId) {
      book = await this.booksRepository.findOne({ where: { id: dto.bookId } });
    }

    let audiobook: Audiobook | null = null;
    if (dto.audiobookId) {
      audiobook = await this.audiobooksRepository.findOne({ where: { id: dto.audiobookId } });
    }

    const explicitLinks: { url: string; title?: string | null }[] = [];
    if (dto.link?.url) {
      explicitLinks.push({ url: dto.link.url, title: dto.link.title });
    }
    if (Array.isArray(dto.links)) {
      for (const l of dto.links) {
        if (l?.url) explicitLinks.push({ url: l.url, title: l.title });
      }
    }
    const processedContent = this.formatContentWithLinks(dto.content, explicitLinks);

    let linkUrl = dto.link?.url || dto.linkUrl || null;
    let linkTitle = dto.link?.title || dto.linkTitle || null;
    if (!linkUrl && Array.isArray(dto.links) && dto.links.length > 0) {
      linkUrl = dto.links[0].url || null;
      linkTitle = dto.links[0].title || null;
    }

    const uploadedUrlsToCleanup: string[] = [];
    let saved: Post;

    try {
      if (coverFile) {
        const coverUpload = await this.uploadService.uploadArticleCover(userId, coverFile);
        finalCoverUrl = coverUpload.url;
        uploadedUrlsToCleanup.push(finalCoverUrl);
      }

      const uploadedImageUrls: string[] = [];
      if (imageFiles.length > 0) {
        const uploadRes = await this.uploadService.uploadPostImages(userId, imageFiles);
        uploadedImageUrls.push(...uploadRes.urls);
        uploadedUrlsToCleanup.push(...uploadRes.urls);
      }
      const finalImages = [...(dto.images || []), ...uploadedImageUrls];

      let finalVideoUrl = dto.videoUrl || null;
      if (videoFiles.length > 0) {
        const uploadRes = await this.uploadService.uploadPostVideo(userId, videoFiles[0]);
        finalVideoUrl = uploadRes.videoUrl;
        uploadedUrlsToCleanup.push(finalVideoUrl);
      }

      const post = this.postsRepository.create({
        userId,
        type: 'article',
        title,
        coverImageUrl: finalCoverUrl,
        category: finalCategory,
        categoryId: finalCategoryId,
        content: processedContent,
        images: finalImages,
        videoUrl: finalVideoUrl,
        linkUrl,
        linkTitle,
        bookId: book?.id || null,
        audiobookId: audiobook?.id || null,
        book: book || undefined,
        audiobook: audiobook || undefined,
        mentions: dto.mentions || [],
      });

      saved = await this.postsRepository.save(post);
    } catch (error) {
      await Promise.all(uploadedUrlsToCleanup.map((url) => this.uploadService.deleteFileByUrl(url)));
      throw error;
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    saved.user = user!;
    saved.book = book;
    saved.audiobook = audiobook;

    const formatted = await this.formatPost(saved);
    return {
      message: this.i18n.t('articles.created'),
      data: formatted,
    };
  }

  async findAll(query: PostsQueryDto): Promise<{
    data: FormattedPost[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.user', 'user')
      .leftJoinAndSelect('post.book', 'book')
      .leftJoinAndSelect('post.audiobook', 'audiobook');

    if (query.type && query.type !== 'all') {
      qb.andWhere('post.type = :type', { type: query.type });
    }

    if (query.userId) {
      qb.andWhere('post.user_id = :userId', { userId: query.userId });
    }

    if (query.search?.trim()) {
      qb.andWhere('post.content ILIKE :search', {
        search: `%${query.search.trim()}%`,
      });
    }

    if (query.category?.trim()) {
      qb.andWhere(
        '(post.category ILIKE :cat OR post.category_id = :catId)',
        {
          cat: `%${query.category.trim()}%`,
          catId: query.category.trim(),
        },
      );
    }

    qb.orderBy('post.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Pre-fetch all mentions in a single batch query to eliminate N+1 overhead
    const allMentionIds = Array.from(
      new Set(items.flatMap((p) => (Array.isArray(p.mentions) ? p.mentions : []))),
    );
    const mentionsMap = new Map<string, FormattedMentionUser>();
    if (allMentionIds.length > 0) {
      const mentionUsers = await this.usersRepository.find({
        where: { id: In(allMentionIds) },
        select: { id: true, name: true, profileUrl: true },
      });
      for (const u of mentionUsers) {
        mentionsMap.set(u.id, {
          id: u.id,
          name: u.name,
          profileUrl: u.profileUrl,
        });
      }
    }

    const data = await Promise.all(
      items.map((p) => this.formatPost(p, mentionsMap)),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<FormattedPost> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: {
        user: true,
        book: true,
        audiobook: true,
      },
    });

    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }

    return this.formatPost(post);
  }

  async remove(
    id: string,
    userId: string,
    isAdmin = false,
  ): Promise<{ message: string }> {
    const post = await this.postsRepository.findOne({
      where: { id },
    });

    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }

    if (post.userId !== userId && !isAdmin) {
      throw new ForbiddenException(this.i18n.t('posts.unauthorized'));
    }

    // Purge images and video from Cloudflare R2 upon post deletion
    if (Array.isArray(post.images) && post.images.length > 0) {
      for (const imgUrl of post.images) {
        await this.uploadService.deleteFileByUrl(imgUrl);
      }
    }

    if (post.videoUrl) {
      await this.uploadService.deleteFileByUrl(post.videoUrl);
    }

    await this.postsRepository.delete(id);

    return {
      message: this.i18n.t('posts.deleted'),
    };
  }

  private async formatPost(
    post: Post,
    preloadedMentions?: Map<string, FormattedMentionUser>,
  ): Promise<FormattedPost> {
    const b = post.book;
    const ab = post.audiobook;

    let formattedBook: FormattedPostBook | null = null;
    if (b || ab) {
      const hasEbook = !!b;
      const hasAudio = !!ab;
      const type: 'ebook' | 'audiobook' | 'both' =
        hasEbook && hasAudio ? 'both' : hasAudio ? 'audiobook' : 'ebook';

      const availableFormats: ('ebook' | 'audiobook')[] = [];
      if (hasEbook) availableFormats.push('ebook');
      if (hasAudio) availableFormats.push('audiobook');

      formattedBook = {
        id: b?.id || ab?.id || '',
        title: b?.title || ab?.title || '',
        author: b?.author || ab?.author || null,
        narrator: ab?.narrator || null,
        category: b?.category || ab?.category || null,
        coverUrl: b?.coverUrl || ab?.coverUrl || null,
        rating: Number(b?.rating || ab?.rating || 4.5),
        views: (b?.views || 0) + (ab?.views || 0),
        readsCount: b?.readsCount || 0,
        listensCount: ab?.listensCount || 0,
        type,
        hasEbook,
        hasAudio,
        availableFormats,
      };
    }

    let mentionsUsers: FormattedMentionUser[] = [];
    if (Array.isArray(post.mentions) && post.mentions.length > 0) {
      if (preloadedMentions) {
        mentionsUsers = post.mentions
          .map((id) => preloadedMentions.get(id))
          .filter((u): u is FormattedMentionUser => !!u);
      } else {
        const users = await this.usersRepository.find({
          where: { id: In(post.mentions) },
          select: { id: true, name: true, profileUrl: true },
        });
        mentionsUsers = users.map((u) => ({
          id: u.id,
          name: u.name,
          profileUrl: u.profileUrl,
        }));
      }
    }

    const parsedLinksInfo = this.parseContentLinks(post.content);

    let formattedLink = post.linkUrl
      ? {
        url: post.linkUrl,
        title: post.linkTitle,
      }
      : null;

    // Fallback: auto-detect link from content if linkUrl is null (e.g. existing posts)
    if (!formattedLink && parsedLinksInfo.links.length > 0) {
      formattedLink = {
        url: parsedLinksInfo.links[0].url,
        title: parsedLinksInfo.links[0].title,
      };
    }

    // Merge post.linkUrl into links array if not already present
    const allLinks: FormattedPostLink[] = [...parsedLinksInfo.links];
    if (
      post.linkUrl &&
      !allLinks.some(
        (l) => l.url.toLowerCase() === post.linkUrl?.toLowerCase(),
      )
    ) {
      allLinks.push({
        url: post.linkUrl,
        title: post.linkTitle,
        displayText: post.linkTitle || post.linkUrl,
      });
    }

    const currentLang = this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : 'ar';
    const categoryDetails = (post.categoryId || post.category)
      ? {
          id: post.categoryId || null,
          displayName: post.category,
          name_ar: post.category,
          name_en: post.category,
          category: currentLang === 'en' ? 'Articles' : 'المقالات',
          category_ar: 'المقالات',
          category_en: 'Articles',
        }
      : null;

    const isArticle = post.type === 'article';

    const formatted: FormattedPost = {
      id: post.id,
      type: post.type,
      title: post.title || null,
      coverImageUrl: post.coverImageUrl || null,
      category: post.category || null,
      categoryId: post.categoryId || null,
      categoryDetails,
      ...(isArticle ? { agreeToTerms: true } : {}),
      content: post.content,
      ...(!isArticle
        ? {
            cleanContent: parsedLinksInfo.cleanContent,
            htmlContent: parsedLinksInfo.htmlContent,
          }
        : {}),
      images: post.images || [],
      videoUrl: post.videoUrl,
      link: formattedLink,
      links: allLinks,
      book: formattedBook,
      publisher: {
        id: post.user?.id || post.userId,
        name: post.user?.name || '',
        profileUrl: post.user?.profileUrl || null,
        role: post.user?.role || 'user',
      },
      mentions: mentionsUsers,
      likesCount: post.likesCount || 0,
      commentsCount: post.commentsCount || 0,
      sharesCount: post.sharesCount || 0,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };

    return formatted;
  }

  /**
   * Escape special HTML characters to prevent XSS
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Check word boundary for Unicode and Arabic characters
   */
  private isWordBoundary(str: string, index: number, length: number): boolean {
    const beforeChar = index > 0 ? str[index - 1] : ' ';
    const afterChar = index + length < str.length ? str[index + length] : ' ';
    const isWordChar = (ch: string) => /[\p{L}\p{N}_]/u.test(ch);
    return !isWordChar(beforeChar) && !isWordChar(afterChar);
  }

  /**
   * Smartly integrate DTO links into content (replaces raw URLs or titles with markdown links)
   */
  private formatContentWithLinks(
    content: string,
    links: { url: string; title?: string | null }[],
  ): string {
    if (!content) return '';

    // 1. Normalize HTML <a> tags to markdown [text](url)
    let result = content.replace(
      /<a\s+(?:[^>]*?\s+)?href=["']((?:https?:\/\/|www\.)[^"']+)["'][^>]*>(.*?)<\/a>/gi,
      (_match, href, innerText) => {
        const cleanHref = href.trim();
        const cleanText = innerText.replace(/<[^>]+>/g, '').trim() || cleanHref;
        return `[${cleanText}](${cleanHref})`;
      },
    );

    if (!links || links.length === 0) return result;

    for (const item of links) {
      if (!item.url) continue;
      const url = item.url.trim();
      const title = item.title?.trim();

      if (!title) continue;

      // Check if URL exists in content as a standalone URL (not inside [title](url))
      const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const standaloneUrlRegex = new RegExp(`(?<!\\]\\()(?<!href=["'])${escapedUrl}`, 'g');
      if (standaloneUrlRegex.test(result)) {
        result = result.replace(standaloneUrlRegex, `[${title}](${url})`);
        continue;
      }

      // If title exists in content and url is not already in content as a link
      if (!result.includes(`(${url})`) && !result.includes(`[${title}]`)) {
        let searchIndex = 0;
        while ((searchIndex = result.indexOf(title, searchIndex)) !== -1) {
          if (this.isWordBoundary(result, searchIndex, title.length)) {
            const before = result.slice(0, searchIndex);
            const openBrackets = (before.match(/\[/g) || []).length;
            const closeBrackets = (before.match(/\]/g) || []).length;
            if (openBrackets === closeBrackets) {
              result =
                result.slice(0, searchIndex) +
                `[${title}](${url})` +
                result.slice(searchIndex + title.length);
              break;
            }
          }
          searchIndex += title.length;
        }
      }
    }

    return result;
  }

  /**
   * Parse content to extract all links, cleanContent, and htmlContent
   */
  private parseContentLinks(content?: string | null): {
    cleanContent: string;
    htmlContent: string;
    links: FormattedPostLink[];
  } {
    if (!content) {
      return { cleanContent: '', htmlContent: '', links: [] };
    }

    // Combined regex: match markdown links first, then standalone URLs
    const combinedRegex =
      /\[([^\]]*)\]\(((?:https?:\/\/|www\.)[^\s)]+)\)|((?:https?:\/\/|www\.)[^\s<>'"`()[\]]+)/gi;

    const links: FormattedPostLink[] = [];
    let cleanContent = '';
    let htmlContent = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(content)) !== null) {
      const rawMatch = match[0];
      const matchIndex = match.index;

      // Append preceding plain text
      const plainBefore = content.slice(lastIndex, matchIndex);
      cleanContent += plainBefore;
      htmlContent += this.escapeHtml(plainBefore);

      let url = '';
      let title: string | null = null;
      let displayText = '';
      let trailingPunctuation = '';

      if (match[1] !== undefined && match[2] !== undefined) {
        // Markdown link [title](url)
        title = match[1].trim();
        const rawUrl = match[2].trim();
        url = rawUrl.replace(/[.,!?;:)،؛؟\s]+$/, '');
        trailingPunctuation = rawUrl.slice(url.length);
        displayText = title || url;
      } else if (match[3] !== undefined) {
        // Standalone URL (Facebook style)
        const rawUrl = match[3].trim();
        url = rawUrl.replace(/[.,!?;:)،؛؟\s]+$/, '');
        trailingPunctuation = rawUrl.slice(url.length);
        try {
          const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
          title = parsed.hostname.replace(/^www\./, '');
        } catch {
          title = null;
        }
        displayText = url;
      }

      if (url.startsWith('www.')) {
        url = `https://${url}`;
      }

      const startIndex = cleanContent.length;
      cleanContent += displayText;
      const endIndex = cleanContent.length;

      cleanContent += trailingPunctuation;

      htmlContent += `<a href="${this.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(displayText)}</a>${this.escapeHtml(trailingPunctuation)}`;

      links.push({
        url,
        title,
        displayText,
        startIndex,
        endIndex,
      });

      lastIndex = matchIndex + rawMatch.length;
    }

    // Append remaining text
    const remaining = content.slice(lastIndex);
    cleanContent += remaining;
    htmlContent += this.escapeHtml(remaining);

    return { cleanContent, htmlContent, links };
  }

  /**
   * Auto-extract first URL or Markdown link from post content (Facebook-style)
   */
  private extractLinkFromContent(
    content?: string | null,
  ): { url: string; title: string | null } | null {
    if (!content) return null;
    const parsed = this.parseContentLinks(content);
    if (parsed.links.length > 0) {
      return {
        url: parsed.links[0].url,
        title: parsed.links[0].title,
      };
    }
    return null;
  }
}

