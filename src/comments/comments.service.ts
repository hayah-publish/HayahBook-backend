import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Inject,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { Comment } from './comment.entity';
import { CommentReaction } from './comment-reaction.entity';
import { CommentMute } from './comment-mute.entity';
import { CommentReport } from './comment-report.entity';
import { Post } from '../posts/post.entity';
import { User } from '../users/user.entity';
import { UserUserFollow } from '../users/user-user-follow.entity';
import { UserBlock } from '../users/user-block.entity';
import { UserAlias } from '../aliases/user-alias.entity';
import { UploadService } from '../upload/upload.service';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { CommentsQueryDto, CommentSortType } from './dto/comments-query.dto';
import { ReactionsQueryDto } from '../posts/dto/reactions-query.dto';
import { UploadFile } from '../upload/upload-file.interface';
import type {
  ReactionType,
  PostReactionsCount,
} from '../posts/post-reaction.entity';

export interface FormattedCommentPublisher {
  id: string | null;
  name: string;
  profileUrl: string | null;
  role: string;
  userType: string;
  isVerified: boolean;
  isAlias?: boolean;
  isAnonymous?: boolean;
}

export type FormattedCommentUser = FormattedCommentPublisher;

export interface FormattedCommentPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canHide: boolean;
  canReply: boolean;
  canReport: boolean;
}

export interface FormattedComment {
  id: string;
  postId: string;
  parentId: string | null;
  content: string;
  imageUrl: string | null;
  mentions: FormattedCommentPublisher[];
  replyToUser: FormattedCommentPublisher | null;
  publisher: FormattedCommentPublisher;
  identityType?: 'primary' | 'alias' | 'anonymous';
  aliasId?: string | null;
  isAnonymous?: boolean;
  repliesCount: number;
  likesCount: number;
  reactionsCount: PostReactionsCount;
  topReactions: ReactionType[];
  userReaction: ReactionType | null;
  isPinned: boolean;
  pinnedAt: Date | null;
  isHidden: boolean;
  isEdited: boolean;
  isMuted: boolean;
  permissions: FormattedCommentPermissions;
  createdAt: Date;
  updatedAt: Date;
  replies?: FormattedComment[];
}

export interface ReportReasonOption {
  id: string;
  key?: string;
  displayName: string;
  name_ar: string;
  name_en: string;
}

