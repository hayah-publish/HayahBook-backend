import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, FindOptionsWhere, SelectQueryBuilder, DataSource } from 'typeorm';
import { Post } from './post.entity';
import { PostReaction, ReactionType, PostReactionsCount } from './post-reaction.entity';
import { User } from '../users/user.entity';
import { UserUserFollow } from '../users/user-user-follow.entity';
import { Book } from '../books/book.entity';
import { Audiobook } from '../books/audiobook.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { ReactionsQueryDto } from './dto/reactions-query.dto';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';
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
  bookmarksCount?: number;
  reactionsCount?: PostReactionsCount;
  topReactions?: ReactionType[];
  userReaction?: ReactionType | null;
  isSaved?: boolean;
  savedAt?: Date;
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
    @Optional()
    @InjectRepository(UserUserFollow)
    private readonly userFollowRepo?: Repository<UserUserFollow>,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    @InjectRepository(PostReaction)
    private readonly postReactionRepo?: Repository<PostReaction>,
  ) { }

  /**
   * Retrieve list of user/author/creator IDs followed by the user
   */
  async getFollowedUserIds(currentUserId: string): Promise<string[]> {
    if (!currentUserId) return [];

    const followedIds = new Set<string>();

    if (this.userFollowRepo) {
      try {
        const userFollows = await this.userFollowRepo.find({
          where: { followerId: currentUserId },
          select: { followingId: true },
        });
        for (const f of userFollows) {
          if (f.followingId) followedIds.add(f.followingId);
        }
      } catch {
        // Ignored in case table or entity mock is not present
      }
    }

    if (this.dataSource) {
      try {
        const authorFollows = await this.dataSource.query(
          `SELECT author_id AS id FROM user_author_follows WHERE user_id = $1`,
          [currentUserId],
        );
        for (const row of authorFollows || []) {
          if (row?.id) followedIds.add(row.id);
        }
      } catch {
        // Table may not exist in mock tests
      }

      try {
        const creatorFollows = await this.dataSource.query(
          `SELECT creator_id AS id FROM user_creator_follows WHERE user_id = $1`,
          [currentUserId],
        );
        for (const row of creatorFollows || []) {
          if (row?.id) followedIds.add(row.id);
        }
      } catch {
        // Table may not exist in mock tests
      }
    }

    return Array.from(followedIds);
  }

  /**
   * Normalize input reaction string from English or Arabic into standard canonical ReactionType
   */
  normalizeReactionType(input?: string): ReactionType | null {
    if (!input) return null;
    const val = input.trim().toLowerCase();

    if (val === 'agree' || val === 'اتفق' || val === 'اتفاق' || val === 'like') {
      return 'agree';
    }
    if (
      val === 'love' ||
      val === 'احببته' ||
      val === 'أحببته' ||
      val === 'حب' ||
      val === 'heart'
    ) {
      return 'love';
    }
    if (
      val === 'applaud' ||
      val === 'احسنت' ||
      val === 'أحسنت' ||
      val === 'bravo' ||
      val === 'clap' ||
      val === 'claps' ||
      val === 'celebrate'
    ) {
      return 'applaud';
    }
    if (
      val === 'insightful' ||
      val === 'يستحق التفكير' ||
      val === 'تفكير' ||
      val === 'thoughtful' ||
      val === 'think'
    ) {
      return 'insightful';
    }
    if (
      val === 'disagree' ||
      val === 'اعترض' ||
      val === 'أعترض' ||
      val === 'اعتراض'
    ) {
      return 'disagree';
    }

    return null;
  }

  /**
   * Return metadata and localized labels for a reaction type
   */
  getReactionLabels(type: ReactionType): { ar: string; en: string; icon: string } {
    switch (type) {
      case 'agree':
        return { ar: 'اتفق', en: 'Agree', icon: '🤝' };
      case 'love':
        return { ar: 'احببته', en: 'Love', icon: '❤️' };
      case 'applaud':
        return { ar: 'احسنت', en: 'Bravo', icon: '👏' };
      case 'insightful':
        return { ar: 'يستحق التفكير', en: 'Insightful', icon: '💭' };
      case 'disagree':
        return { ar: 'اعترض', en: 'Disagree', icon: '🙅' };
    }
  }

  /**
   * Add, toggle off, or switch reaction on a post or article
   */
  async reactToPost(
    userId: string,
    postId: string,
    reactionInput: string,
  ): Promise<{
    message: string;
    action: 'added' | 'updated' | 'removed';
    userReaction: ReactionType | null;
    reactionsCount: PostReactionsCount;
    topReactions: ReactionType[];
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(
        this.i18n?.t ? this.i18n.t('posts.not_found') : 'Post not found',
      );
    }

    const targetType = this.normalizeReactionType(reactionInput);
    if (!targetType) {
      throw new BadRequestException(
        this.i18n?.t ? this.i18n.t('reactions.invalid_type') : 'Invalid reaction type',
      );
    }

    const existing = await this.postReactionRepo?.findOne({
      where: { postId, userId },
    });

    const rawCounts: any = post.reactionsCount || {};
    const counts: PostReactionsCount = {
      total: Number(rawCounts.total) || post.likesCount || 0,
      agree: Number(rawCounts.agree) || 0,
      love: Number(rawCounts.love) || 0,
      applaud: Number(rawCounts.applaud) || 0,
      insightful: Number(rawCounts.insightful) || 0,
      disagree: Number(rawCounts.disagree) || 0,
    };

    let action: 'added' | 'updated' | 'removed';
    let userReaction: ReactionType | null = null;
    let messageKey = 'reactions.added';

    if (!existing) {
      // 1. New reaction
      action = 'added';
      userReaction = targetType;
      messageKey = 'reactions.added';

      if (this.postReactionRepo) {
        const entity = this.postReactionRepo.create({
          userId,
          postId,
          reactionType: targetType,
        });
        await this.postReactionRepo.save(entity);
      }

      counts[targetType] = (counts[targetType] || 0) + 1;
      counts.total = (counts.total || 0) + 1;
    } else if (existing.reactionType === targetType) {
      // 2. Same reaction clicked again -> Toggle OFF (Remove)
      action = 'removed';
      userReaction = null;
      messageKey = 'reactions.removed';

      if (this.postReactionRepo) {
        await this.postReactionRepo.delete({ id: existing.id });
      }

      counts[targetType] = Math.max(0, (counts[targetType] || 1) - 1);
      counts.total = Math.max(0, (counts.total || 1) - 1);
    } else {
      // 3. Different reaction clicked -> Switch / Update
      action = 'updated';
      userReaction = targetType;
      messageKey = 'reactions.updated';
      const oldType = existing.reactionType;

      if (this.postReactionRepo) {
        existing.reactionType = targetType;
        await this.postReactionRepo.save(existing);
      }

      counts[oldType] = Math.max(0, (counts[oldType] || 1) - 1);
      counts[targetType] = (counts[targetType] || 0) + 1;
      // Total count stays the same!
    }

    // Persist updated counters on post entity
    post.reactionsCount = counts;
    post.likesCount = counts.total;
    await this.postsRepository.save(post);

    const reactionKeys: ReactionType[] = [
      'agree',
      'love',
      'applaud',
      'insightful',
      'disagree',
    ];
    const topReactions = reactionKeys
      .filter((k) => (counts[k] || 0) > 0)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
      .slice(0, 3);

    return {
      message: this.i18n?.t ? this.i18n.t(messageKey) : messageKey,
      action,
      userReaction,
      reactionsCount: counts,
      topReactions,
    };
  }

  /**
   * Explicitly remove reaction from a post
   */
  async removeReaction(
    userId: string,
    postId: string,
  ): Promise<{
    message: string;
    action: 'removed';
    userReaction: null;
    reactionsCount: PostReactionsCount;
    topReactions: ReactionType[];
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(
        this.i18n?.t ? this.i18n.t('posts.not_found') : 'Post not found',
      );
    }

    const rawCounts: any = post.reactionsCount || {};
    const counts: PostReactionsCount = {
      total: Number(rawCounts.total) || post.likesCount || 0,
      agree: Number(rawCounts.agree) || 0,
      love: Number(rawCounts.love) || 0,
      applaud: Number(rawCounts.applaud) || 0,
      insightful: Number(rawCounts.insightful) || 0,
      disagree: Number(rawCounts.disagree) || 0,
    };

    const existing = await this.postReactionRepo?.findOne({
      where: { postId, userId },
    });

    if (existing) {
      const oldType = existing.reactionType;
      if (this.postReactionRepo) {
        await this.postReactionRepo.delete({ id: existing.id });
      }

      counts[oldType] = Math.max(0, (counts[oldType] || 1) - 1);
      counts.total = Math.max(0, (counts.total || 1) - 1);

      post.reactionsCount = counts;
      post.likesCount = counts.total;
      await this.postsRepository.save(post);
    }

    const reactionKeys: ReactionType[] = [
      'agree',
      'love',
      'applaud',
      'insightful',
      'disagree',
    ];
    const topReactions = reactionKeys
      .filter((k) => (counts[k] || 0) > 0)
      .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
      .slice(0, 3);

    return {
      message: this.i18n?.t ? this.i18n.t('reactions.removed') : 'Reaction removed',
      action: 'removed',
      userReaction: null,
      reactionsCount: counts,
      topReactions,
    };
  }

  /**
   * Get reactions modal list for a post with tabs filtering (All, 🤝, ❤️, 👏, 💭, 🙅)
   */
  async getPostReactions(
    postId: string,
    query: ReactionsQueryDto,
    currentUserId?: string,
  ): Promise<{
    counts: PostReactionsCount & { all: number };
    data: Array<{
      id: string;
      reaction: ReactionType;
      reactionIcon: string;
      reactionLabelAr: string;
      reactionLabelEn: string;
      createdAt: Date;
      user: {
        id: string;
        name: string;
        profileUrl: string | null;
        userType: string;
        isVerified: boolean;
        isFollowing: boolean;
      };
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(
        this.i18n?.t ? this.i18n.t('posts.not_found') : 'Post not found',
      );
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));

    // 1. Grouped counts across all reaction types for this post
    const counts = {
      all: 0,
      total: 0,
      agree: 0,
      love: 0,
      applaud: 0,
      insightful: 0,
      disagree: 0,
    };

    if (this.postReactionRepo) {
      const rawCounts = await this.postReactionRepo
        .createQueryBuilder('r')
        .where('r.postId = :postId', { postId })
        .select(['r.reactionType AS type', 'COUNT(r.id) AS count'])
        .groupBy('r.reactionType')
        .getRawMany();

      for (const row of rawCounts) {
        const t = row.type as ReactionType;
        const c = Number(row.count) || 0;
        if (counts[t] !== undefined) counts[t] = c;
        counts.all += c;
        counts.total += c;
      }
    }

    // 2. Query reactions for users list
    let items: PostReaction[] = [];
    let total = 0;

    if (this.postReactionRepo) {
      const qb = this.postReactionRepo
        .createQueryBuilder('r')
        .innerJoinAndSelect('r.user', 'user')
        .where('r.postId = :postId', { postId });

      if (query.type && query.type !== 'all' && query.type !== 'الكل') {
        const targetType = this.normalizeReactionType(query.type);
        if (targetType) {
          qb.andWhere('r.reactionType = :targetType', { targetType });
        }
      }

      qb.orderBy('r.createdAt', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      [items, total] = await qb.getManyAndCount();
    }

    // 3. Batch check isFollowing if currentUserId is provided
    const followingSet = new Set<string>();
    if (currentUserId && items.length > 0 && this.userFollowRepo) {
      const targetUserIds = items.map((i) => i.user?.id).filter(Boolean);
      if (targetUserIds.length > 0) {
        try {
          const userFollows = await this.userFollowRepo.find({
            where: { followerId: currentUserId, followingId: In(targetUserIds) },
            select: { followingId: true },
          });
          for (const f of userFollows) {
            followingSet.add(f.followingId);
          }
        } catch {
          // Ignore if follow table mock
        }
      }
    }

    const data = items.map((i) => {
      const labels = this.getReactionLabels(i.reactionType);
      return {
        id: i.id,
        reaction: i.reactionType,
        reactionIcon: labels.icon,
        reactionLabelAr: labels.ar,
        reactionLabelEn: labels.en,
        createdAt: i.createdAt,
        user: {
          id: i.user?.id || i.userId,
          name: i.user?.name || '',
          profileUrl: i.user?.profileUrl || null,
          userType: i.user?.userType || 'reader',
          isVerified: !!(i.user as any)?.isVerified,
          isFollowing: followingSet.has(i.user?.id || i.userId),
        },
      };
    });

    return {
      counts,
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async createPost(
    userId: string,
    dto: CreatePostDto,
    files?: UploadFile[],
  ): Promise<{ message: string; data: FormattedPost }> {
    if ((dto as { type?: string }).type === 'article') {
      throw new BadRequestException('Articles must be created through the articles endpoint');
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

    const trimmedContent = (dto.content || '').trim();
    const hasText = trimmedContent.length > 0;
    const hasImageFiles = imageFiles.length > 0;
    const hasVideoFiles = videoFiles.length > 0;
    const hasImageUrls = Array.isArray(dto.images) && dto.images.length > 0;
    const hasVideoUrl = !!dto.videoUrl;
    const hasBook = !!(dto.bookId || dto.audiobookId);
    const hasLink = !!(
      dto.link?.url ||
      dto.linkUrl ||
      (Array.isArray(dto.links) && dto.links.length > 0)
    );

    const hasAnyContent =
      hasText ||
      hasImageFiles ||
      hasVideoFiles ||
      hasImageUrls ||
      hasVideoUrl ||
      hasBook ||
      hasLink;

    if (!hasAnyContent) {
      throw new BadRequestException(
        this.i18n.t('posts.content_required'),
      );
    }

    let linkUrl = dto.link?.url || dto.linkUrl || null;
    let linkTitle = dto.link?.title || dto.linkTitle || null;

    if (!linkUrl && Array.isArray(dto.links) && dto.links.length > 0) {
      linkUrl = dto.links[0].url || null;
      linkTitle = dto.links[0].title || null;
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
    const processedContent = hasText
      ? this.formatContentWithLinks(trimmedContent, explicitLinks)
      : '';

    // Auto-detect link from content if not explicitly provided (Facebook-style)
    if (!linkUrl && processedContent) {
      const detected = this.extractLinkFromContent(processedContent);
      if (detected) {
        linkUrl = detected.url;
        linkTitle = detected.title;
      }
    }

    const { book, audiobook } = await this.resolveBookOrAudiobook(
      dto.bookId,
      dto.audiobookId,
    );

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
    } else {
      const meta = this.getArticleCategoryMeta(dto.categoryId, dto.category);
      if (!meta) {
        throw new BadRequestException(this.i18n.t('articles.category_invalid'));
      }
      finalCategoryId = meta.id;
      finalCategory = meta.name_ar;
    }

    // 4. Cover Image validation (إجباري)
    const coverFile = files?.find(
      (f) =>
        f.fieldname === 'cover' ||
        f.fieldname === 'coverImage' ||
        f.fieldname === 'cover_image' ||
        f.fieldname === 'mainImage' ||
        f.fieldname === 'main_image',
    ) || (files?.length === 1 && files[0].mimetype.startsWith('image/') && files[0].fieldname !== 'images' && files[0].fieldname !== 'image' ? files[0] : undefined);

    let finalCoverUrl =
      (typeof dto.cover === 'string' && dto.cover.trim().startsWith('http') ? dto.cover.trim() : null) ||
      (typeof dto.coverImage === 'string' && dto.coverImage.trim().startsWith('http') ? dto.coverImage.trim() : null) ||
      dto.coverImageUrl ||
      dto.coverUrl ||
      null;

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

    const { book, audiobook } = await this.resolveBookOrAudiobook(
      dto.bookId,
      dto.audiobookId,
    );

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

  /**
   * Normalize input tab string from English or Arabic into standard canonical tab key
   */
  normalizeFeedType(input?: string): 'all' | 'posts' | 'articles' | 'visuals' | 'snippets' {
    if (!input) return 'all';
    const val = input.trim().toLowerCase();

    if (val === 'all' || val === 'الكل') return 'all';
    if (
      val === 'posts' ||
      val === 'post' ||
      val === 'المنشورات' ||
      val === 'منشورات' ||
      val === 'منشور'
    ) {
      return 'posts';
    }
    if (
      val === 'articles' ||
      val === 'article' ||
      val === 'المقالات' ||
      val === 'مقالات' ||
      val === 'مقال'
    ) {
      return 'articles';
    }
    if (
      val === 'visuals' ||
      val === 'visual' ||
      val === 'المرئيات' ||
      val === 'مرئيات' ||
      val === 'video' ||
      val === 'videos' ||
      val === 'فيديو'
    ) {
      return 'visuals';
    }
    if (
      val === 'snippets' ||
      val === 'snippet' ||
      val === 'المقتطفات' ||
      val === 'مقتطفات' ||
      val === 'اقتباسات' ||
      val === 'مقتطف' ||
      val === 'اقتباس'
    ) {
      return 'snippets';
    }

    return 'all';
  }

  /**
   * Apply category/type filter to post query builder
   */
  private applyFeedTabFilter(qb: SelectQueryBuilder<Post>, tab: string) {
    if (tab === 'articles') {
      qb.andWhere("post.type = 'article'");
    } else if (tab === 'visuals') {
      qb.andWhere(
        "(post.type = 'visual' OR (post.videoUrl IS NOT NULL AND post.videoUrl != '') OR post.category ILIKE '%مرئيات%' OR post.category ILIKE '%visual%')",
      );
    } else if (tab === 'snippets') {
      qb.andWhere(
        "(post.type = 'snippet' OR post.category ILIKE '%مقتطف%' OR post.category ILIKE '%snippet%' OR post.category ILIKE '%اقتباس%')",
      );
    } else if (tab === 'posts') {
      qb.andWhere("post.type = 'post'");
    }
  }

  /**
   * Calculate item counts for the 5 tabs in the feed (supports filtering by followed user IDs)
   */
  async getFeedCounts(filterUserIds?: string[]): Promise<{
    all: number;
    posts: number;
    articles: number;
    visuals: number;
    snippets: number;
  }> {
    if (Array.isArray(filterUserIds) && filterUserIds.length === 0) {
      return { all: 0, posts: 0, articles: 0, visuals: 0, snippets: 0 };
    }

    const qb = this.postsRepository.createQueryBuilder('post')
      .select('COUNT(*)', 'all')
      .addSelect(`COUNT(*) FILTER (WHERE post.type = 'post')`, 'posts')
      .addSelect(`COUNT(*) FILTER (WHERE post.type = 'article')`, 'articles')
      .addSelect(`COUNT(*) FILTER (WHERE post.type = 'visual' OR post.videoUrl IS NOT NULL OR LOWER(COALESCE(post.category, '')) LIKE '%مرئيات%' OR LOWER(COALESCE(post.category, '')) LIKE '%visual%')`, 'visuals')
      .addSelect(`COUNT(*) FILTER (WHERE post.type = 'snippet' OR LOWER(COALESCE(post.category, '')) LIKE '%مقتطف%' OR LOWER(COALESCE(post.category, '')) LIKE '%snippet%' OR LOWER(COALESCE(post.category, '')) LIKE '%اقتباس%')`, 'snippets');

    if (Array.isArray(filterUserIds) && filterUserIds.length > 0) {
      qb.where('post.user_id IN (:...filterUserIds)', { filterUserIds });
    }

    const counts = await qb.getRawOne() ?? {};

    return {
      all: Number(counts.all ?? 0),
      posts: Number(counts.posts ?? 0),
      articles: Number(counts.articles ?? 0),
      visuals: Number(counts.visuals ?? 0),
      snippets: Number(counts.snippets ?? 0),
    };
  }

  /**
   * Home Feed combining posts, articles, visuals, and snippets.
   * If query.following is true or query.scope === 'following', filters feed to users followed by currentUserId.
   */
  async getHomeFeed(
    query: PostsQueryDto,
    currentUserId?: string,
  ): Promise<{
    counts: {
      all: number;
      posts: number;
      articles: number;
      visuals: number;
      snippets: number;
    };
    data: FormattedPost[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const isFollowing =
      query.following === true ||
      query.scope === 'following';

    if (isFollowing && !currentUserId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }

    let filterUserIds: string[] | undefined = undefined;
    if (isFollowing && currentUserId) {
      const followed = await this.getFollowedUserIds(currentUserId);
      if (followed.length === 0) {
        return {
          counts: { all: 0, posts: 0, articles: 0, visuals: 0, snippets: 0 },
          data: [],
          total: 0,
          page: Math.max(1, Number(query.page) || 1),
          limit: Math.max(1, Math.min(50, Number(query.limit) || 20)),
          totalPages: 1,
        };
      }
      filterUserIds = followed;
    }

    const feed = await this.findAll(
      {
        ...query,
        followingUserIds: filterUserIds,
      },
      currentUserId,
    );
    const counts = await this.getFeedCounts(filterUserIds);

    return {
      counts,
      ...feed,
    };
  }

  async findAll(
    query: PostsQueryDto,
    currentUserId?: string,
  ): Promise<{
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

    const tab = this.normalizeFeedType(query.type);
    if (tab !== 'all') {
      this.applyFeedTabFilter(qb, tab);
    }

    if (Array.isArray(query.followingUserIds) && query.followingUserIds.length > 0) {
      qb.andWhere('post.user_id IN (:...followingUserIds)', {
        followingUserIds: query.followingUserIds,
      });
    } else if (Array.isArray(query.followingUserIds) && query.followingUserIds.length === 0) {
      qb.andWhere('1 = 0');
    }

    if (query.userId) {
      qb.andWhere('post.user_id = :userId', { userId: query.userId });
    }

    if (query.search?.trim()) {
      qb.andWhere('(post.content ILIKE :search OR post.title ILIKE :search)', {
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

    // Pre-fetch user reactions if currentUserId is provided
    const userReactionsMap = new Map<string, ReactionType>();
    if (currentUserId && items.length > 0 && this.postReactionRepo) {
      const itemIds = items.map((p) => p.id);
      try {
        const reactions = await this.postReactionRepo.find({
          where: {
            postId: In(itemIds),
            userId: currentUserId,
          },
          select: { postId: true, reactionType: true },
        });
        for (const r of reactions) {
          userReactionsMap.set(r.postId, r.reactionType);
        }
      } catch {
        // Ignored if reaction table mock issue
      }
    }

    const data = await Promise.all(
      items.map((p) =>
        this.formatPost(p, mentionsMap, userReactionsMap.get(p.id) || null),
      ),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, currentUserId?: string): Promise<FormattedPost> {
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

    let userReaction: ReactionType | null = null;
    if (currentUserId && this.postReactionRepo) {
      try {
        const reaction = await this.postReactionRepo.findOne({
          where: { postId: id, userId: currentUserId },
          select: { reactionType: true },
        });
        if (reaction) {
          userReaction = reaction.reactionType;
        }
      } catch {
        // Ignored if reaction table mock issue
      }
    }

    return this.formatPost(post, undefined, userReaction);
  }

  async remove(
    id: string,
    userId: string,
    isAdmin = false,
    expectedType?: 'post' | 'article',
  ): Promise<{ message: string }> {
    const post = await this.postsRepository.findOne({
      where: { id },
    });

    const isArticle = expectedType === 'article' || (!expectedType && post?.type === 'article');
    const notFoundMsg = isArticle ? this.i18n.t('articles.not_found') : this.i18n.t('posts.not_found');
    const unauthorizedMsg = isArticle ? this.i18n.t('articles.unauthorized') : this.i18n.t('posts.unauthorized');
    const deletedMsg = isArticle ? this.i18n.t('articles.deleted') : this.i18n.t('posts.deleted');

    if (!post) {
      throw new NotFoundException(notFoundMsg);
    }

    if (expectedType && post.type !== expectedType) {
      throw new NotFoundException(notFoundMsg);
    }

    if (post.userId !== userId && !isAdmin) {
      throw new ForbiddenException(unauthorizedMsg);
    }

    // Purge cover image from Cloudflare R2 if present (articles)
    if (post.coverImageUrl) {
      await this.uploadService.deleteFileByUrl(post.coverImageUrl);
    }

    // Purge images and video from Cloudflare R2 upon post/article deletion
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
      message: deletedMsg,
    };
  }

  /**
   * Smartly resolve a book or audiobook from a unified bookId key (or fallback audiobookId).
   * Automatically inspects Books (ebooks) first; if not found, checks Audiobooks.
   * Also auto-links complementary format if available.
   */
  private async resolveBookOrAudiobook(
    bookId?: string | null,
    audiobookId?: string | null,
  ): Promise<{ book: Book | null; audiobook: Audiobook | null }> {
    const rawId = bookId || audiobookId;
    if (!rawId) {
      return { book: null, audiobook: null };
    }

    let book: Book | null = null;
    let audiobook: Audiobook | null = null;

    // 1. Try finding in Books table (E-Book)
    book = await this.booksRepository.findOne({
      where: { id: rawId },
      relations: { audiobooks: true },
    });

    if (book) {
      // It's an E-Book! Auto-link complementary audiobook if available
      const conditions: FindOptionsWhere<Audiobook>[] = [{ bookId: book.id }];
      if (book.author) {
        conditions.push({ title: book.title, author: book.author });
      } else {
        conditions.push({ title: book.title });
      }
      audiobook = await this.audiobooksRepository.findOne({ where: conditions });
      return { book, audiobook };
    }

    // 2. If not found in Books, try finding in Audiobooks table
    audiobook = await this.audiobooksRepository.findOne({
      where: { id: rawId },
      relations: { book: true },
    });

    if (audiobook) {
      // It's an Audiobook! Auto-link complementary e-book if available
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
        book = await this.booksRepository.findOne({ where: conditions });
      }
      return { book, audiobook };
    }

    // 3. Fallback: If both bookId and audiobookId were passed distinctly
    if (bookId && audiobookId && bookId !== audiobookId) {
      book = await this.booksRepository.findOne({ where: { id: bookId } });
      audiobook = await this.audiobooksRepository.findOne({ where: { id: audiobookId } });
    }

    return { book, audiobook };
  }

  /**
   * Resolve category metadata for an article, providing localized displayName, name_ar, and name_en
   */
  private getArticleCategoryMeta(
    categoryId?: string | null,
    categoryName?: string | null,
    lang?: SupportedLanguage,
  ) {
    const currentLang = lang || (this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : 'ar');
    const ARTICLE_CATEGORIES_MAP: { id: string; name_ar: string; name_en: string }[] = [
      { id: '9ad36706-9991-4fc0-a66e-c65c034acf71', name_ar: 'احداث حالية', name_en: 'Current events' },
      { id: '3422405a-c14c-47af-aaf1-75cf49196639', name_ar: 'تاريخ وتراث', name_en: 'History and heritage' },
      { id: '4451e686-627b-4e2f-9745-d5ace26b29e5', name_ar: 'ثقافة وفنون', name_en: 'Culture and arts' },
      { id: '490ac292-16ad-4d1d-bb42-0015a2bb6ce5', name_ar: 'معرفة وتعليم', name_en: 'Knowledge and education' },
      { id: 'bff3eb45-94dc-4e57-917e-fbbc374295d5', name_ar: 'أعمال ومهارات', name_en: 'Business and skills' },
      { id: '1a31fd07-744e-4896-b787-b1d4c96ea222', name_ar: 'تطوير الذات', name_en: 'Self development' },
      { id: '30cae856-e68c-406c-a1b5-791b54e7c775', name_ar: 'مجتمع وحياة', name_en: 'Society and life' },
      { id: '576a9263-cc32-41f0-90a0-240d9797dd22', name_ar: 'مقالات حرة', name_en: 'Free articles' },
      { id: 'c68594ac-6d35-4f70-9766-d801ccee387f', name_ar: 'سفر وأماكن', name_en: 'Travel and places' },
    ];

    const targetId = categoryId?.trim().toLowerCase();
    const targetName = categoryName?.trim().toLowerCase();

    const normalize = (s: string) =>
      s.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim().toLowerCase();

    const matched = ARTICLE_CATEGORIES_MAP.find((c) => {
      if (targetId && c.id.toLowerCase() === targetId) return true;
      if (targetName) {
        if (c.name_ar.toLowerCase() === targetName || normalize(c.name_ar) === normalize(targetName)) return true;
        if (c.name_en.toLowerCase() === targetName) return true;
        if (c.id.toLowerCase() === targetName) return true;
      }
      return false;
    });

    if (matched) {
      const displayName = currentLang === 'en' ? matched.name_en : matched.name_ar;
      return {
        id: matched.id,
        displayName,
        name_ar: matched.name_ar,
        name_en: matched.name_en,
        category: currentLang === 'en' ? 'Articles' : 'المقالات',
        category_ar: 'المقالات',
        category_en: 'Articles',
      };
    }

    if (categoryName || categoryId) {
      const name = categoryName || categoryId || '';
      return {
        id: categoryId || null,
        displayName: name,
        name_ar: name,
        name_en: name,
        category: currentLang === 'en' ? 'Articles' : 'المقالات',
        category_ar: 'المقالات',
        category_en: 'Articles',
      };
    }

    return null;
  }

  async formatPost(
    post: Post,
    preloadedMentions?: Map<string, FormattedMentionUser>,
    userReaction?: ReactionType | null,
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
    const categoryMeta = this.getArticleCategoryMeta(
      post.categoryId,
      post.category,
      currentLang,
    );
    const categoryDetails = categoryMeta || null;
    const resolvedCategory = categoryMeta?.displayName || post.category || null;

    const isArticle = post.type === 'article';

    const rawCounts: any = post.reactionsCount || {};
    const totalReactions =
      rawCounts.total !== undefined && !isNaN(Number(rawCounts.total))
        ? Number(rawCounts.total)
        : post.likesCount || 0;

    const reactionsCount: PostReactionsCount = {
      total: totalReactions,
      agree: Number(rawCounts.agree) || 0,
      love: Number(rawCounts.love) || 0,
      applaud: Number(rawCounts.applaud) || 0,
      insightful: Number(rawCounts.insightful) || 0,
      disagree: Number(rawCounts.disagree) || 0,
    };

    const reactionKeys: ReactionType[] = [
      'agree',
      'love',
      'applaud',
      'insightful',
      'disagree',
    ];
    const topReactions = reactionKeys
      .filter((k) => (reactionsCount[k] || 0) > 0)
      .sort((a, b) => (reactionsCount[b] || 0) - (reactionsCount[a] || 0))
      .slice(0, 3);

    const formatted: FormattedPost = {
      id: post.id,
      type: post.type,
      ...(isArticle
        ? {
            title: post.title || null,
            coverImageUrl: post.coverImageUrl || null,
            category: resolvedCategory,
            categoryId: post.categoryId || categoryMeta?.id || null,
            categoryDetails,
            agreeToTerms: true,
          }
        : {}),
      content: post.content,
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
      likesCount: reactionsCount.total,
      reactionsCount,
      topReactions,
      userReaction: userReaction ?? null,
      commentsCount: post.commentsCount || 0,
      sharesCount: post.sharesCount || 0,
      bookmarksCount: post.bookmarksCount || 0,
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

