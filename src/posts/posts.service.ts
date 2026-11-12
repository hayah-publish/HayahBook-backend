import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnauthorizedException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  Repository,
  FindOptionsWhere,
  SelectQueryBuilder,
  DataSource,
} from 'typeorm';
import { Post } from './post.entity';
import {
  PostReaction,
  ReactionType,
  PostReactionsCount,
} from './post-reaction.entity';
import { PostReport } from './post-report.entity';
import { UserHiddenPost } from './user-hidden-post.entity';
import { User } from '../users/user.entity';
import { UserUserFollow } from '../users/user-user-follow.entity';
import { UserBlock } from '../users/user-block.entity';
import { UserBookmark } from '../bookmarks/bookmark.entity';
import { Book } from '../books/book.entity';
import { Audiobook } from '../books/audiobook.entity';
import { UserBookExcerpt } from '../books/user-book-excerpt.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ReportPostDto } from './dto/report-post.dto';
import { PostsQueryDto } from './dto/posts-query.dto';
import { ReactionsQueryDto } from './dto/reactions-query.dto';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';
import { UploadService } from '../upload/upload.service';
import { UploadFile } from '../upload/upload-file.interface';
import { InterestsService } from '../interests/interests.service';
import { countWords } from './validators/word-count.validator';
import { sanitizeMarkdown } from './utils/markdown-sanitizer.util';

export interface FormattedPostPublisher {
  id: string;
  name: string;
  profileUrl: string | null;
  role: string;
  isFollowing?: boolean;
}
export type FormattedPostAuthor = FormattedPostPublisher;

export interface PostMenuAction {
  key: string;
  title: string;
  titleAr?: string;
  titleEn?: string;
  icon: string;
  isDestructive?: boolean;
  isActive?: boolean;
  isSaved?: boolean;
  commentsDisabled?: boolean;
  actionType:
    | 'user_action'
    | 'client_clipboard'
    | 'post_action'
    | 'share'
    | 'feed_action'
    | 'report_modal';
  targetUserId?: string;
  endpoint?: string;
  method?: string;
  shareUrl?: string;
  reportReasonsEndpoint?: string;
}

