import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { UploadService } from '../upload/upload.service';
import { I18nService } from '../i18n/i18n.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { CommentsQueryDto, CommentSortType } from './dto/comments-query.dto';
import { UploadFile } from '../upload/upload-file.interface';
import type { ReactionType, PostReactionsCount } from '../posts/post-reaction.entity';

export interface FormattedCommentPublisher {
  id: string;
  name: string;
  profileUrl: string | null;
  role: string;
  userType: string;
  isVerified: boolean;
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
  author?: FormattedCommentPublisher;
  user?: FormattedCommentPublisher;
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
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  canHide: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies?: FormattedComment[];
}

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
  ) {}

  /**
   * Normalize input reaction string from English or Arabic into standard canonical ReactionType
   */
  normalizeReactionType(input?: string): ReactionType | null {
    if (!input) return null;
    const val = input.trim().toLowerCase();

    if (val === 'agree' || val === 'اتفق' || val === 'اتفاق' || val === 'like') {
      return 'agree';
    }
    if (val === 'love' || val === 'احببته' || val === 'أحببته' || val === 'حب' || val === 'love it') {
      return 'love';
    }
    if (val === 'applaud' || val === 'احسنت' || val === 'أحسنت' || val === 'bravo' || val === 'clap') {
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
    if (val === 'disagree' || val === 'اعترض' || val === 'أعترض' || val === 'اعتراض') {
      return 'disagree';
    }

    return null;
  }

  /**
   * Return the 3 standard comment sorting options matching the design sheet
   */
  getSortOptions() {
    return [
      {
        key: 'most_relevant',
        titleEn: 'Most Relevant',
        titleAr: 'الأكثر صلة',
        descriptionEn: 'See comments from friends and the most relevant comments first.',
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
        descriptionEn: 'Show all comments, including potentially offensive ones.',
        descriptionAr: 'عرض جميع التعليقات بما في ذلك التعليقات المحتمل أنها مسيئة.',
        isDefault: false,
      },
    ];
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

    let finalImageUrl: string | null = dto.imageUrl?.trim() || null;
    if (imageFile) {
      finalImageUrl = await this.uploadService.uploadCommentImage(userId, imageFile);
    }

    const comment = this.commentsRepo.create({
      postId: targetPostId,
      userId,
      parentId: null,
      replyToUserId: null,
      content: dto.content.trim(),
      imageUrl: finalImageUrl,
      mentions: this.extractMentions(dto.content, dto.mentions),
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

    const saved = await this.commentsRepo.save(comment);

    // Increment post's comments_count
    await this.postsRepo.increment({ id: targetPostId }, 'commentsCount', 1);

    // Pre-load user details for formatting
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    saved.user = user!;
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

    // Two-level mobile threading architecture:
    // If the parent is already a reply, its parentId becomes the root comment ID,
    // and replyToUserId is automatically set to the author of that reply!
    const effectiveParentId = parent.parentId ? parent.parentId : parent.id;
    const effectiveReplyToUserId = dto.replyToUserId || parent.userId;

    let finalImageUrl: string | null = dto.imageUrl?.trim() || null;
    if (imageFile) {
      finalImageUrl = await this.uploadService.uploadCommentImage(userId, imageFile);
    }

    const reply = this.commentsRepo.create({
      postId: parent.postId,
      userId,
      parentId: effectiveParentId,
      replyToUserId: effectiveReplyToUserId,
      content: dto.content.trim(),
      imageUrl: finalImageUrl,
      mentions: this.extractMentions(dto.content, dto.mentions),
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

    const saved = await this.commentsRepo.save(reply);

    // Increment root comment's replies_count
    await this.commentsRepo.increment({ id: effectiveParentId }, 'repliesCount', 1);

    // Increment post's total comments_count
    await this.postsRepo.increment({ id: parent.postId }, 'commentsCount', 1);

    // Load relations for response
    const [user, replyToUser] = await Promise.all([
      this.usersRepo.findOne({ where: { id: userId } }),
      effectiveReplyToUserId
        ? this.usersRepo.findOne({ where: { id: effectiveReplyToUserId } })
        : Promise.resolve(null),
    ]);

    saved.user = user!;
    saved.replyToUser = replyToUser;
    saved.post = parent.post;

    const formatted = await this.formatComment(saved, userId, parent.post?.userId);

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

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
    const sort = this.normalizeSort(query.sort);

    const qb = this.commentsRepo
      .createQueryBuilder('comment')
      .leftJoinAndSelect('comment.user', 'user')
      .where('comment.postId = :postId', { postId })
      .andWhere('comment.parentId IS NULL');

    // Filter hidden comments:
    // Option 3: 'all_comments' ("Show all comments, including potentially offensive ones.")
    // In 'all_comments' mode, do NOT exclude hidden/offensive comments.
    if (sort !== 'all_comments') {
      if (currentUserId && currentUserId !== post.userId) {
        qb.andWhere('(comment.isHidden = false OR comment.userId = :currentUserId)', {
          currentUserId,
        });
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
             WHEN comment.userId = :postAuthorId THEN 2 
             WHEN comment.userId IN (:...friendUserIds) THEN 1 
             ELSE 0 
           END`,
          'friend_priority',
        );
        qb.setParameter('postAuthorId', post.userId);
        qb.setParameter('friendUserIds', friendUserIds);
        qb.addOrderBy('friend_priority', 'DESC');
      } else {
        qb.addSelect(
          `CASE WHEN comment.userId = :postAuthorId THEN 1 ELSE 0 END`,
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

    const data = await this.formatCommentsList(items, currentUserId, post.userId);

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

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));

    const qb = this.commentsRepo
      .createQueryBuilder('reply')
      .leftJoinAndSelect('reply.user', 'user')
      .leftJoinAndSelect('reply.replyToUser', 'replyToUser')
      .where('reply.parentId = :commentId', { commentId })
      .orderBy('reply.createdAt', 'ASC') // Chronological ordering for conversational replies
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const data = await this.formatCommentsList(items, currentUserId, parent.post?.userId);

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
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }

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
      const oldType = existing.reactionType;

      existing.reactionType = targetType;
      await this.commentReactionsRepo.save(existing);

      counts[oldType] = Math.max(0, (counts[oldType] || 1) - 1);
      counts[targetType] = (counts[targetType] || 0) + 1;
    }

    comment.reactionsCount = counts;
    comment.likesCount = counts.total;
    await this.commentsRepo.save(comment);

    const reactionKeys: ReactionType[] = ['agree', 'love', 'applaud', 'insightful', 'disagree'];
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
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
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
    }

    const reactionKeys: ReactionType[] = ['agree', 'love', 'applaud', 'insightful', 'disagree'];
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
      relations: { user: true, post: true },
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
    const formatted = await this.formatComment(saved, userId, comment.post?.userId);

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

    // Calculate number of items being deleted
    let totalDeleted = 1;
    if (!comment.parentId) {
      const childCount = await this.commentsRepo.count({
        where: { parentId: commentId },
      });
      totalDeleted += childCount;
    } else {
      // Decrement parent's repliesCount
      await this.commentsRepo.decrement({ id: comment.parentId }, 'repliesCount', 1);
    }

    // Decrement post's commentsCount
    await this.postsRepo.decrement({ id: comment.postId }, 'commentsCount', totalDeleted);

    // Clean up uploaded image if exists
    if (comment.imageUrl) {
      try {
        await this.uploadService.deleteFileByUrl(comment.imageUrl);
      } catch {
        // Ignored
      }
    }

    await this.commentsRepo.delete({ id: commentId });

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
      message: this.i18n.t(comment.isHidden ? 'comments.hidden' : 'comments.unhidden'),
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
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
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
  ): Promise<{ message: string }> {
    const comment = await this.commentsRepo.findOne({
      where: { id: commentId },
    });
    if (!comment) {
      throw new NotFoundException(this.i18n.t('comments.not_found'));
    }

    const report = this.commentReportsRepo.create({
      commentId,
      userId,
      reason: reason?.trim() || null,
    });
    await this.commentReportsRepo.save(report);

    return {
      message: this.i18n.t('comments.reported'),
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

    const commentIds = comments.map((c) => c.id);

    // Batch load user reactions
    const userReactionsMap = new Map<string, ReactionType>();
    if (currentUserId) {
      try {
        const reactions = await this.commentReactionsRepo.find({
          where: { commentId: In(commentIds), userId: currentUserId },
          select: { commentId: true, reactionType: true },
        });
        for (const r of reactions) {
          userReactionsMap.set(r.commentId, r.reactionType);
        }
      } catch {
        // Ignored
      }
    }

    // Batch load mutes
    const mutedSet = new Set<string>();
    if (currentUserId) {
      try {
        const mutes = await this.commentMutesRepo.find({
          where: { commentId: In(commentIds), userId: currentUserId },
          select: { commentId: true },
        });
        for (const m of mutes) {
          mutedSet.add(m.commentId);
        }
      } catch {
        // Ignored
      }
    }

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
          .leftJoinAndSelect('reply.replyToUser', 'replyToUser')
          .where('reply.parentId IN (:...rootCommentIdsWithReplies)', { rootCommentIdsWithReplies })
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
                    userReactionsMap.get(r.id) || null,
                    mutedSet.has(r.id),
                  ),
                ),
              )
            : undefined;

        const formatted = await this.formatComment(
          c,
          currentUserId,
          postOwnerId || c.post?.userId,
          userReactionsMap.get(c.id) || null,
          mutedSet.has(c.id),
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

    const reactionKeys: ReactionType[] = ['agree', 'love', 'applaud', 'insightful', 'disagree'];
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

    const publisher: FormattedCommentPublisher = {
      id: comment.user?.id || comment.userId,
      name: comment.user?.name || '',
      profileUrl: comment.user?.profileUrl || null,
      role: comment.user?.role || 'user',
      userType: comment.user?.userType || 'Reader',
      isVerified: comment.user?.role === 'admin' || comment.user?.userType === 'Author',
    };

    let formattedReplyToUser: FormattedCommentPublisher | null = null;
    if (comment.replyToUser) {
      formattedReplyToUser = {
        id: comment.replyToUser.id,
        name: comment.replyToUser.name || '',
        profileUrl: comment.replyToUser.profileUrl || null,
        role: comment.replyToUser.role || 'user',
        userType: comment.replyToUser.userType || 'Reader',
        isVerified: comment.replyToUser.role === 'admin' || comment.replyToUser.userType === 'Author',
      };
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
      mentions: [],
      replyToUser: formattedReplyToUser,
      publisher,
      author: publisher,
      user: publisher,
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
      canEdit: isAuthor,
      canDelete: isAuthor || isPostOwner,
      canPin: isPostOwner,
      canHide: isAuthor || isPostOwner,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}