export const REPORT_REASONS: Array<{
  id: string;
  key: string;
  name_ar: string;
  name_en: string;
  aliases?: string[];
}> = [
  {
    id: '2f7dc7e9-df71-4fc3-84d0-53f608b75f14',
    key: 'spam',
    name_ar: 'محتوى غير مرغوب فيه',
    name_en: 'Spam',
    aliases: [
      '2f7dc7e9-df71-4fc3-84d0-53f608b75f14',
      'spam',
      'سبام',
      'محتوى غير مرغوب فيه',
      'رسائل غير مرغوب فيها',
      'محتوى غير مرغوب فيه (سبام)',
    ],
  },
  {
    id: '77d40c8a-cc97-42ec-be72-3c02e7db22d3',
    key: 'harassment_or_bullying',
    name_ar: 'مضايقة أو تنمر',
    name_en: 'Harassment or bullying',
    aliases: [
      '77d40c8a-cc97-42ec-be72-3c02e7db22d3',
      'harassment_or_bullying',
      'harassment',
      'bullying',
      'مضايقة أو تنمر',
      'مضايقة',
      'تنمر',
      'محتوى مسيء',
    ],
  },
  {
    id: '25bdb724-c84d-488e-8c88-3d7b15dab543',
    key: 'hate_speech',
    name_ar: 'خطاب كراهية',
    name_en: 'Hate speech',
    aliases: [
      '25bdb724-c84d-488e-8c88-3d7b15dab543',
      'hate_speech',
      'hate',
      'خطاب كراهية',
      'كراهية',
    ],
  },
  {
    id: 'cf15e0fd-bc1a-4afa-8b02-25fff7fc6770',
    key: 'violence_or_threats',
    name_ar: 'عنف أو تهديدات',
    name_en: 'Violence or threats',
    aliases: [
      'cf15e0fd-bc1a-4afa-8b02-25fff7fc6770',
      'violence_or_threats',
      'violence',
      'threats',
      'عنف أو تهديدات',
      'عنف',
      'تهديد',
    ],
  },
  {
    id: 'ac67878d-b447-44d1-8f9b-ca43377e0add',
    key: 'nudity_or_sexual_content',
    name_ar: 'عري أو محتوى جنسي',
    name_en: 'Nudity or sexual content',
    aliases: [
      'ac67878d-b447-44d1-8f9b-ca43377e0add',
      'nudity_or_sexual_content',
      'nudity',
      'sexual_content',
      'عري أو محتوى جنسي',
      'عري',
      'محتوى جنسي',
      'إباحية',
    ],
  },
  {
    id: '616c95d4-a360-4e9e-90f9-4349898d1402',
    key: 'scam_or_fraud',
    name_ar: 'احتيال أو خداع',
    name_en: 'Scam or fraud',
    aliases: [
      '616c95d4-a360-4e9e-90f9-4349898d1402',
      'scam_or_fraud',
      'scam',
      'fraud',
      'احتيال أو خداع',
      'احتيال',
      'خداع',
      'نصب',
    ],
  },
  {
    id: '6b5a087d-56a8-45b7-9f10-4ae26beef3c9',
    key: 'false_information',
    name_ar: 'معلومات كاذبة أو مضللة',
    name_en: 'False information',
    aliases: [
      '6b5a087d-56a8-45b7-9f10-4ae26beef3c9',
      'false_information',
      'fake_news',
      'misinformation',
      'معلومات كاذبة أو مضللة',
      'معلومات كاذبة',
      'معلومات مضللة',
      'معلومات زائفة',
    ],
  },
  {
    id: '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
    key: 'something_else',
    name_ar: 'سبب آخر',
    name_en: 'Something else',
    aliases: [
      '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
      'something_else',
      'other',
      'else',
      'سبب آخر',
      'شيء آخر',
      'أخرى',
    ],
  },
];

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepo: Repository<Comment>,
    @InjectRepository(CommentReaction)
    private readonly commentReactionsRepo: Repository<CommentReaction>,
    @InjectRepository(CommentMute)
    private readonly commentMutesRepo: Repository<CommentMute>,
    @InjectRepository(CommentReport)
    private readonly commentReportsRepo: Repository<CommentReport>,
    @InjectRepository(Post)
    private readonly postsRepo: Repository<Post>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(UserUserFollow)
    private readonly userFollowRepo: Repository<UserUserFollow>,
    @Inject(UploadService)
    private readonly uploadService: UploadService,
    private readonly i18n: I18nService,
    @Optional()
    private readonly dataSource?: DataSource,
    @Optional()
    @InjectRepository(UserBlock)
    private readonly userBlockRepo?: Repository<UserBlock>,
    @Optional()
    @InjectRepository(UserAlias)
    private readonly aliasRepo?: Repository<UserAlias>,
  ) {}

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
      val === 'love it'
    ) {
      return 'love';
    }
    if (
      val === 'applaud' ||
      val === 'احسنت' ||
      val === 'أحسنت' ||
      val === 'bravo' ||
      val === 'clap'
    ) {
      return 'applaud';
    }
    if (
      val === 'insightful' ||
      val === 'يستحق التفكير' ||
      val === 'فكرة عميقة' ||
      val === 'عميق' ||
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

  getCommentRequiredMessage(): string {
    return this.i18n.t('comments.comment_required');
  }

  /**
   * Return the 4 standard comment sorting options matching the design sheet
   */
  getSortOptions() {
    return [
      {
        key: 'most_relevant',
        titleEn: 'Most Relevant',
        titleAr: 'الأكثر صلة',
        descriptionEn:
          'See comments from friends and the most relevant comments first.',
        descriptionAr: 'عرض تعليقات الأصدقاء والتعليقات الأكثر ملاءمة أولاً.',
        isDefault: true,
      },
      {
        key: 'newest',
        titleEn: 'Newest',
        titleAr: 'الأحدث',
        descriptionEn: 'See all comments, with the newest comments first.',
        descriptionAr: 'عرض جميع التعليقات مع ظهور أحدثها أولاً.',
        isDefault: false,
      },
      {
        key: 'all_comments',
        titleEn: 'All Comments',
        titleAr: 'كل التعليقات',
        descriptionEn:
          'Show all comments, including potentially offensive ones.',
        descriptionAr:
          'عرض جميع التعليقات بما في ذلك التعليقات المحتمل أنها مسيئة.',
        isDefault: false,
      },
      {
        key: 'oldest',
        titleEn: 'Oldest',
        titleAr: 'الأقدم',
        descriptionEn: 'See all comments, with the oldest comments first.',
        descriptionAr: 'عرض جميع التعليقات مع ظهور أقدمها أولاً.',
        isDefault: false,
      },
    ];
  }

  /**
   * Return identity options for the comment identity selector (Image 1)
   */
  async getIdentityOptions(userId: string, lang?: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.i18n.t('users.not_found'));
    }

    const aliasesRepo =
      this.aliasRepo || this.dataSource?.getRepository(UserAlias);
    const aliases = aliasesRepo
      ? await aliasesRepo.find({
          where: { userId },
          order: { isDefault: 'DESC', createdAt: 'DESC' },
        })
      : [];

    const isAr = (lang || this.i18n?.getCurrentLanguage?.() || 'ar') === 'ar';

    return {
      primary: {
        id: user.id,
        name: user.name,
        profileUrl: user.profileUrl,
        userType: user.userType,
        isVerified: user.role === 'admin' || user.userType === 'Author',
      },
      aliases: aliases.map((a) => ({
        id: a.id,
        nickname: a.nickname,
        avatarUrl:
          a.avatarUrl ||
          'https://cdn.hayahbook.com/presets/aliases/preset-frog-red.jpg',
        isDefault: a.isDefault,
        agreedCount: a.agreedCount,
        searchCount: a.searchCount,
      })),
      anonymousOption: {
        title: isAr
          ? 'التعليق على هذا المنشور دون إظهار اسمك'
          : 'Comment on this post without showing your name',
        anonymousName: user.anonymousNumber
          ? isAr
            ? `مستخدم مجهول - ${user.anonymousNumber}`
            : `Anonymous Reader - ${user.anonymousNumber}`
          : isAr
            ? 'مستخدم مجهول'
            : 'Anonymous Reader',
        anonymousNumber: user.anonymousNumber ?? null,
      },
      selectedOption: aliases.find((a) => a.isDefault)?.id || 'primary',
    };
  }

  /**
   * Return the 8 comment report reasons with localized displayName
   */
  getReportReasons(lang?: SupportedLanguage, includeMeta: boolean = false) {
    const currentLang =
      lang ||
      (this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : 'ar');
    const reasons: ReportReasonOption[] = REPORT_REASONS.map((r) => ({
      id: r.id,
      displayName: currentLang === 'en' ? r.name_en : r.name_ar,
      name_ar: r.name_ar,
      name_en: r.name_en,
    }));

    if (includeMeta) {
      return {
        title: this.i18n.t('reports.title'),
        subtitle: this.i18n.t('reports.subtitle'),
        detailsStep: {
          title: this.i18n.t('reports.details_title'),
          subtitle: this.i18n.t('reports.details_subtitle'),
          placeholder: this.i18n.t('reports.details_placeholder'),
          submitButton: this.i18n.t('reports.submit_button'),
          maxCharacters: 160,
        },
        successStep: {
          title: this.i18n.t('reports.success_title'),
          subtitle: this.i18n.t('reports.success_subtitle'),
          blockText: this.i18n.t('reports.block_subtitle'),
          doneButton: this.i18n.t('reports.done_button'),
        },
        reasons,
      };
    }

    return reasons;
  }

  /**
   * Resolve an incoming report reason key or name into a canonical ReportReasonOption
   */
  resolveReportReason(
    input?: string,
    lang?: SupportedLanguage,
  ): ReportReasonOption | null {
    if (!input || !input.trim()) return null;
    const q = input.trim().toLowerCase();
    const normalizeAr = (s: string) =>
      s
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();
    const qNorm = normalizeAr(q);

    const found = REPORT_REASONS.find((r) => {
      if (r.id.toLowerCase() === q) return true;
      if (r.key.toLowerCase() === q) return true;
      if (r.name_en.toLowerCase() === q) return true;
      if (normalizeAr(r.name_ar) === qNorm) return true;
      if (
        r.aliases &&
        r.aliases.some((a) => a.toLowerCase() === q || normalizeAr(a) === qNorm)
      ) {
        return true;
      }
      return false;
    });

    if (!found) return null;

    const currentLang =
      lang ||
      (this.i18n?.getCurrentLanguage ? this.i18n.getCurrentLanguage() : 'ar');
    return {
      id: found.id,
      key: found.key,
      displayName: currentLang === 'en' ? found.name_en : found.name_ar,
      name_ar: found.name_ar,
      name_en: found.name_en,
    };
  }

  /**
   * Normalize sort parameter from English or Arabic
   * Options:
   * 1. 'most_relevant' (default): See comments from friends and the most relevant comments first.
   * 2. 'newest': See all comments, with the newest comments first.
   * 3. 'all_comments': Show all comments, including potentially offensive ones.
   */
  normalizeSort(input?: string): CommentSortType {
    if (!input) return 'most_relevant';
    const val = input.trim().toLowerCase();

    // 1. Most Relevant (friends + engagement + author)
    if (
      val === 'most_relevant' ||
      val === 'relevant' ||
      val === 'friends' ||
      val === 'most_interactive' ||
      val === 'interactive' ||
      val === 'popular' ||
      val === 'الأكثر صلة' ||
      val === 'الاكثر صلة' ||
      val === 'الأكثر تفاعلاً' ||
      val === 'الاكثر تفاعلا'
    ) {
      return 'most_relevant';
    }

    // 2. Newest (chronological descending)
    if (
      val === 'newest' ||
      val === 'recent' ||
      val === 'latest' ||
      val === 'الأحدث' ||
      val === 'الاحدث'
    ) {
      return 'newest';
    }

    // 3. All Comments (including offensive/hidden)
    if (
      val === 'all_comments' ||
      val === 'all' ||
      val === 'كل التعليقات' ||
      val === 'جميع التعليقات' ||
      val === 'الكل'
    ) {
      return 'all_comments';
    }

    if (val === 'oldest' || val === 'الأقدم' || val === 'الاقدم') {
      return 'oldest';
    }

    return 'most_relevant';
  }

  /**
   * Extract user mentions from content (@mentions) or DTO array
   */
  extractMentions(content: string, dtoMentions?: string[]): string[] {
    const ids = new Set<string>(dtoMentions || []);
    // Also extract any UUIDs formatted as @uuid
    const uuidRegex =
      /@([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/gi;
    let match: RegExpExecArray | null;
    while ((match = uuidRegex.exec(content)) !== null) {
      ids.add(match[1]);
    }
    return Array.from(ids);
  }

  /**
   * 1. Create a root comment on a post, article, visual, or snippet
   */
  async createComment(
    userId: string,
    dto: CreateCommentDto,
    postIdParam?: string,
    imageFile?: UploadFile,
  ): Promise<{ message: string; data: FormattedComment }> {
    const targetPostId = postIdParam || dto.contentId || dto.postId;
    if (!targetPostId) {
      throw new BadRequestException(this.i18n.t('comments.post_required'));
    }

    const post = await this.postsRepo.findOne({ where: { id: targetPostId } });
    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }
    await this.assertNoBlockBetween(userId, post.userId);

    if (post.commentsDisabled) {
      throw new BadRequestException(this.i18n.t('posts.comments_disabled'));
    }

    let identityType: 'primary' | 'alias' | 'anonymous' =
      dto.identityType || 'primary';
    let aliasId: string | null = null;
    const isAnonymous =
      dto.isAnonymous === true || identityType === 'anonymous';
    if (isAnonymous) {
      identityType = 'anonymous';
    }

    let aliasEntity: UserAlias | null = null;
    if (identityType === 'alias') {
      if (!dto.aliasId) {
        throw new BadRequestException(
          this.i18n.t('comments.alias_id_required'),
        );
      }
      const aliasesRepo =
        this.aliasRepo || this.dataSource?.getRepository(UserAlias);
      if (aliasesRepo) {
        aliasEntity = await aliasesRepo.findOne({
          where: { id: dto.aliasId, userId },
        });
      }
      if (!aliasEntity) {
        throw new ForbiddenException(
          this.i18n.t('comments.alias_invalid_or_not_owned'),
        );
      }
      aliasId = aliasEntity.id;
    }

    let finalImageUrl: string | null = dto.imageUrl?.trim() || null;
    if (imageFile) {
      finalImageUrl = await this.uploadService.uploadCommentImage(
        userId,
        imageFile,
      );
    }

    const comment = this.commentsRepo.create({
      postId: targetPostId,
      userId,
      parentId: null,
      replyToUserId: null,
      content: dto.content.trim(),
      imageUrl: finalImageUrl,
      mentions: this.extractMentions(dto.content, dto.mentions),
      identityType,
      aliasId,
      isAnonymous,
      repliesCount: 0,
      likesCount: 0,
      reactionsCount: {
        total: 0,
        agree: 0,
        love: 0,
        applaud: 0,
        insightful: 0,
        disagree: 0,
      },
    });

    let saved: Comment;
    try {
      saved = await this.commentsRepo.manager.transaction(async (manager) => {
        const savedComment = await manager.getRepository(Comment).save(comment);
        await manager
          .getRepository(Post)
          .increment({ id: targetPostId }, 'commentsCount', 1);
        if (aliasId) {
          await manager
            .getRepository(UserAlias)
            .increment({ id: aliasId }, 'commentsCount', 1);
        }
        return savedComment;
      });
    } catch (error) {
      if (imageFile && finalImageUrl) {
        await this.uploadService
          .deleteFileByUrl(finalImageUrl)
          .catch(() => undefined);
      }
      throw error;
    }

    // Pre-load user details for formatting
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    saved.user = user!;
    saved.alias = aliasEntity;
    saved.post = post;

    const formatted = await this.formatComment(saved, userId, post.userId);

    return {
      message: this.i18n.t('comments.created'),
      data: formatted,
    };
  }

  /**
   * 2. Create a reply to an existing comment (or nested reply to reply)
   */
  async createReply(
    userId: string,
    parentCommentId: string,
    dto: CreateReplyDto,
    imageFile?: UploadFile,
  ): Promise<{ message: string; data: FormattedComment }> {
    const parent = await this.commentsRepo.findOne({
      where: { id: parentCommentId },
      relations: { post: true },
    });

    if (!parent) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }
    await this.assertNoBlockBetween(userId, parent.post?.userId || '');
    if (parent.userId) {
      await this.assertNoBlockBetween(userId, parent.userId);
    }

    if (parent.post?.commentsDisabled) {
      throw new BadRequestException(this.i18n.t('posts.comments_disabled'));
    }

    // Two-level mobile threading architecture:
    // If the parent is already a reply, its parentId becomes the root comment ID,
    // and replyToUserId is automatically set to the author of that reply (unless masked)!
    const effectiveParentId = parent.parentId ? parent.parentId : parent.id;
    const isParentMasked = Boolean(
      parent.isAnonymous ||
      parent.identityType === 'anonymous' ||
      parent.identityType === 'alias',
    );
    const effectiveReplyToUserId = isParentMasked
      ? dto.replyToUserId && dto.replyToUserId !== parent.userId
        ? dto.replyToUserId
        : null
      : dto.replyToUserId || parent.userId;

    let identityType: 'primary' | 'alias' | 'anonymous' =
      dto.identityType || 'primary';
    let aliasId: string | null = null;
    const isAnonymous =
      dto.isAnonymous === true || identityType === 'anonymous';
    if (isAnonymous) {
      identityType = 'anonymous';
    }

    let aliasEntity: UserAlias | null = null;
    if (identityType === 'alias') {
      if (!dto.aliasId) {
        throw new BadRequestException(
          this.i18n.t('comments.alias_id_required'),
        );
      }
      const aliasesRepo =
        this.aliasRepo || this.dataSource?.getRepository(UserAlias);
      if (aliasesRepo) {
        aliasEntity = await aliasesRepo.findOne({
          where: { id: dto.aliasId, userId },
        });
      }
      if (!aliasEntity) {
        throw new ForbiddenException(
          this.i18n.t('comments.alias_invalid_or_not_owned'),
        );
      }
      aliasId = aliasEntity.id;
    }

    let finalImageUrl: string | null = dto.imageUrl?.trim() || null;
    if (imageFile) {
      finalImageUrl = await this.uploadService.uploadCommentImage(
        userId,
        imageFile,
      );
    }

    const reply = this.commentsRepo.create({
      postId: parent.postId,
      userId,
      parentId: effectiveParentId,
      replyToUserId: effectiveReplyToUserId,
      content: dto.content.trim(),
      imageUrl: finalImageUrl,
      mentions: this.extractMentions(dto.content, dto.mentions),
      identityType,
      aliasId,
      isAnonymous,
      repliesCount: 0,
      likesCount: 0,
      reactionsCount: {
        total: 0,
        agree: 0,
        love: 0,
        applaud: 0,
        insightful: 0,
        disagree: 0,
      },
    });

    let saved: Comment;
    try {
      saved = await this.commentsRepo.manager.transaction(async (manager) => {
        const savedReply = await manager.getRepository(Comment).save(reply);
        await manager
          .getRepository(Comment)
          .increment({ id: effectiveParentId }, 'repliesCount', 1);
        await manager
          .getRepository(Post)
          .increment({ id: parent.postId }, 'commentsCount', 1);
        if (aliasId) {
          await manager
            .getRepository(UserAlias)
            .increment({ id: aliasId }, 'commentsCount', 1);
        }
        return savedReply;
      });
    } catch (error) {
      if (imageFile && finalImageUrl) {
        await this.uploadService
          .deleteFileByUrl(finalImageUrl)
          .catch(() => undefined);
      }
      throw error;
    }

    // Load relations for response
    const [user, replyToUser] = await Promise.all([
      this.usersRepo.findOne({ where: { id: userId } }),
      effectiveReplyToUserId
        ? this.usersRepo.findOne({ where: { id: effectiveReplyToUserId } })
        : Promise.resolve(null),
    ]);

    saved.user = user!;
    saved.alias = aliasEntity;
    saved.replyToUser = replyToUser;
    saved.post = parent.post;

    const formatted = await this.formatComment(
      saved,
      userId,
      parent.post?.userId,
    );

    return {
      message: this.i18n.t('comments.reply_created'),
      data: formatted,
    };
  }

  /**
   * 3. Get paginated root comments for a post/article/visual/snippet
   */
  async getPostComments(
    postId: string,
    query: CommentsQueryDto,
    currentUserId?: string,
  ): Promise<{
    data: FormattedComment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sort?: CommentSortType;
  }> {
    const post = await this.postsRepo.findOne({
      where: { id: postId },
      select: { id: true, userId: true },
    });
    if (!post) {
      throw new NotFoundException(this.i18n.t('posts.not_found'));
    }
    if (currentUserId)
      await this.assertNoBlockBetween(currentUserId, post.userId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
    const sort = this.normalizeSort(query.sort);

    const qb = this.commentsRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .leftJoinAndSelect('comment.alias', 'alias')
      .where('comment.postId = :postId', { postId })
      .andWhere('comment.parentId IS NULL');

    // Filter hidden comments:
    // Option 3: 'all_comments' ("Show all comments, including potentially offensive ones.")
    // In 'all_comments' mode, do NOT exclude hidden/offensive comments.
    if (sort !== 'all_comments') {
      if (currentUserId && currentUserId !== post.userId) {
        qb.andWhere(
          '(comment.isHidden = false OR comment.userId = :currentUserId)',
          {
            currentUserId,
          },
        );
      } else if (!currentUserId) {
        qb.andWhere('comment.isHidden = false');
      }
    }

    // 1. Pinned comments always appear at the very top
    qb.orderBy('comment.isPinned', 'DESC');
    qb.addOrderBy('comment.pinnedAt', 'DESC');

    // 2. Sorting based on the selected mode:
    if (sort === 'most_relevant' || sort === 'most_interactive') {
      // Option 1: "See comments from friends and the most relevant comments first."
      let friendUserIds: string[] = [];
      if (currentUserId) {
        const follows = await this.userFollowRepo.find({
          where: { followerId: currentUserId },
          select: { followingId: true },
        });
        friendUserIds = follows.map((f) => f.followingId);
      }

      if (friendUserIds.length > 0) {
        qb.addSelect(
          `CASE 
             WHEN comment.isAnonymous = false AND comment.identityType = 'primary' AND comment.userId = :postAuthorId THEN 2
             WHEN comment.isAnonymous = false AND comment.identityType = 'primary' AND comment.userId IN (:...friendUserIds) THEN 1
             ELSE 0 
           END`,
          'friend_priority',
        );
        qb.setParameter('postAuthorId', post.userId);
        qb.setParameter('friendUserIds', friendUserIds);
        qb.addOrderBy('friend_priority', 'DESC');
      } else {
        qb.addSelect(
          `CASE WHEN comment.isAnonymous = false AND comment.identityType = 'primary' AND comment.userId = :postAuthorId THEN 1 ELSE 0 END`,
          'friend_priority',
        );
        qb.setParameter('postAuthorId', post.userId);
        qb.addOrderBy('friend_priority', 'DESC');
      }

      // Relevance score: likes * 2 + replies * 3
      qb.addSelect(
        '((comment.likesCount * 2) + (comment.repliesCount * 3))',
        'engagement_score',
      );
      qb.addOrderBy('engagement_score', 'DESC');
      qb.addOrderBy('comment.createdAt', 'DESC');
    } else if (sort === 'oldest') {
      qb.addOrderBy('comment.createdAt', 'ASC');
    } else {
      // Option 2 & 3: 'newest' and 'all_comments' (newest first)
      qb.addOrderBy('comment.createdAt', 'DESC');
    }

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const data = await this.formatCommentsList(
      items,
      currentUserId,
      post.userId,
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      sort,
    };
  }

  /**
   * 4. Get paginated replies for a specific parent comment
   */
  async getCommentReplies(
    commentId: string,
    query: CommentsQueryDto,
    currentUserId?: string,
  ): Promise<{
    data: FormattedComment[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    sort?: CommentSortType;
  }> {
    const parent = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!parent) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }
    if (currentUserId)
      await this.assertNoBlockBetween(currentUserId, parent.post?.userId || '');

    if (parent.post?.commentsDisabled) {
      throw new BadRequestException(this.i18n.t('posts.comments_disabled'));
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
    const sort = this.normalizeSort(query.sort);

    const qb = this.commentsRepo
      .createQueryBuilder('reply')
      .leftJoinAndSelect('reply.user', 'user')
      .leftJoinAndSelect('reply.alias', 'alias')
      .leftJoinAndSelect('reply.replyToUser', 'replyToUser')
      .where('reply.parentId = :commentId', { commentId });

    if (sort !== 'all_comments') {
      if (currentUserId && currentUserId !== parent.post?.userId) {
        qb.andWhere(
          '(reply.isHidden = false OR reply.userId = :currentUserId)',
          { currentUserId },
        );
      } else if (!currentUserId) {
        qb.andWhere('reply.isHidden = false');
      }
    }

    qb.orderBy('reply.createdAt', 'ASC') // Chronological ordering for conversational replies
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const data = await this.formatCommentsList(
      items,
      currentUserId,
      parent.post?.userId,
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 5. React to a comment (Toggle ON/OFF or Switch Reaction)
   */
  async reactToComment(
    userId: string,
    commentId: string,
    reactionInput: string,
  ): Promise<{
    message: string;
    action: 'added' | 'updated' | 'removed';
    userReaction: ReactionType | null;
    reactionsCount: PostReactionsCount;
    topReactions: ReactionType[];
  }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }
    await this.assertNoBlockBetween(userId, comment.post?.userId || '');

    const targetType = this.normalizeReactionType(reactionInput);
    if (!targetType) {
      throw new BadRequestException(this.i18n.t('reactions.invalid_type'));
    }

    const existing = await this.commentReactionsRepo.findOne({
      where: { commentId, userId },
    });

    const rawCounts: any = comment.reactionsCount || {};
    const counts: PostReactionsCount = {
      total: Number(rawCounts.total) || comment.likesCount || 0,
      agree: Number(rawCounts.agree) || 0,
      love: Number(rawCounts.love) || 0,
      applaud: Number(rawCounts.applaud) || 0,
      insightful: Number(rawCounts.insightful) || 0,
      disagree: Number(rawCounts.disagree) || 0,
    };

    let action: 'added' | 'updated' | 'removed';
    let userReaction: ReactionType | null = null;
    let messageKey = 'reactions.added';
    const oldType = existing?.reactionType;

    if (!existing) {
      // 1. Add reaction
      action = 'added';
      userReaction = targetType;
      messageKey = 'reactions.added';

      const entity = this.commentReactionsRepo.create({
        userId,
        commentId,
        reactionType: targetType,
      });
      await this.commentReactionsRepo.save(entity);

      counts[targetType] = (counts[targetType] || 0) + 1;
      counts.total = (counts.total || 0) + 1;
    } else if (existing.reactionType === targetType) {
      // 2. Clicked again -> Toggle OFF (Remove)
      action = 'removed';
      userReaction = null;
      messageKey = 'reactions.removed';

      await this.commentReactionsRepo.delete({ id: existing.id });

      counts[targetType] = Math.max(0, (counts[targetType] || 1) - 1);
      counts.total = Math.max(0, (counts.total || 1) - 1);
    } else {
      // 3. Different reaction clicked -> Switch / Update
      action = 'updated';
      userReaction = targetType;
      messageKey = 'reactions.updated';

      existing.reactionType = targetType;
      await this.commentReactionsRepo.save(existing);

      if (oldType) {
        counts[oldType] = Math.max(0, (counts[oldType] || 1) - 1);
      }
      counts[targetType] = (counts[targetType] || 0) + 1;
    }

    comment.reactionsCount = counts;
    comment.likesCount = counts.total;
    await this.commentsRepo.save(comment);

    if (comment.aliasId) {
      const aliasesRepo =
        this.aliasRepo || this.dataSource?.getRepository(UserAlias);
      if (aliasesRepo) {
        if (action === 'added' && targetType === 'agree') {
          await aliasesRepo.increment(
            { id: comment.aliasId },
            'agreedCount',
            1,
          );
        } else if (action === 'removed' && targetType === 'agree') {
          await aliasesRepo.decrement(
            { id: comment.aliasId },
            'agreedCount',
            1,
          );
        } else if (action === 'updated') {
          if (oldType === 'agree') {
            await aliasesRepo.decrement(
              { id: comment.aliasId },
              'agreedCount',
              1,
            );
          }
          if (targetType === 'agree') {
            await aliasesRepo.increment(
              { id: comment.aliasId },
              'agreedCount',
              1,
            );
          }
        }
      }
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
      message: this.i18n.t(messageKey),
      action,
      userReaction,
      reactionsCount: counts,
      topReactions,
    };
  }

  /**
   * 6. Remove reaction from comment explicitly
   */
  async removeCommentReaction(
    userId: string,
    commentId: string,
  ): Promise<{
    message: string;
    action: 'removed';
    userReaction: null;
    reactionsCount: PostReactionsCount;
    topReactions: ReactionType[];
  }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }
    if (comment.userId) {
      await this.assertNoBlockBetween(userId, comment.userId);
    }
    if (comment.post?.userId) {
      await this.assertNoBlockBetween(userId, comment.post.userId);
    }

    const existing = await this.commentReactionsRepo.findOne({
      where: { commentId, userId },
    });

    const rawCounts: any = comment.reactionsCount || {};
    const counts: PostReactionsCount = {
      total: Number(rawCounts.total) || comment.likesCount || 0,
      agree: Number(rawCounts.agree) || 0,
      love: Number(rawCounts.love) || 0,
      applaud: Number(rawCounts.applaud) || 0,
      insightful: Number(rawCounts.insightful) || 0,
      disagree: Number(rawCounts.disagree) || 0,
    };

    if (existing) {
      const oldType = existing.reactionType;
      await this.commentReactionsRepo.delete({ id: existing.id });
      counts[oldType] = Math.max(0, (counts[oldType] || 1) - 1);
      counts.total = Math.max(0, (counts.total || 1) - 1);

      comment.reactionsCount = counts;
      comment.likesCount = counts.total;
      await this.commentsRepo.save(comment);

      if (oldType === 'agree' && comment.aliasId) {
        const aliasesRepo =
          this.aliasRepo || this.dataSource?.getRepository(UserAlias);
        if (aliasesRepo) {
          await aliasesRepo.decrement(
            { id: comment.aliasId },
            'agreedCount',
            1,
          );
        }
      }
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
      message: this.i18n.t('reactions.removed'),
      action: 'removed',
      userReaction: null,
      reactionsCount: counts,
      topReactions,
    };
  }

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
   * Get reactions modal list for a comment with tabs filtering (All, 🤝, ❤️, 👏, 💭, 🙅)
   */
  async getCommentReactions(
    commentId: string,
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
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }
    if (currentUserId) {
      if (comment.userId) {
        await this.assertNoBlockBetween(currentUserId, comment.userId);
      }
      if (comment.post?.userId) {
        await this.assertNoBlockBetween(currentUserId, comment.post.userId);
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));

    const counts = {
      all: 0,
      total: 0,
      agree: 0,
      love: 0,
      applaud: 0,
      insightful: 0,
      disagree: 0,
    };

    if (this.commentReactionsRepo) {
      const rawCounts = await this.commentReactionsRepo
        .createQueryBuilder('r')
        .where('r.commentId = :commentId', { commentId })
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

    let items: CommentReaction[] = [];
    let total = 0;

    if (this.commentReactionsRepo) {
      const qb = this.commentReactionsRepo
        .createQueryBuilder('r')
        .innerJoinAndSelect('r.user', 'user')
        .where('r.commentId = :commentId', { commentId });

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
          // Ignore if follow table mocked in tests
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
          isVerified:
            i.user?.role === 'admin' ||
            i.user?.userType === 'Author' ||
            !!(i.user as any)?.isVerified,
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

  /**
   * 7. Edit comment (Author only)
   */
  async updateComment(
    userId: string,
    commentId: string,
    newContent: string,
  ): Promise<{ message: string; data: FormattedComment }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { user: true, post: true, alias: true, replyToUser: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException(this.i18n.t('comments.unauthorized_edit'));
    }

    comment.content = newContent.trim();
    comment.isEdited = true;
    comment.updatedAt = new Date();

    const saved = await this.commentsRepo.save(comment);
    const formatted = await this.formatComment(
      saved,
      userId,
      comment.post?.userId,
    );

    return {
      message: this.i18n.t('comments.updated'),
      data: formatted,
    };
  }

  /**
   * 8. Delete comment (Comment Author, Post Owner, or Admin)
   */
  async deleteComment(
    userId: string,
    commentId: string,
    isAdmin = false,
  ): Promise<{ message: string }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }

    const isCommentAuthor = comment.userId === userId;
    const isPostOwner = comment.post?.userId === userId;

    if (!isCommentAuthor && !isPostOwner && !isAdmin) {
      throw new ForbiddenException(this.i18n.t('comments.unauthorized_delete'));
    }

    const targetIds = [commentId];
    if (!comment.parentId) {
      const replies = await this.commentsRepo.find({
        where: { parentId: commentId },
        select: { id: true },
      });
      targetIds.push(...replies.map((reply) => reply.id));
    }
    const rows: Array<{
      id: string;
      alias_id: string | null;
      image_url: string | null;
    }> = await this.commentsRepo.query(
      'SELECT id, alias_id, image_url FROM comments WHERE id = ANY($1::uuid[])',
      [targetIds],
    );
    const reactions: Array<{ alias_id: string; count: number }> =
      await this.commentsRepo.query(
        `SELECT c.alias_id, COUNT(r.id)::int AS count FROM comments c JOIN comment_reactions r ON r.comment_id = c.id WHERE c.id = ANY($1::uuid[]) AND c.alias_id IS NOT NULL AND r.reaction_type = 'agree' GROUP BY c.alias_id`,
        [targetIds],
      );

    await this.commentsRepo.manager.transaction(async (manager) => {
      await manager.query(
        'UPDATE posts SET comments_count = GREATEST(COALESCE(comments_count, 0) - $1, 0) WHERE id = $2',
        [rows.length, comment.postId],
      );
      if (comment.parentId) {
        await manager.query(
          'UPDATE comments SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = $1',
          [comment.parentId],
        );
      }
      for (const row of rows) {
        if (row.alias_id)
          await manager.query(
            'UPDATE user_aliases SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1',
            [row.alias_id],
          );
      }
      for (const reaction of reactions) {
        await manager.query(
          'UPDATE user_aliases SET agreed_count = GREATEST(agreed_count - $1, 0) WHERE id = $2',
          [Number(reaction.count), reaction.alias_id],
        );
      }
      await manager.getRepository(Comment).delete({ id: commentId });
    });

    for (const row of rows) {
      if (!row.image_url) continue;
      try {
        await this.uploadService.deleteFileByUrl(row.image_url);
      } catch {
        // Failed object cleanup does not undo the completed database deletion.
      }
    }

    return {
      message: this.i18n.t('comments.deleted'),
    };
  }

  /**
   * 9. Pin / Unpin comment (Post Owner or Admin only)
   */
  async togglePinComment(
    userId: string,
    commentId: string,
    isAdmin = false,
  ): Promise<{ message: string; isPinned: boolean }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }

    const isPostOwner = comment.post?.userId === userId;
    if (!isPostOwner && !isAdmin) {
      throw new ForbiddenException(this.i18n.t('comments.unauthorized_pin'));
    }

    const willPin = !comment.isPinned;

    if (willPin) {
      // Unpin any previously pinned comment on this post
      await this.commentsRepo.update(
        { postId: comment.postId, isPinned: true },
        { isPinned: false, pinnedAt: null },
      );
      comment.isPinned = true;
      comment.pinnedAt = new Date();
    } else {
      comment.isPinned = false;
      comment.pinnedAt = null;
    }

    await this.commentsRepo.save(comment);

    return {
      message: this.i18n.t(willPin ? 'comments.pinned' : 'comments.unpinned'),
      isPinned: willPin,
    };
  }

  /**
   * 10. Hide / Unhide comment (Post Owner, Comment Author, or Admin)
   */
  async toggleHideComment(
    userId: string,
    commentId: string,
    isAdmin = false,
  ): Promise<{ message: string; isHidden: boolean }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }

    const isCommentAuthor = comment.userId === userId;
    const isPostOwner = comment.post?.userId === userId;

    if (!isCommentAuthor && !isPostOwner && !isAdmin) {
      throw new ForbiddenException(this.i18n.t('comments.unauthorized_edit'));
    }

    comment.isHidden = !comment.isHidden;
    await this.commentsRepo.save(comment);

    return {
      message: this.i18n.t(
        comment.isHidden ? 'comments.hidden' : 'comments.unhidden',
      ),
      isHidden: comment.isHidden,
    };
  }

  /**
   * 11. Mute / Unmute comment notifications (Current user)
   */
  async toggleMuteComment(
    userId: string,
    commentId: string,
  ): Promise<{ message: string; isMuted: boolean }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }
    if (comment.userId) {
      await this.assertNoBlockBetween(userId, comment.userId);
    }
    if (comment.post?.userId) {
      await this.assertNoBlockBetween(userId, comment.post.userId);
    }

    const existing = await this.commentMutesRepo.findOne({
      where: { commentId, userId },
    });

    if (existing) {
      await this.commentMutesRepo.delete({ id: existing.id });
      return {
        message: this.i18n.t('comments.unmuted'),
        isMuted: false,
      };
    } else {
      const entity = this.commentMutesRepo.create({ commentId, userId });
      await this.commentMutesRepo.save(entity);
      return {
        message: this.i18n.t('comments.muted'),
        isMuted: true,
      };
    }
  }

  /**
   * 12. Report comment
   */
  async reportComment(
    userId: string,
    commentId: string,
    reason?: string,
    notes?: string,
  ): Promise<{
    message: string;
    reportId?: string;
    reason?: string | null;
    reasonId?: string | null;
    displayName?: string | null;
    details?: string | null;
    confirmation?: any;
  }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
      relations: { user: true, post: true },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }
    if (comment.userId) {
      await this.assertNoBlockBetween(userId, comment.userId);
    }
    if (comment.post?.userId) {
      await this.assertNoBlockBetween(userId, comment.post.userId);
    }

    if (comment.userId === userId) {
      throw new BadRequestException(
        this.i18n.t('comments.cannot_report_own_comment'),
      );
    }

    const existingReport = await this.commentReportsRepo.findOne({
      where: { commentId, userId },
    });
    if (existingReport) {
      throw new ConflictException(this.i18n.t('comments.already_reported'));
    }

    const resolved = this.resolveReportReason(reason);
    const details = notes?.trim() ? notes.trim().slice(0, 160) : null;
    let storedReason: string | null = null;
    if (reason && reason.trim()) {
      if (notes && notes.trim()) {
        storedReason = `${(resolved ? resolved.key || resolved.id : reason).trim()}: ${notes.trim()}`;
      } else {
        storedReason = reason.trim();
      }
    } else if (notes && notes.trim()) {
      storedReason = `something_else: ${notes.trim()}`;
    }

    const report = this.commentReportsRepo.create({
      commentId,
      userId,
      reason: storedReason,
      ...(details ? { details } : {}),
    });
    let saved: CommentReport;
    try {
      saved = await this.commentReportsRepo.save(report);
    } catch (error: any) {
      if (error?.code === '23505' || error?.driverError?.code === '23505') {
        throw new ConflictException(this.i18n.t('comments.already_reported'));
      }
      throw error;
    }

    const finalReasonId = resolved ? resolved.id : reason || null;
    const finalReasonKey = resolved
      ? resolved.key || resolved.id
      : storedReason || null;
    const currentLang = this.i18n?.getCurrentLanguage
      ? this.i18n.getCurrentLanguage()
      : 'ar';
    const isMaskedIdentity = Boolean(
      comment.isAnonymous ||
      comment.identityType === 'anonymous' ||
      comment.identityType === 'alias',
    );
    const authorName = isMaskedIdentity
      ? currentLang === 'en'
        ? 'User'
        : 'المستخدم'
      : comment.user?.name || (currentLang === 'en' ? 'User' : 'المستخدم');
    const authorHandle = `@${authorName}`;

    return {
      message: this.i18n.t('comments.reported'),
      reportId: saved.id,
      reason: finalReasonKey,
      reasonId: finalReasonId,
      displayName: resolved ? resolved.displayName : null,
      details,
      confirmation: {
        title: this.i18n.t('reports.success_title'),
        subtitle: this.i18n.t('reports.success_subtitle'),
        blockOption: isMaskedIdentity
          ? null
          : {
              title:
                currentLang === 'en'
                  ? `Block ${authorHandle}`
                  : `حظر ${authorHandle}`,
              subtitle: this.i18n.t('reports.block_subtitle'),
              targetUserId: comment.userId,
              endpoint: `/v1/users/${comment.userId}/block`,
              method: 'POST',
            },
        doneButton: this.i18n.t('reports.done_button'),
      },
    };
  }

  /**
   * Format comment helper batching reactions and permissions
   */
  async formatCommentsList(
    comments: Comment[],
    currentUserId?: string,
    postOwnerId?: string,
  ): Promise<FormattedComment[]> {
    if (comments.length === 0) return [];

    // Pre-load preview replies for root comments
    const rootCommentIdsWithReplies = comments
      .filter((c) => !c.parentId && (c.repliesCount || 0) > 0)
      .map((c) => c.id);

    const repliesMap = new Map<string, Comment[]>();
    if (rootCommentIdsWithReplies.length > 0) {
      try {
        const rawReplies = await this.commentsRepo
          .createQueryBuilder('reply')
          .leftJoinAndSelect('reply.user', 'user')
          .leftJoinAndSelect('reply.alias', 'alias')
          .leftJoinAndSelect('reply.replyToUser', 'replyToUser')
          .where('reply.parentId IN (:...rootCommentIdsWithReplies)', {
            rootCommentIdsWithReplies,
          })
          .andWhere('reply.isHidden = false')
          .orderBy('reply.createdAt', 'ASC')
          .getMany();

        for (const reply of rawReplies) {
          if (!reply.parentId) continue;
          const list = repliesMap.get(reply.parentId) || [];
          if (list.length < 3) {
            list.push(reply);
            repliesMap.set(reply.parentId, list);
          }
        }
      } catch {
        // Ignored
      }
    }

    const allCommentsWithReplies = [
      ...comments,
      ...Array.from(repliesMap.values()).flat(),
    ];
    const allCommentAndReplyIds = Array.from(
      new Set(allCommentsWithReplies.map((c) => c.id)),
    );

    // Batch load user reactions across comments and preview replies
    const userReactionsMap = new Map<string, ReactionType>();
    if (currentUserId && allCommentAndReplyIds.length > 0) {
      try {
        const reactions = await this.commentReactionsRepo.find({
          where: {
            commentId: In(allCommentAndReplyIds),
            userId: currentUserId,
          },
          select: { commentId: true, reactionType: true },
        });
        for (const r of reactions) {
          userReactionsMap.set(r.commentId, r.reactionType);
        }
      } catch {
        // Ignored
      }
    }

    // Batch load mutes across comments and preview replies
    const mutedSet = new Set<string>();
    if (currentUserId && allCommentAndReplyIds.length > 0) {
      try {
        const mutes = await this.commentMutesRepo.find({
          where: {
            commentId: In(allCommentAndReplyIds),
            userId: currentUserId,
          },
          select: { commentId: true },
        });
        for (const m of mutes) {
          mutedSet.add(m.commentId);
        }
      } catch {
        // Ignored
      }
    }

    // Batch load mentioned users across all comments and replies
    const allMentionIds = Array.from(
      new Set(
        allCommentsWithReplies.flatMap((c) =>
          Array.isArray(c.mentions) ? c.mentions : [],
        ),
      ),
    );
    const mentionsMap = new Map<string, FormattedCommentPublisher>();
    if (allMentionIds.length > 0) {
      try {
        const mentionedUsers = await this.usersRepo.find({
          where: { id: In(allMentionIds) },
        });
        for (const u of mentionedUsers) {
          mentionsMap.set(u.id, {
            id: u.id,
            name: u.name || '',
            profileUrl: u.profileUrl || null,
            role: u.role || 'user',
            userType: u.userType || 'Reader',
            isVerified: u.role === 'admin' || u.userType === 'Author',
          });
        }
      } catch {
        // Ignored
      }
    }

    return Promise.all(
      comments.map(async (c) => {
        const previewComments = repliesMap.get(c.id) || [];
        const formattedReplies =
          previewComments.length > 0
            ? await Promise.all(
                previewComments.map((r) =>
                  this.formatComment(
                    r,
                    currentUserId,
                    postOwnerId || c.post?.userId,
                    userReactionsMap.get(r.id) ?? null,
                    mutedSet.has(r.id),
                    mentionsMap,
                  ),
                ),
              )
            : undefined;

        const formatted = await this.formatComment(
          c,
          currentUserId,
          postOwnerId || c.post?.userId,
          userReactionsMap.get(c.id) ?? null,
          mutedSet.has(c.id),
          mentionsMap,
        );

        if (formattedReplies && formattedReplies.length > 0) {
          formatted.replies = formattedReplies;
        }

        return formatted;
      }),
    );
  }

  /**
   * Format a single comment entity into standard API response
   */
  async formatComment(
    comment: Comment,
    currentUserId?: string,
    postOwnerId?: string,
    resolvedReaction?: ReactionType | null,
    isMuted = false,
    preloadedMentions?: Map<string, FormattedCommentPublisher>,
  ): Promise<FormattedComment> {
    const rawCounts: any = comment.reactionsCount || {};
    const total = Number(rawCounts.total) || comment.likesCount || 0;
    const reactionsCount: PostReactionsCount = {
      total,
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

    let userReaction = resolvedReaction;
    if (userReaction === undefined && currentUserId) {
      try {
        const r = await this.commentReactionsRepo.findOne({
          where: { commentId: comment.id, userId: currentUserId },
          select: { reactionType: true },
        });
        userReaction = r ? r.reactionType : null;
      } catch {
        userReaction = null;
      }
    }

    const isAuthor = currentUserId === comment.userId;
    const isPostOwner = currentUserId === (postOwnerId || comment.post?.userId);

    let publisher: FormattedCommentPublisher;
    if (comment.identityType === 'alias') {
      const aliasWasDeleted = !comment.alias && !comment.aliasId;
      const isEn = this.i18n?.getCurrentLanguage?.() === 'en';
      publisher = {
        id: comment.aliasId || comment.alias?.id || null,
        name:
          comment.alias?.nickname ||
          (aliasWasDeleted
            ? isEn
              ? 'Deleted alias'
              : 'اسم مستعار محذوف'
            : 'Alias'),
        profileUrl:
          comment.alias?.avatarUrl ||
          'https://cdn.hayahbook.com/presets/aliases/preset-frog-red.jpg',
        role: 'alias',
        userType: 'Alias',
        isVerified: false,
        isAlias: true,
      };
    } else if (comment.identityType === 'anonymous' || comment.isAnonymous) {
      const isEn = this.i18n?.getCurrentLanguage?.() === 'en';
      const anonNum = comment.user?.anonymousNumber;
      const anonName = anonNum
        ? isEn
          ? `Anonymous Reader - ${anonNum}`
          : `مستخدم مجهول - ${anonNum}`
        : isEn
          ? 'Anonymous Reader'
          : 'مستخدم مجهول';
      publisher = {
        id: null,
        name: anonName,
        profileUrl: 'https://cdn.hayahbook.com/avatars/anonymous.png',
        role: 'anonymous',
        userType: 'Anonymous',
        isVerified: false,
        isAnonymous: true,
      };
    } else {
      publisher = {
        id: comment.user?.id || comment.userId,
        name: comment.user?.name || '',
        profileUrl: comment.user?.profileUrl || null,
        role: comment.user?.role || 'user',
        userType: comment.user?.userType || 'Reader',
        isVerified:
          comment.user?.role === 'admin' || comment.user?.userType === 'Author',
      };
    }

    let formattedReplyToUser: FormattedCommentPublisher | null = null;
    const isParentMaskedInFormat = Boolean(
      comment.parent &&
      (comment.parent.isAnonymous ||
        comment.parent.identityType === 'anonymous' ||
        comment.parent.identityType === 'alias') &&
      comment.replyToUser?.id === comment.parent.userId,
    );
    if (comment.replyToUser && !isParentMaskedInFormat) {
      formattedReplyToUser = {
        id: comment.replyToUser.id,
        name: comment.replyToUser.name || '',
        profileUrl: comment.replyToUser.profileUrl || null,
        role: comment.replyToUser.role || 'user',
        userType: comment.replyToUser.userType || 'Reader',
        isVerified:
          comment.replyToUser.role === 'admin' ||
          comment.replyToUser.userType === 'Author',
      };
    }

    let formattedMentions: FormattedCommentPublisher[] = [];
    if (Array.isArray(comment.mentions) && comment.mentions.length > 0) {
      if (preloadedMentions) {
        formattedMentions = comment.mentions
          .map((id) => preloadedMentions.get(id))
          .filter(Boolean) as FormattedCommentPublisher[];
      } else {
        try {
          const mentionedUsers = await this.usersRepo.find({
            where: { id: In(comment.mentions) },
          });
          formattedMentions = mentionedUsers.map((u) => ({
            id: u.id,
            name: u.name || '',
            profileUrl: u.profileUrl || null,
            role: u.role || 'user',
            userType: u.userType || 'Reader',
            isVerified: u.role === 'admin' || u.userType === 'Author',
          }));
        } catch {
          formattedMentions = [];
        }
      }
    }

    const permissions: FormattedCommentPermissions = {
      canEdit: isAuthor,
      canDelete: isAuthor || isPostOwner,
      canPin: isPostOwner,
      canHide: isAuthor || isPostOwner,
      canReply: true,
      canReport: !isAuthor,
    };

    return {
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      content: comment.content,
      imageUrl: comment.imageUrl,
      mentions: formattedMentions,
      replyToUser: formattedReplyToUser,
      publisher,
      repliesCount: comment.repliesCount || 0,
      likesCount: reactionsCount.total,
      reactionsCount,
      topReactions,
      userReaction: userReaction ?? null,
      isPinned: comment.isPinned || false,
      pinnedAt: comment.pinnedAt,
      isHidden: comment.isHidden || false,
      isEdited: comment.isEdited || false,
      isMuted,
      permissions,
      identityType: comment.identityType || 'primary',
      aliasId: comment.aliasId || null,
      isAnonymous: comment.isAnonymous || false,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