export interface PostPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canShare: boolean;
  canSave: boolean;
  canReport: boolean;
  canBlock: boolean;
  canViewLess: boolean;
  canToggleComments: boolean;
}

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
  type: 'post' | 'article' | 'snippet' | 'visual';
  contentFormat?: string;
  title?: string | null;
  coverImageUrl?: string | null;
  category?: string | null;
  categoryId?: string | null;
  categoryDetails?: any;
  agreeToTerms?: boolean;
  content: string;
  quote?: string | null;
  excerpt?: {
    id: string;
    content: string;
    chapter: string | null;
    pageNumber: number | null;
    cfiRange: string | null;
  } | null;
  images: string[];
  videoUrl: string | null;
  containVideo: boolean;
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
  isOwner?: boolean;
  isSaved?: boolean;
  isFollowingAuthor?: boolean;
  commentsDisabled?: boolean;
  shareUrl?: string;
  permissions?: PostPermissions;
  menuActions?: PostMenuAction[];
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
    @Optional()
    @InjectRepository(PostReport)
    private readonly postReportRepo?: Repository<PostReport>,
    @Optional()
    @InjectRepository(UserHiddenPost)
    private readonly userHiddenPostRepo?: Repository<UserHiddenPost>,
    @Optional()
    @InjectRepository(UserBlock)
    private readonly userBlockRepo?: Repository<UserBlock>,
    @Optional()
    @InjectRepository(UserBookmark)
    private readonly bookmarkRepo?: Repository<UserBookmark>,
    @Optional()
    @InjectRepository(UserBookExcerpt)
    private readonly excerptsRepository?: Repository<UserBookExcerpt>,
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

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
   * Retrieve keyword list from user interests (names and categories) to personalize the "For You" feed
   */
  async getUserInterestKeywords(userId?: string): Promise<string[]> {
    if (!userId || !this.dataSource) return [];
    try {
      const rows: Array<{
        name?: string;
        name_ar?: string;
        name_en?: string;
        category?: string;
        category_ar?: string;
        category_en?: string;
      }> = await this.dataSource.query(
        `SELECT i.name, i.name_ar, i.name_en, i.category, i.category_ar, i.category_en
         FROM user_interests ui
         JOIN interests i ON i.id = ui.interest_id
         WHERE ui.user_id = $1`,
        [userId],
      );
      const keywords = new Set<string>();
      for (const r of rows || []) {
        for (const val of [
          r.name,
          r.name_ar,
          r.name_en,
          r.category,
          r.category_ar,
          r.category_en,
        ]) {
          if (val && typeof val === 'string' && val.trim().length > 1) {
            keywords.add(val.trim().toLowerCase());
          }
        }
      }
      return Array.from(keywords);
    } catch {
      return [];
    }
  }

  /**
   * Normalize input reaction string from English or Arabic into standard canonical ReactionType
   */
  normalizeReactionType(input?: string): ReactionType | null {
    if (!input) return null;
    const val = input.trim().toLowerCase();

    if (
      val === 'agree' ||
      val === 'اتفق' ||
      val === 'اتفاق' ||
      val === 'like'
    ) {
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
  getReactionLabels(type: ReactionType): {
    ar: string;
    en: string;
    icon: string;
  } {
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
    const targetType = this.normalizeReactionType(reactionInput);
    if (!targetType) {
      throw new BadRequestException(this.i18n.t('reactions.invalid_type'));
    }
    await this.assertNoBlockBetween(
      userId,
      (
        await this.postsRepository.findOne({
          where: { id: postId },
          select: { userId: true },
        })
      )?.userId ?? '',
    );

    const runInTx = this.postsRepository.manager?.transaction
      ? (cb: (mgr: any) => Promise<any>) =>
          this.postsRepository.manager.transaction(cb)
      : (cb: (mgr: any) => Promise<any>) =>
          cb({
            getRepository: (entity: any) => {
              if (entity === Post) return this.postsRepository;
              return this.postReactionRepo;
            },
          });

    return runInTx(async (manager: any) => {
      const posts = manager.getRepository(Post);
      const reactions = manager.getRepository(PostReaction);
      const post = await posts.findOne({
        where: { id: postId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post) throw new NotFoundException(this.i18n.t('posts.not_found'));

      const existing = await reactions.findOne({ where: { postId, userId } });
      const raw = post.reactionsCount || ({} as PostReactionsCount);
      const counts: PostReactionsCount = {
        total: Number(raw.total ?? post.likesCount ?? 0),
        agree: Number(raw.agree ?? 0),
        love: Number(raw.love ?? 0),
        applaud: Number(raw.applaud ?? 0),
        insightful: Number(raw.insightful ?? 0),
        disagree: Number(raw.disagree ?? 0),
      };
      let action: 'added' | 'updated' | 'removed';
      let userReaction: ReactionType | null;
      let messageKey: string;

      if (!existing) {
        action = 'added';
        userReaction = targetType;
        messageKey = 'reactions.added';
        await reactions.save(
          reactions.create({ userId, postId, reactionType: targetType }),
        );
        counts[targetType] += 1;
        counts.total += 1;
      } else if (existing.reactionType === targetType) {
        action = 'removed';
        userReaction = null;
        messageKey = 'reactions.removed';
        await reactions.delete({ id: existing.id });
        counts[targetType] = Math.max(0, counts[targetType] - 1);
        counts.total = Math.max(0, counts.total - 1);
      } else {
        action = 'updated';
        userReaction = targetType;
        messageKey = 'reactions.updated';
        const prevType = existing.reactionType as ReactionType;
        counts[prevType] = Math.max(0, counts[prevType] - 1);
        counts[targetType] += 1;
        existing.reactionType = targetType;
        await reactions.save(existing);
      }

      post.reactionsCount = counts;
      post.likesCount = counts.total;
      await posts.save(post);
      return {
        message: this.i18n.t(messageKey),
        action,
        userReaction,
        reactionsCount: counts,
        topReactions: (
          [
            'agree',
            'love',
            'applaud',
            'insightful',
            'disagree',
          ] as ReactionType[]
        )
          .filter((key) => counts[key] > 0)
          .sort((a, b) => counts[b] - counts[a])
          .slice(0, 3),
      };
    });
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
    await this.assertNoBlockBetween(
      userId,
      (
        await this.postsRepository.findOne({
          where: { id: postId },
          select: { userId: true },
        })
      )?.userId ?? '',
    );
    const runInTx = this.postsRepository.manager?.transaction
      ? (cb: (mgr: any) => Promise<any>) =>
          this.postsRepository.manager.transaction(cb)
      : (cb: (mgr: any) => Promise<any>) =>
          cb({
            getRepository: (entity: any) => {
              if (entity === Post) return this.postsRepository;
              return this.postReactionRepo;
            },
          });

    return runInTx(async (manager: any) => {
      const posts = manager.getRepository(Post);
      const reactions = manager.getRepository(PostReaction);
      const post = await posts.findOne({
        where: { id: postId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!post) throw new NotFoundException(this.i18n.t('posts.not_found'));
      const existing = await reactions.findOne({ where: { postId, userId } });
      const raw = post.reactionsCount || ({} as PostReactionsCount);
      const counts: PostReactionsCount = {
        total: Number(raw.total ?? post.likesCount ?? 0),
        agree: Number(raw.agree ?? 0),
        love: Number(raw.love ?? 0),
        applaud: Number(raw.applaud ?? 0),
        insightful: Number(raw.insightful ?? 0),
        disagree: Number(raw.disagree ?? 0),
      };
      if (existing) {
        await reactions.delete({ id: existing.id });
        const prevType = existing.reactionType as ReactionType;
        counts[prevType] = Math.max(0, counts[prevType] - 1);
        counts.total = Math.max(0, counts.total - 1);
        post.reactionsCount = counts;
        post.likesCount = counts.total;
        await posts.save(post);
      }
      return {
        message: this.i18n.t('reactions.removed'),
        action: 'removed' as const,
        userReaction: null,
        reactionsCount: counts,
        topReactions: (
          [
            'agree',
            'love',
            'applaud',
            'insightful',
            'disagree',
          ] as ReactionType[]
        )
          .filter((key) => counts[key] > 0)
          .sort((a, b) => counts[b] - counts[a])
          .slice(0, 3),
      };
    });
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
    if (currentUserId)
      await this.assertNoBlockBetween(currentUserId, post.userId);

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
            where: {
              followerId: currentUserId,
              followingId: In(targetUserIds),
            },
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
          isVerified: Boolean(
            (i.user as any)?.isVerified ||
            i.user?.role === 'admin' ||
            i.user?.userType === 'Author',
          ),
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
      throw new BadRequestException(
        'Articles must be created through the articles endpoint',
      );
    }
    const imageFiles = (files || []).filter(
      (f) =>
        f.mimetype.startsWith('image/') ||
        f.fieldname === 'images' ||
        f.fieldname === 'image',
    );
    const videoFiles = (files || []).filter(
      (f) => f.mimetype.startsWith('video/') || f.fieldname === 'video',
    );

    for (const f of files || []) {
      if (
        !f.mimetype.startsWith('image/') &&
        !f.mimetype.startsWith('video/')
      ) {
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
      throw new BadRequestException(this.i18n.t('upload.video_limit_exceeded'));
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
      throw new BadRequestException(this.i18n.t('posts.content_required'));
    }

    if (hasText) {
      const wordCount = countWords(trimmedContent);
      if (wordCount < 1) {
        throw new BadRequestException(this.i18n.t('posts.min_words_required'));
      }
      if (wordCount > 500) {
        throw new BadRequestException(this.i18n.t('posts.max_words_exceeded'));
      }
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
        const uploadRes = await this.uploadService.uploadPostImages(
          userId,
          imageFiles,
        );
        uploadedImageUrls.push(...uploadRes.urls);
      }
      const finalImages = [...(dto.images || []), ...uploadedImageUrls];

      let finalVideoUrl = dto.videoUrl || null;
      if (videoFiles.length > 0) {
        const uploadRes = await this.uploadService.uploadPostVideo(
          userId,
          videoFiles[0],
        );
        finalVideoUrl = uploadedVideoUrl = uploadRes.videoUrl;
      }

      const containVideo = Boolean(
        (finalVideoUrl && finalVideoUrl.trim()) || dto.containVideo,
      );

      const post = this.postsRepository.create({
        userId,
        type: dto.type || 'post',
        contentFormat: 'plain',
        content: processedContent,
        images: finalImages,
        videoUrl: finalVideoUrl,
        containVideo,
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
        ...uploadedImageUrls.map((url) =>
          this.uploadService.deleteFileByUrl(url),
        ),
        ...(uploadedVideoUrl
          ? [this.uploadService.deleteFileByUrl(uploadedVideoUrl)]
          : []),
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

    const wordCount = countWords(dto.content);
    if (wordCount < 501) {
      throw new BadRequestException(this.i18n.t('articles.min_words_required'));
    }
    if (wordCount > 5000) {
      throw new BadRequestException(this.i18n.t('articles.max_words_exceeded'));
    }

    // 4. Category validation (إجباري)
    const categoryInput = (dto.categoryId || dto.category || '').trim();
    if (!categoryInput) {
      throw new BadRequestException(this.i18n.t('articles.category_required'));
    }

    let finalCategory = dto.category?.trim() || null;
    let finalCategoryId = dto.categoryId || null;

    if (this.interestsService) {
      const validCategories =
        await this.interestsService.getArticleCategories();
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
    const coverFile =
      files?.find(
        (f) =>
          f.fieldname === 'cover' ||
          f.fieldname === 'coverImage' ||
          f.fieldname === 'cover_image' ||
          f.fieldname === 'mainImage' ||
          f.fieldname === 'main_image',
      ) ||
      (files?.length === 1 &&
      files[0].mimetype.startsWith('image/') &&
      files[0].fieldname !== 'images' &&
      files[0].fieldname !== 'image'
        ? files[0]
        : undefined);

    let finalCoverUrl =
      (typeof dto.cover === 'string' && dto.cover.trim().startsWith('http')
        ? dto.cover.trim()
        : null) ||
      (typeof dto.coverImage === 'string' &&
      dto.coverImage.trim().startsWith('http')
        ? dto.coverImage.trim()
        : null) ||
      dto.coverImageUrl ||
      dto.coverUrl ||
      null;

    if (!coverFile && !finalCoverUrl) {
      throw new BadRequestException(this.i18n.t('articles.cover_required'));
    }

    const remainingFiles = files ? files.filter((f) => f !== coverFile) : [];
    const imageFiles = remainingFiles.filter((f) =>
      f.mimetype.startsWith('image/'),
    );
    const videoFiles = remainingFiles.filter((f) =>
      f.mimetype.startsWith('video/'),
    );

    if (imageFiles.length > 10) {
      throw new BadRequestException(
        this.i18n.t('upload.images_limit_exceeded'),
      );
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
    const sanitizedContent = sanitizeMarkdown(dto.content);
    const processedContent = this.formatContentWithLinks(
      sanitizedContent,
      explicitLinks,
    );

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
        const coverUpload = await this.uploadService.uploadArticleCover(
          userId,
          coverFile,
        );
        finalCoverUrl = coverUpload.url;
        uploadedUrlsToCleanup.push(finalCoverUrl);
      }

      const uploadedImageUrls: string[] = [];
      if (imageFiles.length > 0) {
        const uploadRes = await this.uploadService.uploadPostImages(
          userId,
          imageFiles,
        );
        uploadedImageUrls.push(...uploadRes.urls);
        uploadedUrlsToCleanup.push(...uploadRes.urls);
      }
      const finalImages = [...(dto.images || []), ...uploadedImageUrls];

      let finalVideoUrl = dto.videoUrl || null;
      if (videoFiles.length > 0) {
        const uploadRes = await this.uploadService.uploadPostVideo(
          userId,
          videoFiles[0],
        );
        finalVideoUrl = uploadRes.videoUrl;
        uploadedUrlsToCleanup.push(finalVideoUrl);
      }

      const containVideo = Boolean(
        (finalVideoUrl && finalVideoUrl.trim()) || dto.containVideo,
      );

      const post = this.postsRepository.create({
        userId,
        type: 'article',
        contentFormat: 'markdown',
        title,
        coverImageUrl: finalCoverUrl,
        category: finalCategory,
        categoryId: finalCategoryId,
        content: processedContent,
        images: finalImages,
        videoUrl: finalVideoUrl,
        containVideo,
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
      await Promise.all(
        uploadedUrlsToCleanup.map((url) =>
          this.uploadService.deleteFileByUrl(url),
        ),
      );
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
   * Create and publish a snippet (مقتطف منشور للعامة في الملف الشخصي)
   * Supports:
   * 1. Publishing from an existing private excerpt via `excerptId`
   * 2. Publishing directly with `quote` and optional `bookId`
   * 3. Optional user commentary / note (`content`)
   * 4. Toggle `showBookDetails` (default true)
   */
  async createSnippet(
    userId: string,
    dto: {
      excerptId?: string;
      bookId?: string;
      content?: string;
      quote?: string;
      showBookDetails?: boolean;
      quoteCategory?: string;
    },
  ): Promise<{ message: string; data: FormattedPost }> {
    let bookId = dto.bookId || null;
    let quoteText = dto.quote?.trim() || '';
    let excerptEntity: UserBookExcerpt | null = null;

    if (dto.excerptId) {
      if (this.excerptsRepository) {
        excerptEntity = await this.excerptsRepository.findOne({
          where: { id: dto.excerptId },
          relations: { book: true },
        });
      }
      if (!excerptEntity) {
        throw new NotFoundException(
          this.i18n?.t ? this.i18n.t('excerpts.not_found') : 'Excerpt not found',
        );
      }
      if (excerptEntity.userId !== userId) {
        throw new ForbiddenException(
          this.i18n?.t ? this.i18n.t('aliases.not_owned') : 'Forbidden',
        );
      }
      bookId = excerptEntity.bookId;
      if (!quoteText) quoteText = excerptEntity.content;
    }

    const finalContent = dto.content?.trim() || quoteText;
    if (!finalContent && !quoteText) {
      throw new BadRequestException(
        this.i18n?.t ? this.i18n.t('snippets.quote_required') : 'Snippet quote is required',
      );
    }

    let resolvedBook: Book | null = null;
    const showBook = dto.showBookDetails !== false;
    if (showBook && bookId) {
      resolvedBook = await this.booksRepository.findOne({ where: { id: bookId } });
    }

    // Resolve quote category
    let resolvedCategory = 'المقتطفات';
    let resolvedCategoryId: string | null = null;
    if (dto.quoteCategory) {
      const catMeta = this.resolveQuoteCategory(dto.quoteCategory);
      if (catMeta) {
        resolvedCategory = catMeta.name_ar;
        resolvedCategoryId = catMeta.id;
      }
    }

    const post = this.postsRepository.create({
      userId,
      type: 'snippet',
      content: finalContent,
      contentFormat: 'plain',
      bookId: showBook ? bookId : null,
      excerptId: excerptEntity?.id || null,
      category: resolvedCategory,
      categoryId: resolvedCategoryId,
    });

    const saved = await this.postsRepository.save(post);

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    saved.user = user!;
    saved.book = resolvedBook;
    saved.excerpt = excerptEntity;

    const formatted = await this.formatPost(saved, undefined, null, userId);

    return {
      message: this.i18n?.t ? this.i18n.t('snippets.published') : 'تم نشر المقتطف في ملفك الشخصي بنجاح',
      data: formatted,
    };
  }

  /**
   * Quote categories map for the Quotes discovery feed.
   * Used for filtering tabs: All, Romantic, Psychological, Motivation, Sadness, etc.
   */
  static readonly QUOTE_CATEGORIES_MAP: {
    id: string;
    name_ar: string;
    name_en: string;
  }[] = [
    { id: 'f1a2b3c4-d5e6-47f8-a9b0-c1d2e3f4a5b6', name_ar: 'رومانسي', name_en: 'Romantic' },
    { id: 'a2b3c4d5-e6f7-48a9-b0c1-d2e3f4a5b6c7', name_ar: 'نفسي', name_en: 'Psychological' },
    { id: 'b3c4d5e6-f7a8-49b0-c1d2-e3f4a5b6c7d8', name_ar: 'تحفيزي', name_en: 'Motivation' },
    { id: 'c4d5e6f7-a8b9-40c1-d2e3-f4a5b6c7d8e9', name_ar: 'حزين', name_en: 'Sadness' },
    { id: 'd5e6f7a8-b9c0-41d2-e3f4-a5b6c7d8e9f0', name_ar: 'ديني', name_en: 'Religious' },
    { id: 'e6f7a8b9-c0d1-42e3-f4a5-b6c7d8e9f0a1', name_ar: 'فلسفي', name_en: 'Philosophical' },
    { id: 'f7a8b9c0-d1e2-43f4-a5b6-c7d8e9f0a1b2', name_ar: 'أدبي', name_en: 'Literary' },
    { id: 'a8b9c0d1-e2f3-44a5-b6c7-d8e9f0a1b2c3', name_ar: 'ملهم', name_en: 'Inspiring' },
    { id: 'b9c0d1e2-f3a4-45b6-c7d8-e9f0a1b2c3d4', name_ar: 'حكم وأمثال', name_en: 'Proverbs' },
    { id: 'c0d1e2f3-a4b5-46c7-d8e9-f0a1b2c3d4e5', name_ar: 'اجتماعي', name_en: 'Social' },
  ];

  /**
   * Resolve quote category from input (id, name_ar, or name_en)
   */
  private resolveQuoteCategory(
    input: string,
  ): { id: string; name_ar: string; name_en: string } | null {
    const val = input.trim().toLowerCase();
    const normalize = (s: string) =>
      s
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();

    return (
      PostsService.QUOTE_CATEGORIES_MAP.find((c) => {
        if (c.id.toLowerCase() === val) return true;
        if (c.name_ar.toLowerCase() === val || normalize(c.name_ar) === normalize(val)) return true;
        if (c.name_en.toLowerCase() === val) return true;
        return false;
      }) || null
    );
  }

  /**
   * Get all available quote categories with localized labels
   */
  getQuoteCategories(lang?: string): {
    data: Array<{
      id: string;
      name: string;
      nameAr: string;
      nameEn: string;
    }>;
  } {
    const currentLang = lang || (this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : 'ar');
    const data = PostsService.QUOTE_CATEGORIES_MAP.map((c) => ({
      id: c.id,
      name: currentLang === 'en' ? c.name_en : c.name_ar,
      nameAr: c.name_ar,
      nameEn: c.name_en,
    }));
    return { data };
  }

  /**
   * Public Quotes discovery feed.
   * Returns all published snippets from all users, with category filtering.
   */
  async getQuotesFeed(
    query: PostsQueryDto,
    currentUserId?: string,
  ): Promise<{
    categories: Array<{ id: string; name: string; nameAr: string; nameEn: string }>;
    data: FormattedPost[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    // Build enriched query for snippets type
    const enrichedQuery = Object.assign({}, query, { type: 'snippet' as const });

    // If category filter provided, resolve it to match the stored value
    if (query.category?.trim()) {
      const catMeta = this.resolveQuoteCategory(query.category.trim());
      if (catMeta) {
        enrichedQuery.category = catMeta.name_ar;
      }
    }

    const result = await this.findAll(enrichedQuery, currentUserId);
    const currentLang = this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : 'ar';
    const categories = PostsService.QUOTE_CATEGORIES_MAP.map((c) => ({
      id: c.id,
      name: currentLang === 'en' ? c.name_en : c.name_ar,
      nameAr: c.name_ar,
      nameEn: c.name_en,
    }));

    return {
      categories,
      ...result,
    };
  }

  /**
   * Normalize input tab string from English or Arabic into standard canonical tab key
   */
  normalizeFeedType(
    input?: string,
  ): 'all' | 'posts' | 'articles' | 'visuals' | 'snippets' {
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
        "(post.type = 'visual' OR post.contain_video = TRUE OR (post.video_url IS NOT NULL AND post.video_url != '') OR post.category ILIKE '%مرئيات%' OR post.category ILIKE '%visual%')",
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

    const qb = this.postsRepository
      .createQueryBuilder('post')
      .select('COUNT(*)', 'all')
      .addSelect(`COUNT(*) FILTER (WHERE post.type = 'post')`, 'posts')
      .addSelect(`COUNT(*) FILTER (WHERE post.type = 'article')`, 'articles')
      .addSelect(
        `COUNT(*) FILTER (WHERE post.type = 'visual' OR post.contain_video = TRUE OR post.video_url IS NOT NULL OR LOWER(COALESCE(post.category, '')) LIKE '%مرئيات%' OR LOWER(COALESCE(post.category, '')) LIKE '%visual%')`,
        'visuals',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE post.type = 'snippet' OR LOWER(COALESCE(post.category, '')) LIKE '%مقتطف%' OR LOWER(COALESCE(post.category, '')) LIKE '%snippet%' OR LOWER(COALESCE(post.category, '')) LIKE '%اقتباس%')`,
        'snippets',
      );

    if (Array.isArray(filterUserIds) && filterUserIds.length > 0) {
      qb.where('post.user_id IN (:...filterUserIds)', { filterUserIds });
    }

    const counts = (await qb.getRawOne()) ?? {};

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
    const isFollowing = query.following === true || query.scope === 'following';

    if (!currentUserId) {
      throw new UnauthorizedException(
        this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
      );
    }

    let filterUserIds: string[] | undefined = undefined;
    if (isFollowing) {
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
      Object.assign(query, {
        followingUserIds: filterUserIds,
      }),
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
      .leftJoinAndSelect('post.audiobook', 'audiobook')
      .leftJoinAndSelect('post.excerpt', 'excerpt');

    const tab = this.normalizeFeedType(query.type);
    if (tab !== 'all') {
      this.applyFeedTabFilter(qb, tab);
    }

    const isFollowing = query.following === true;
    let followingIds = query.followingUserIds;

    if (isFollowing && !followingIds) {
      if (!currentUserId) {
        throw new UnauthorizedException(
          this.i18n?.t ? this.i18n.t('auth.unauthorized') : 'Unauthorized',
        );
      }
      followingIds = await this.getFollowedUserIds(currentUserId);
    }

    if (
      Array.isArray(followingIds) &&
      followingIds.length > 0
    ) {
      qb.andWhere('post.user_id IN (:...followingUserIds)', {
        followingUserIds: followingIds,
      });
    } else if (
      Array.isArray(followingIds) &&
      followingIds.length === 0
    ) {
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
      qb.andWhere('(post.category ILIKE :cat OR post.category_id = :catId)', {
        cat: `%${query.category.trim()}%`,
        catId: query.category.trim(),
      });
    }

    if (query.containVideo !== undefined) {
      qb.andWhere('post.containVideo = :containVideo', {
        containVideo: query.containVideo,
      });
    }

    if (currentUserId) {
      if (this.userHiddenPostRepo && typeof qb.andWhere === 'function') {
        qb.andWhere(
          `post.id NOT IN (SELECT post_id FROM user_hidden_posts WHERE user_id = :hiddenUserId)`,
          { hiddenUserId: currentUserId },
        );
      }
      if (this.userBlockRepo && typeof qb.andWhere === 'function') {
        qb.andWhere(
          `post.user_id NOT IN (SELECT blocked_id FROM user_blocks WHERE blocker_id = :blockerUserId)`,
          { blockerUserId: currentUserId },
        );
        qb.andWhere(
          `post.user_id NOT IN (SELECT blocker_id FROM user_blocks WHERE blocked_id = :blockedUserId)`,
          { blockedUserId: currentUserId },
        );
      }

      // Personalized smart algorithm applied for both "For You" (following: false)
      // and "Following" (following: true, where content is strictly restricted to followed accounts)
      const interestKeywords =
        await this.getUserInterestKeywords(currentUserId);
      if (
        interestKeywords.length > 0 &&
        typeof (qb as any).addSelect === 'function' &&
        typeof (qb as any).addOrderBy === 'function'
      ) {
        const clauses: string[] = [];
        const params: Record<string, string> = {};
        interestKeywords.slice(0, 10).forEach((kw, i) => {
          params[`ikw_${i}`] = `%${kw}%`;
          clauses.push(`post.category ILIKE :ikw_${i}`);
          clauses.push(`book.category ILIKE :ikw_${i}`);
        });

        if (typeof (qb as any).setParameters === 'function') {
          const currentParams =
            typeof (qb as any).getParameters === 'function'
              ? (qb as any).getParameters()
              : {};
          (qb as any).setParameters({ ...currentParams, ...params });
        }

        (qb as any).addSelect(
          `(CASE WHEN (${clauses.join(' OR ')}) THEN 1 ELSE 0 END)`,
          'interest_match',
        );
        qb.orderBy('interest_match', 'DESC');
        (qb as any).addOrderBy('post.createdAt', 'DESC');
      } else {
        qb.orderBy('post.createdAt', 'DESC');
      }
    } else {
      qb.orderBy('post.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Pre-fetch all mentions in a single batch query to eliminate N+1 overhead
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const allMentionIds = Array.from(
      new Set(
        items
          .flatMap((p) => (Array.isArray(p.mentions) ? p.mentions : []))
          .filter((id) => typeof id === 'string' && uuidRegex.test(id)),
      ),
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

    // Pre-fetch user reactions, bookmarks, and followed publishers if currentUserId is provided
    const userReactionsMap = new Map<string, ReactionType>();
    const savedPostIds = new Set<string>();
    const followedUserIds = new Set<string>();

    if (currentUserId && items.length > 0) {
      const itemIds = items.map((p) => p.id);
      if (this.postReactionRepo) {
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

      if (this.bookmarkRepo) {
        try {
          const bookmarks = await this.bookmarkRepo.find({
            where: { userId: currentUserId, postId: In(itemIds) },
            select: { postId: true },
          });
          bookmarks.forEach((b) => savedPostIds.add(b.postId));
        } catch {
          // Ignored
        }
      }

      try {
        const followed = await this.getFollowedUserIds(currentUserId);
        followed.forEach((id) => followedUserIds.add(id));
      } catch {
        // Ignored
      }
    }

    const data = await Promise.all(
      items.map((p) =>
        this.formatPost(
          p,
          mentionsMap,
          userReactionsMap.get(p.id) || null,
          currentUserId,
          savedPostIds,
          followedUserIds,
        ),
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
    const resolvedId = this.decodePostId(id);
    let post: Post | null = null;
    try {
      post = await this.postsRepository.findOne({
        where: { id: resolvedId },
        relations: {
          user: true,
          book: true,
          audiobook: true,
          excerpt: true,
        },
      });
    } catch {
      post = null;
    }

    if (!post) {
      const match = id.match(/([0-9a-f]{8})$/i);
      if (
        match &&
        typeof this.postsRepository.createQueryBuilder === 'function'
      ) {
        try {
          post = await this.postsRepository
            .createQueryBuilder('post')
            .leftJoinAndSelect('post.user', 'user')
            .leftJoinAndSelect('post.book', 'book')
            .leftJoinAndSelect('post.audiobook', 'audiobook')
            .leftJoinAndSelect('post.excerpt', 'excerpt')
            .where('post.id::text LIKE :prefix', {
              prefix: `${match[1].toLowerCase()}%`,
            })
            .getOne();
        } catch {
          post = null;
        }
      }
    }

    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }
    if (currentUserId)
      await this.assertNoBlockBetween(currentUserId, post.userId);

    let userReaction: ReactionType | null = null;
    let isSaved = false;
    let isFollowing = false;

    if (currentUserId) {
      if (this.postReactionRepo) {
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

      isSaved = await this.isPostSaved(id, currentUserId);
      isFollowing = await this.isFollowingUser(currentUserId, post.userId);
    }

    const savedSet = new Set<string>(isSaved ? [id] : []);
    const followedSet = new Set<string>(isFollowing ? [post.userId] : []);

    return this.formatPost(
      post,
      undefined,
      userReaction,
      currentUserId,
      savedSet,
      followedSet,
    );
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

    const isArticle =
      expectedType === 'article' || (!expectedType && post?.type === 'article');
    const notFoundMsg = isArticle
      ? this.i18n.t('articles.not_found')
      : this.i18n.t('posts.not_found');
    const unauthorizedMsg = isArticle
      ? this.i18n.t('articles.unauthorized')
      : this.i18n.t('posts.unauthorized');
    const deletedMsg = isArticle
      ? this.i18n.t('articles.deleted')
      : this.i18n.t('posts.deleted');

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
      audiobook = await this.audiobooksRepository.findOne({
        where: conditions,
      });
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
      audiobook = await this.audiobooksRepository.findOne({
        where: { id: audiobookId },
      });
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
    const currentLang =
      lang ||
      (this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : 'ar');
    const ARTICLE_CATEGORIES_MAP: {
      id: string;
      name_ar: string;
      name_en: string;
    }[] = [
      {
        id: '9ad36706-9991-4fc0-a66e-c65c034acf71',
        name_ar: 'احداث حالية',
        name_en: 'Current events',
      },
      {
        id: '3422405a-c14c-47af-aaf1-75cf49196639',
        name_ar: 'تاريخ وتراث',
        name_en: 'History and heritage',
      },
      {
        id: '4451e686-627b-4e2f-9745-d5ace26b29e5',
        name_ar: 'ثقافة وفنون',
        name_en: 'Culture and arts',
      },
      {
        id: '490ac292-16ad-4d1d-bb42-0015a2bb6ce5',
        name_ar: 'معرفة وتعليم',
        name_en: 'Knowledge and education',
      },
      {
        id: 'bff3eb45-94dc-4e57-917e-fbbc374295d5',
        name_ar: 'أعمال ومهارات',
        name_en: 'Business and skills',
      },
      {
        id: '1a31fd07-744e-4896-b787-b1d4c96ea222',
        name_ar: 'تطوير الذات',
        name_en: 'Self development',
      },
      {
        id: '30cae856-e68c-406c-a1b5-791b54e7c775',
        name_ar: 'مجتمع وحياة',
        name_en: 'Society and life',
      },
      {
        id: '576a9263-cc32-41f0-90a0-240d9797dd22',
        name_ar: 'مقالات حرة',
        name_en: 'Free articles',
      },
      {
        id: 'c68594ac-6d35-4f70-9766-d801ccee387f',
        name_ar: 'سفر وأماكن',
        name_en: 'Travel and places',
      },
    ];

    const targetId = categoryId?.trim().toLowerCase();
    const targetName = categoryName?.trim().toLowerCase();

    const normalize = (s: string) =>
      s
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();

    const matched = ARTICLE_CATEGORIES_MAP.find((c) => {
      if (targetId && c.id.toLowerCase() === targetId) return true;
      if (targetName) {
        if (
          c.name_ar.toLowerCase() === targetName ||
          normalize(c.name_ar) === normalize(targetName)
        )
          return true;
        if (c.name_en.toLowerCase() === targetName) return true;
        if (c.id.toLowerCase() === targetName) return true;
      }
      return false;
    });

    if (matched) {
      const displayName =
        currentLang === 'en' ? matched.name_en : matched.name_ar;
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
    preloadedMentionsOrUserId?: Map<string, FormattedMentionUser> | string,
    userReaction?: ReactionType | null,
    currentUserIdParam?: string,
    preloadedSaved?: Set<string> | boolean,
    preloadedFollowed?: Set<string>,
  ): Promise<FormattedPost> {
    const preloadedMentions =
      typeof preloadedMentionsOrUserId === 'string'
        ? undefined
        : preloadedMentionsOrUserId;
    const currentUserId =
      currentUserIdParam ??
      (typeof preloadedMentionsOrUserId === 'string'
        ? preloadedMentionsOrUserId
        : undefined);
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
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const validMentionIds = post.mentions.filter(
          (id) => typeof id === 'string' && uuidRegex.test(id),
        );
        if (validMentionIds.length > 0) {
          const users = await this.usersRepository.find({
            where: { id: In(validMentionIds) },
            select: { id: true, name: true, profileUrl: true },
          });
          mentionsUsers = users.map((u) => ({
            id: u.id,
            name: u.name,
            profileUrl: u.profileUrl,
          }));
        }
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
      !allLinks.some((l) => l.url.toLowerCase() === post.linkUrl?.toLowerCase())
    ) {
      allLinks.push({
        url: post.linkUrl,
        title: post.linkTitle,
        displayText: post.linkTitle || post.linkUrl,
      });
    }

    const currentLang = this.i18n?.getCurrentLanguage
      ? this.i18n.getCurrentLanguage()
      : 'ar';
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

    const isOwner = !!(currentUserId && currentUserId === post.userId);
    const commentsDisabled = !!post.commentsDisabled;

    let resolvedUserReaction = userReaction;
    if (
      resolvedUserReaction === undefined &&
      currentUserId &&
      this.postReactionRepo
    ) {
      try {
        const reaction = await this.postReactionRepo.findOne({
          where: { postId: post.id, userId: currentUserId },
          select: { reactionType: true },
        });
        resolvedUserReaction = reaction ? reaction.reactionType : null;
      } catch {
        resolvedUserReaction = null;
      }
    }

    const isSaved = currentUserId
      ? typeof preloadedSaved === 'boolean'
        ? preloadedSaved
        : preloadedSaved
          ? preloadedSaved.has(post.id)
          : await this.isPostSaved(post.id, currentUserId)
      : false;

    const isFollowing = currentUserId
      ? preloadedFollowed
        ? preloadedFollowed.has(post.userId)
        : await this.isFollowingUser(currentUserId, post.userId)
      : false;

    const shareUrl = this.getShareUrl(post.id);

    const permissions: PostPermissions = {
      canEdit: isOwner,
      canDelete: isOwner,
      canShare: !!currentUserId,
      canSave: !!currentUserId,
      canReport: !!currentUserId && !isOwner,
      canBlock: !!currentUserId && !isOwner,
      canViewLess: !!currentUserId && !isOwner,
      canToggleComments: isOwner,
    };

    const menuActions = this.buildMenuActions(
      post,
      currentUserId,
      isOwner,
      isFollowing,
      isSaved,
      commentsDisabled,
      currentLang === 'en' ? 'en' : 'ar',
    );

    const formattedExcerpt = post.excerpt
      ? {
          id: post.excerpt.id,
          content: post.excerpt.content,
          chapter: post.excerpt.chapter ?? null,
          pageNumber: post.excerpt.pageNumber ?? null,
          cfiRange: post.excerpt.cfiRange ?? null,
        }
      : null;

    const formattedQuote =
      post.excerpt?.content ||
      (post.type === 'snippet' ? post.content : null);

    const formatted: FormattedPost = {
      id: post.id,
      type: post.type,
      contentFormat: isArticle ? 'markdown' : post.contentFormat || 'plain',
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
      quote: formattedQuote,
      excerpt: formattedExcerpt,
      images: post.images || [],
      videoUrl: post.videoUrl,
      containVideo: Boolean(
        post.containVideo || (post.videoUrl && post.videoUrl.trim()),
      ),
      link: formattedLink,
      links: allLinks,
      book: formattedBook,
      publisher: {
        id: post.user?.id || post.userId,
        name: post.user?.name || '',
        profileUrl: post.user?.profileUrl || null,
        role: post.user?.role || 'user',
        ...(currentUserId ? { isFollowing } : {}),
      },
      mentions: mentionsUsers,
      likesCount: reactionsCount.total,
      reactionsCount,
      topReactions,
      userReaction: resolvedUserReaction ?? null,
      isOwner,
      isSaved,
      isFollowingAuthor: isFollowing,
      commentsDisabled,
      shareUrl,
      permissions,
      menuActions,
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
      const standaloneUrlRegex = new RegExp(
        `(?<!\\]\\()(?<!href=["'])${escapedUrl}`,
        'g',
      );
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
          const parsed = new URL(
            url.startsWith('http') ? url : `https://${url}`,
          );
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

  private async assertNoBlockBetween(
    userId: string,
    otherUserId: string,
  ): Promise<void> {
    if (!userId || !otherUserId || userId === otherUserId) return;
    const blocks =
      this.userBlockRepo || this.dataSource?.getRepository(UserBlock);
    if (!blocks) return;
    const block = await blocks.findOne({
      where: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
      select: { id: true },
    });
    if (block) throw new NotFoundException(this.i18n.t('posts.not_found'));
  }

  /**
   * Encode UUID to a clean, URL-safe encrypted token (No raw UUID, No explicit words)
   */
  encodePostId(postId: string): string {
    if (!postId) return '';
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        postId,
      );
    if (!isUuid) return postId;
    try {
      const hex = postId.replace(/-/g, '');
      return Buffer.from(hex, 'hex').toString('base64url');
    } catch {
      return postId;
    }
  }

  /**
   * Decode an encrypted token back to the original UUID
   */
  decodePostId(token: string): string {
    if (!token) return token;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        token,
      );
    if (isUuid) return token;

    try {
      const buf = Buffer.from(token, 'base64url');
      if (buf.length === 16) {
        const hex = buf.toString('hex');
        return [
          hex.slice(0, 8),
          hex.slice(8, 12),
          hex.slice(12, 16),
          hex.slice(16, 20),
          hex.slice(20),
        ].join('-');
      }
    } catch {
      // Fallback
    }
    return token;
  }

  /**
   * Generate encrypted share URL without raw UUID and without explicit text
   */
  getShareUrl(postId: string): string {
    const baseUrl =
      this.configService?.get<string>('FRONTEND_URL') ||
      'https://hayahbook.com';
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const token = this.encodePostId(postId);
    return `${cleanBase}/posts/${token}`;
  }

  /**
   * Check if user is following target publisher
   */
  async isFollowingUser(
    followerId: string,
    followingId: string,
  ): Promise<boolean> {
    if (!followerId || !followingId || followerId === followingId) return false;
    if (this.userFollowRepo) {
      try {
        const follow = await this.userFollowRepo.findOne({
          where: { followerId, followingId },
        });
        return !!follow;
      } catch {
        // Ignored
      }
    }
    return false;
  }

  /**
   * Check if a post is bookmarked by user
   */
  async isPostSaved(postId: string, userId: string): Promise<boolean> {
    if (!postId || !userId) return false;
    if (this.bookmarkRepo) {
      try {
        const count = await this.bookmarkRepo.count({
          where: { postId, userId },
        });
        return count > 0;
      } catch {
        // Ignored
      }
    }
    return false;
  }

  /**
   * Build actions list for the 3-dots post options menu based on ownership & follow status
   */
  buildMenuActions(
    post: Post,
    currentUserId?: string,
    isOwner = false,
    isFollowingAuthor = false,
    isSaved = false,
    commentsDisabled = false,
    lang: 'ar' | 'en' = 'ar',
  ): PostMenuAction[] {
    const shareUrl = this.getShareUrl(post.id);
    const publisherName =
      post.user?.name || (lang === 'en' ? 'Author' : 'الناشر');

    if (!currentUserId) {
      return [
        {
          key: 'copy_link',
          title: lang === 'en' ? 'Copy link' : 'نسخ الرابط',
          titleAr: 'نسخ الرابط',
          titleEn: 'Copy link',
          icon: 'link',
          actionType: 'client_clipboard',
          shareUrl,
        },
      ];
    }

    if (isOwner) {
      // Window 3: Owner Menu (تعديل، مشاركة، تعطيل التعليقات، حذف)
      return [
        {
          key: 'edit',
          title: lang === 'en' ? 'Edit' : 'تعديل',
          titleAr: 'تعديل',
          titleEn: 'Edit',
          icon: 'edit',
          actionType: 'post_action',
          endpoint: `/v1/posts/${post.id}`,
          method: 'PATCH',
        },
        {
          key: 'share',
          title: lang === 'en' ? 'Share' : 'مشاركة',
          titleAr: 'مشاركة',
          titleEn: 'Share',
          icon: 'share',
          actionType: 'share',
          endpoint: `/v1/posts/${post.id}/share`,
          method: 'POST',
          shareUrl,
        },
        {
          key: 'disable_comments',
          title: commentsDisabled
            ? lang === 'en'
              ? 'Enable Comments'
              : 'تفعيل التعليقات'
            : lang === 'en'
              ? 'Disable Comments'
              : 'تعطيل التعليقات',
          titleAr: commentsDisabled ? 'تفعيل التعليقات' : 'تعطيل التعليقات',
          titleEn: commentsDisabled ? 'Enable Comments' : 'Disable Comments',
          icon: 'disable_comments',
          commentsDisabled,
          actionType: 'post_action',
          endpoint: `/v1/posts/${post.id}/toggle-comments`,
          method: 'PATCH',
        },
        {
          key: 'delete',
          title: lang === 'en' ? 'Delete' : 'حذف',
          titleAr: 'حذف',
          titleEn: 'Delete',
          icon: 'delete',
          isDestructive: true,
          actionType: 'post_action',
          endpoint: `/v1/posts/${post.id}`,
          method: 'DELETE',
        },
      ];
    }

    // Non-owner menus (Window 1 & Window 2)
    const actions: PostMenuAction[] = [];

    if (isFollowingAuthor) {
      // Window 2: Following Author (إلغاء المتابعة)
      actions.push({
        key: 'unfollow',
        title:
          lang === 'en'
            ? `UnFollow ${publisherName}`
            : `إلغاء متابعة ${publisherName}`,
        titleAr: `إلغاء متابعة ${publisherName}`,
        titleEn: `UnFollow ${publisherName}`,
        icon: 'unfollow',
        actionType: 'user_action',
        targetUserId: post.userId,
        endpoint: `/v1/users/${post.userId}/follow`,
        method: 'DELETE',
      });
    } else {
      // Window 1: Not Following Author (متابعة)
      actions.push({
        key: 'follow',
        title:
          lang === 'en' ? `Follow ${publisherName}` : `متابعة ${publisherName}`,
        titleAr: `متابعة ${publisherName}`,
        titleEn: `Follow ${publisherName}`,
        icon: 'follow',
        actionType: 'user_action',
        targetUserId: post.userId,
        endpoint: `/v1/users/${post.userId}/follow`,
        method: 'POST',
      });
    }

    actions.push(
      {
        key: 'copy_link',
        title: lang === 'en' ? 'Copy link' : 'نسخ الرابط',
        titleAr: 'نسخ الرابط',
        titleEn: 'Copy link',
        icon: 'link',
        actionType: 'client_clipboard',
        shareUrl,
      },
      {
        key: 'save',
        title: isSaved
          ? lang === 'en'
            ? 'Saved'
            : 'محفوظ'
          : lang === 'en'
            ? 'Save'
            : 'حفظ',
        titleAr: isSaved ? 'محفوظ' : 'حفظ',
        titleEn: isSaved ? 'Saved' : 'Save',
        icon: 'bookmark',
        isSaved,
        actionType: 'post_action',
        endpoint: `/v1/bookmarks/${post.id}`,
        method: isSaved ? 'DELETE' : 'POST',
      },
      {
        key: 'share',
        title: lang === 'en' ? 'Share' : 'مشاركة',
        titleAr: 'مشاركة',
        titleEn: 'Share',
        icon: 'share',
        actionType: 'share',
        endpoint: `/v1/posts/${post.id}/share`,
        method: 'POST',
        shareUrl,
      },
      {
        key: 'view_less',
        title: lang === 'en' ? 'View less' : 'عرض محتوى أقل',
        titleAr: 'عرض محتوى أقل',
        titleEn: 'View less',
        icon: 'view_less',
        actionType: 'feed_action',
        endpoint: `/v1/posts/${post.id}/view-less`,
        method: 'POST',
      },
      {
        key: 'block',
        title: lang === 'en' ? 'Block' : 'حظر',
        titleAr: 'حظر',
        titleEn: 'Block',
        icon: 'block',
        isDestructive: true,
        actionType: 'user_action',
        targetUserId: post.userId,
        endpoint: `/v1/users/${post.userId}/block`,
        method: 'POST',
      },
      {
        key: 'report',
        title: lang === 'en' ? 'Report' : 'إبلاغ',
        titleAr: 'إبلاغ',
        titleEn: 'Report',
        icon: 'report',
        isDestructive: true,
        actionType: 'report_modal',
        reportReasonsEndpoint: '/v1/posts/report-reasons',
        endpoint: `/v1/posts/${post.id}/report`,
        method: 'POST',
      },
    );

    return actions;
  }

  /**
   * Get 3-dots post options menu payload matching the design
   */
  async getPostMenu(
    postId: string,
    currentUserId?: string,
    lang?: string,
  ): Promise<{
    postId: string;
    isOwner: boolean;
    isFollowingAuthor: boolean;
    isSaved: boolean;
    commentsDisabled: boolean;
    publisher: {
      id: string;
      name: string;
      profileUrl: string | null;
      role: string;
      isFollowing: boolean;
    };
    menuType: 'owner' | 'non_owner_following' | 'non_owner_not_following';
    actions: PostMenuAction[];
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: { user: true },
    });

    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }
    if (currentUserId)
      await this.assertNoBlockBetween(currentUserId, post.userId);

    const isOwner = !!(currentUserId && currentUserId === post.userId);
    let isFollowingAuthor = false;
    let isSaved = false;

    if (currentUserId) {
      if (!isOwner) {
        isFollowingAuthor = await this.isFollowingUser(
          currentUserId,
          post.userId,
        );
      }
      isSaved = await this.isPostSaved(postId, currentUserId);
    }

    const commentsDisabled = !!post.commentsDisabled;
    const currentLang =
      lang === 'en' ||
      (this.i18n?.getCurrentLanguage && this.i18n.getCurrentLanguage() === 'en')
        ? 'en'
        : 'ar';

    const menuType = isOwner
      ? 'owner'
      : isFollowingAuthor
        ? 'non_owner_following'
        : 'non_owner_not_following';

    const actions = this.buildMenuActions(
      post,
      currentUserId,
      isOwner,
      isFollowingAuthor,
      isSaved,
      commentsDisabled,
      currentLang,
    );

    return {
      postId: post.id,
      isOwner,
      isFollowingAuthor,
      isSaved,
      commentsDisabled,
      publisher: {
        id: post.user?.id || post.userId,
        name: post.user?.name || '',
        profileUrl: post.user?.profileUrl || null,
        role: post.user?.role || 'user',
        isFollowing: isFollowingAuthor,
      },
      menuType,
      actions,
    };
  }

  /**
   * Update an existing post (Owner or admin only)
   */
  async updatePost(
    postId: string,
    userId: string,
    dto: UpdatePostDto,
    files?: UploadFile[],
    isAdmin = false,
  ): Promise<{ message: string; data: FormattedPost }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: { user: true, book: true, audiobook: true },
    });
    if (!post) throw new NotFoundException(this.i18n.t('posts.not_found'));
    if (post.userId !== userId && !isAdmin) {
      throw new ForbiddenException(this.i18n.t('posts.edit_unauthorized'));
    }

    const parseArray = (value: unknown): unknown[] => {
      if (Array.isArray(value)) return value;
      if (typeof value !== 'string') {
        throw new BadRequestException(this.i18n.t('common.bad_request'));
      }
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        /* converted to a client error below */
      }
      throw new BadRequestException(this.i18n.t('common.bad_request'));
    };

    const originalVideoUrl = post.videoUrl;

    if (dto.title !== undefined) post.title = dto.title.trim() || null;
    if (dto.content !== undefined) {
      const trimmedContent = dto.content.trim();
      const wordCount = countWords(trimmedContent);
      if (post.type === 'article') {
        if (wordCount < 501) {
          throw new BadRequestException(
            this.i18n.t('articles.min_words_required'),
          );
        }
        if (wordCount > 5000) {
          throw new BadRequestException(
            this.i18n.t('articles.max_words_exceeded'),
          );
        }
        post.content = sanitizeMarkdown(trimmedContent);
      } else if (trimmedContent.length > 0) {
        if (wordCount < 1) {
          throw new BadRequestException(
            this.i18n.t('posts.min_words_required'),
          );
        }
        if (wordCount > 500) {
          throw new BadRequestException(this.i18n.t('posts.max_words_exceeded'));
        }
        post.content = trimmedContent;
      } else {
        post.content = '';
      }
    }
    if (dto.bookId !== undefined) {
      post.bookId = dto.bookId;
      post.book = dto.bookId
        ? await this.booksRepository.findOne({ where: { id: dto.bookId } })
        : null;
    }
    if (dto.audiobookId !== undefined) {
      post.audiobookId = dto.audiobookId;
      post.audiobook = dto.audiobookId
        ? await this.audiobooksRepository.findOne({
            where: { id: dto.audiobookId },
          })
        : null;
    }
    if (dto.categoryId !== undefined) post.categoryId = dto.categoryId;
    if (dto.category !== undefined) post.category = dto.category;
    if (dto.videoUrl !== undefined) post.videoUrl = dto.videoUrl;
    if (dto.linkUrl !== undefined) post.linkUrl = dto.linkUrl;
    if (dto.linkTitle !== undefined) post.linkTitle = dto.linkTitle;
    if (dto.mentions !== undefined) {
      const mentions = parseArray(dto.mentions);
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (
        mentions.some(
          (item) => typeof item !== 'string' || !uuidRegex.test(item),
        )
      ) {
        throw new BadRequestException(this.i18n.t('common.bad_request'));
      }
      post.mentions = mentions as string[];
    }

    const originalImages = [...(post.images || [])];
    let retainedImages = originalImages;
    if (dto.keepImages !== undefined) {
      const requested = parseArray(dto.keepImages);
      if (
        requested.some(
          (item) => typeof item !== 'string' || !originalImages.includes(item),
        )
      ) {
        throw new BadRequestException(this.i18n.t('common.bad_request'));
      }
      retainedImages = requested as string[];
    }

    const imageFiles = (files || []).filter((f) =>
      f.mimetype.startsWith('image/'),
    );
    const videoFiles = (files || []).filter((f) =>
      f.mimetype.startsWith('video/'),
    );
    if (
      (files || []).length !== imageFiles.length + videoFiles.length ||
      videoFiles.length > 1
    ) {
      throw new BadRequestException(this.i18n.t('upload.invalid_file_type'));
    }

    const uploadedUrls: string[] = [];
    let savedPost: Post;
    try {
      if (imageFiles.length) {
        const result = await this.uploadService.uploadPostImages(
          userId,
          imageFiles,
        );
        uploadedUrls.push(...result.urls);
      }
      if (videoFiles.length) {
        const result = await this.uploadService.uploadPostVideo(
          userId,
          videoFiles[0],
        );
        post.videoUrl = result.videoUrl;
        uploadedUrls.push(result.videoUrl);
      }
      post.images = [
        ...retainedImages,
        ...uploadedUrls.filter(
          (url) => imageFiles.length && url !== post.videoUrl,
        ),
      ];
      if (post.videoUrl && post.videoUrl.trim()) {
        post.containVideo = true;
      } else if (dto.containVideo !== undefined) {
        post.containVideo = Boolean(dto.containVideo);
      } else {
        post.containVideo = false;
      }
      savedPost = await this.postsRepository.save(post);
    } catch (error) {
      await Promise.all(
        uploadedUrls.map((url) => this.uploadService.deleteFileByUrl(url)),
      );
      throw error;
    }

    const formatted = await this.formatPost(savedPost, undefined, null, userId);
    const removedImages = originalImages.filter(
      (url) => !retainedImages.includes(url),
    );
    await Promise.all(
      removedImages.map((url) => this.uploadService.deleteFileByUrl(url)),
    );
    if (
      (videoFiles.length > 0 || dto.videoUrl !== undefined) &&
      originalVideoUrl &&
      originalVideoUrl !== post.videoUrl
    ) {
      await this.uploadService.deleteFileByUrl(originalVideoUrl);
    }
    return { message: this.i18n.t('posts.updated'), data: formatted };
  }

  /**
   * Toggle or set comments disabled status on a post (Owner or admin only)
   */
  async toggleComments(
    postId: string,
    userId: string,
    isAdmin = false,
    desiredStatus?: boolean,
  ): Promise<{ message: string; commentsDisabled: boolean }> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }

    if (post.userId !== userId && !isAdmin) {
      throw new ForbiddenException(
        this.i18n.t('posts.toggle_comments_unauthorized'),
      );
    }

    post.commentsDisabled =
      desiredStatus !== undefined ? desiredStatus : !post.commentsDisabled;
    await this.postsRepository.save(post);

    return {
      message: post.commentsDisabled
        ? this.i18n.t('posts.comments_disabled_success')
        : this.i18n.t('posts.comments_enabled_success'),
      commentsDisabled: post.commentsDisabled,
    };
  }

  /**
   * View less / Hide post: Toggles hide status for caller's feed.
   * If targetState is provided, enforces that state. Otherwise flips current state.
   */
  async viewLessPost(
    postId: string,
    userId: string,
    targetState?: boolean,
  ): Promise<{ message: string; isHidden: boolean }> {
    const post = await this.postsRepository.findOne({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }

    const hiddenRepo =
      this.userHiddenPostRepo || this.dataSource?.getRepository(UserHiddenPost);

    let isCurrentlyHidden = false;
    let existingId: string | null = null;

    if (hiddenRepo && typeof hiddenRepo.findOne === 'function') {
      const existing = await hiddenRepo.findOne({ where: { postId, userId } });
      if (existing) {
        isCurrentlyHidden = true;
        existingId = existing.id;
      }
    }

    const shouldHide =
      targetState !== undefined ? targetState : !isCurrentlyHidden;

    if (shouldHide) {
      if (!isCurrentlyHidden && hiddenRepo) {
        await hiddenRepo
          .createQueryBuilder()
          .insert()
          .into(UserHiddenPost)
          .values({ postId, userId })
          .orIgnore()
          .execute();
      }
      return {
        message: this.i18n.t('posts.hidden_success'),
        isHidden: true,
      };
    } else {
      if (isCurrentlyHidden && hiddenRepo) {
        await hiddenRepo.delete(
          existingId ? { id: existingId } : { postId, userId },
        );
      }
      return {
        message: this.i18n.t('posts.unhidden_success'),
        isHidden: false,
      };
    }
  }

  /**
   * Undo view less
   */
  async unviewLessPost(
    postId: string,
    userId: string,
  ): Promise<{ message: string; isHidden: boolean }> {
    const hiddenRepo =
      this.userHiddenPostRepo || this.dataSource?.getRepository(UserHiddenPost);
    if (hiddenRepo) {
      await hiddenRepo.delete({ postId, userId });
    }

    return {
      message: this.i18n.t('posts.unhidden_success'),
      isHidden: false,
    };
  }

  /**
   * Share a post: increment shares count and return share URL
   */
  async sharePost(postId: string): Promise<{
    message: string;
    sharesCount: number;
    shareUrl: string;
    data: {
      postId: string;
      sharesCount: number;
      shareUrl: string;
    };
  }> {
    const resolvedId = this.decodePostId(postId);
    const post = await this.postsRepository.findOne({
      where: { id: resolvedId },
    });
    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }

    await this.postsRepository.increment({ id: post.id }, 'sharesCount', 1);
    const sharesCount = (post.sharesCount || 0) + 1;
    const shareUrl = this.getShareUrl(post.id);

    return {
      message: this.i18n.t('posts.shared_success'),
      sharesCount,
      shareUrl,
      data: {
        postId: post.id,
        sharesCount,
        shareUrl,
      },
    };
  }

  /**
   * Report reasons definition matching the universal 8 UUIDs
   */
  getReportReasons(lang?: string, meta = false): any {
    const effectiveLang =
      lang === 'ar' || lang === 'en'
        ? lang
        : this.i18n?.getCurrentLanguage
          ? this.i18n.getCurrentLanguage()
          : 'ar';

    const reasons = [
      {
        id: '2f7dc7e9-df71-4fc3-84d0-53f608b75f14',
        key: 'spam',
        displayName: effectiveLang === 'en' ? 'Spam' : 'محتوى غير مرغوب فيه',
        name_ar: 'محتوى غير مرغوب فيه',
        name_en: 'Spam',
      },
      {
        id: '77d40c8a-cc97-42ec-be72-3c02e7db22d3',
        key: 'harassment_or_bullying',
        displayName:
          effectiveLang === 'en' ? 'Harassment or bullying' : 'مضايقة أو تنمر',
        name_ar: 'مضايقة أو تنمر',
        name_en: 'Harassment or bullying',
      },
      {
        id: '25bdb724-c84d-488e-8c88-3d7b15dab543',
        key: 'hate_speech',
        displayName: effectiveLang === 'en' ? 'Hate speech' : 'خطاب كراهية',
        name_ar: 'خطاب كراهية',
        name_en: 'Hate speech',
      },
      {
        id: 'cf15e0fd-bc1a-4afa-8b02-25fff7fc6770',
        key: 'violence_or_threats',
        displayName:
          effectiveLang === 'en' ? 'Violence or threats' : 'عنف أو تهديدات',
        name_ar: 'عنف أو تهديدات',
        name_en: 'Violence or threats',
      },
      {
        id: 'ac67878d-b447-44d1-8f9b-ca43377e0add',
        key: 'nudity_or_sexual_content',
        displayName:
          effectiveLang === 'en'
            ? 'Nudity or sexual content'
            : 'عري أو محتوى جنسي',
        name_ar: 'عري أو محتوى جنسي',
        name_en: 'Nudity or sexual content',
      },
      {
        id: '616c95d4-a360-4e9e-90f9-4349898d1402',
        key: 'scam_or_fraud',
        displayName:
          effectiveLang === 'en' ? 'Scam or fraud' : 'احتيال أو خداع',
        name_ar: 'احتيال أو خداع',
        name_en: 'Scam or fraud',
      },
      {
        id: '6b5a087d-56a8-45b7-9f10-4ae26beef3c9',
        key: 'false_information',
        displayName:
          effectiveLang === 'en'
            ? 'False information'
            : 'معلومات كاذبة أو مضللة',
        name_ar: 'معلومات كاذبة أو مضللة',
        name_en: 'False information',
      },
      {
        id: '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        key: 'something_else',
        displayName: effectiveLang === 'en' ? 'Something else' : 'سبب آخر',
        name_ar: 'سبب آخر',
        name_en: 'Something else',
      },
    ];

    if (!meta) {
      return reasons.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        name_ar: r.name_ar,
        name_en: r.name_en,
      }));
    }

    if (effectiveLang === 'en') {
      return {
        title: 'Report post',
        subtitle: 'Why are you reporting this post? Your report is anonymous.',
        detailsStep: {
          title: 'Add more details',
          subtitle: 'Optional. Context helps our team review this faster.',
          placeholder: "Tell us what's wrong with this post...",
          submitButton: 'Submit',
          maxCharacters: 160,
        },
        reasons: reasons.map((r) => ({
          id: r.id,
          displayName: r.displayName,
          name_ar: r.name_ar,
          name_en: r.name_en,
        })),
      };
    }

    return {
      title: 'الإبلاغ عن منشور',
      subtitle: 'لماذا تبلغ عن هذا المنشور؟ بلاغك سري ومجهول الهوية.',
      detailsStep: {
        title: 'إضافة المزيد من التفاصيل',
        subtitle:
          'اختياري. يساعد السياق فريقنا على مراجعة هذا المنشور بشكل أسرع.',
        placeholder: 'أخبرنا ما المشكلة في هذا المنشور...',
        submitButton: 'إرسال',
        maxCharacters: 160,
      },
      reasons: reasons.map((r) => ({
        id: r.id,
        displayName: r.displayName,
        name_ar: r.name_ar,
        name_en: r.name_en,
      })),
    };
  }

  /**
   * Submit a report against a post
   */
  async reportPost(
    postId: string,
    userId: string,
    dto: ReportPostDto,
  ): Promise<{
    statusCode: number;
    message: string;
    report: any;
    confirmation?: any;
    data?: any;
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      relations: { user: true },
    });
    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }

    if (post.userId === userId) {
      throw new BadRequestException(this.i18n.t('posts.cannot_report_own'));
    }

    const reportsRepo =
      this.postReportRepo || this.dataSource?.getRepository(PostReport);
    if (reportsRepo) {
      const existing = await reportsRepo.findOne({ where: { postId, userId } });
      if (existing) {
        throw new ConflictException(this.i18n.t('posts.already_reported'));
      }
    }

    const rawReason = (dto.reasonId || dto.reason || 'something_else').trim();
    const resolved = this.resolveReportReason(rawReason);
    const storedReason = resolved ? resolved.key || resolved.id : rawReason;
    const reasonId = resolved
      ? resolved.id
      : dto.reasonId || '1f71559f-4980-4b02-be6a-24c4ea3d7ea0';
    const details = (dto.details || dto.notes || '').trim() || null;

    let reportEntity: any = {
      id: 'report-' + Date.now(),
      postId,
      userId,
      reason: storedReason,
      reasonId,
      details,
      createdAt: new Date(),
    };

    if (reportsRepo) {
      try {
        reportEntity = await reportsRepo.save(
          reportsRepo.create({
            postId,
            userId,
            reason: storedReason,
            reasonId,
            details,
          }),
        );
      } catch (error: any) {
        if (error?.code === '23505' || error?.driverError?.code === '23505') {
          throw new ConflictException(this.i18n.t('posts.already_reported'));
        }
        throw error;
      }
    }

    const authorName = post.user?.name || 'user';
    const authorId = post.user?.id || post.userId;

    const confirmation = {
      title: this.i18n.t('reports.success_title'),
      subtitle: this.i18n.t('reports.success_subtitle'),
      blockOption: {
        title: `${this.i18n.t('reports.block_title')} @${authorName}`,
        subtitle: this.i18n.t('reports.block_subtitle'),
        targetUserId: authorId,
        endpoint: `/v1/users/${authorId}/block`,
        method: 'POST',
      },
      doneButton: this.i18n.t('reports.done_button'),
    };

    const data = {
      reportId: reportEntity.id,
      postId: reportEntity.postId,
      reasonId: reportEntity.reasonId,
      reason: reportEntity.reason,
      details: reportEntity.details,
      createdAt: reportEntity.createdAt,
      confirmation,
    };

    return {
      statusCode: 201,
      message: this.i18n.t('posts.reported_success'),
      report: data,
      confirmation,
      data,
    };
  }

  /**
   * Helper to resolve reason input
   */
  private resolveReportReason(q: string): { id: string; key: string } | null {
    const term = (q || '').trim().toLowerCase();
    const list = [
      { id: '2f7dc7e9-df71-4fc3-84d0-53f608b75f14', key: 'spam' },
      {
        id: '77d40c8a-cc97-42ec-be72-3c02e7db22d3',
        key: 'harassment_or_bullying',
      },
      { id: '25bdb724-c84d-488e-8c88-3d7b15dab543', key: 'hate_speech' },
      {
        id: 'cf15e0fd-bc1a-4afa-8b02-25fff7fc6770',
        key: 'violence_or_threats',
      },
      {
        id: 'ac67878d-b447-44d1-8f9b-ca43377e0add',
        key: 'nudity_or_sexual_content',
      },
      { id: '616c95d4-a360-4e9e-90f9-4349898d1402', key: 'scam_or_fraud' },
      { id: '6b5a087d-56a8-45b7-9f10-4ae26beef3c9', key: 'false_information' },
      { id: '1f71559f-4980-4b02-be6a-24c4ea3d7ea0', key: 'something_else' },
    ];
    return (
      list.find((r) => r.id === term || r.key === term) || {
        id: '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
        key: 'something_else',
      }
    );
  }
}
