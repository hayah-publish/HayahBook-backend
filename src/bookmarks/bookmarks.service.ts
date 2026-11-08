import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserBookmark } from './bookmark.entity';
import { Post } from '../posts/post.entity';
import { FormattedPost, PostsService } from '../posts/posts.service';
import { I18nService } from '../i18n/i18n.service';
import { BookmarksQueryDto } from './dto/bookmarks-query.dto';

export type BookmarkTabType =
  | 'all'
  | 'posts'
  | 'articles'
  | 'visuals'
  | 'snippets';

export interface BookmarkCounts {
  all: number;
  posts: number;
  articles: number;
  visuals: number;
  snippets: number;
}

@Injectable()
export class BookmarksService {
  constructor(
    @InjectRepository(UserBookmark)
    private readonly bookmarksRepository: Repository<UserBookmark>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    private readonly postsService: PostsService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Normalize input tab string from English or Arabic into standard canonical tab key
   */
  normalizeType(input?: string): BookmarkTabType {
    if (!input) return 'all';
    const val = input.trim().toLowerCase();

    if (val === 'all' || val === 'الكل') return 'all';
    if (val === 'posts' || val === 'post' || val === 'المنشورات' || val === 'منشورات') {
      return 'posts';
    }
    if (val === 'articles' || val === 'article' || val === 'المقالات' || val === 'مقالات') {
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
      val === 'اقتباسات'
    ) {
      return 'snippets';
    }

    return 'all';
  }

  /**
   * Apply category/type filter to the bookmark query
   */
  private applyFilter(qb: SelectQueryBuilder<UserBookmark>, tab: BookmarkTabType) {
    if (tab === 'articles') {
      qb.andWhere("post.type = 'article'");
    } else if (tab === 'visuals') {
      qb.andWhere(
        "(post.type = 'visual' OR (post.videoUrl IS NOT NULL AND post.videoUrl != '') OR post.category ILIKE 'المرئيات' OR post.category ILIKE 'Visuals')",
      );
    } else if (tab === 'snippets') {
      qb.andWhere(
        "(post.type = 'snippet' OR post.category ILIKE 'المقتطفات' OR post.category ILIKE 'Snippets')",
      );
    } else if (tab === 'posts') {
      qb.andWhere(
        "post.type = 'post' AND (post.videoUrl IS NULL OR post.videoUrl = '') AND (post.category NOT IN ('المقتطفات', 'Snippets', 'المرئيات', 'Visuals') OR post.category IS NULL)",
      );
    }
    // 'all' requires no extra conditions
  }

  /**
   * GET /v1/bookmarks or GET /v1/saved
   * Returns user's saved items with tab filters and pagination
   */
  async findAll(
    userId: string,
    query: BookmarksQueryDto,
  ): Promise<{
    data: FormattedPost[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    counts: BookmarkCounts;
  }> {
    const tab = this.normalizeType(query.type);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    const qb = this.bookmarksRepository
      .createQueryBuilder('bookmark')
      .innerJoinAndSelect('bookmark.post', 'post')
      .leftJoinAndSelect('post.user', 'publisher')
      .leftJoinAndSelect('post.book', 'book')
      .leftJoinAndSelect('post.audiobook', 'audiobook')
      .where('bookmark.userId = :userId', { userId });

    this.applyFilter(qb, tab);

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(post.title ILIKE :term OR post.content ILIKE :term)',
        { term },
      );
    }

    qb.orderBy('bookmark.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    const counts = await this.getCounts(userId);

    const data: FormattedPost[] = await Promise.all(
      items.map(async (item) => {
        const formatted = await this.postsService.formatPost(item.post);
        return {
          ...formatted,
          isSaved: true,
          savedAt: item.createdAt,
        };
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      counts,
    };
  }

  /**
   * Calculate saved count for each of the 5 tabs
   */
  async getCounts(userId: string): Promise<BookmarkCounts> {
    const rawList = await this.bookmarksRepository
      .createQueryBuilder('bookmark')
      .innerJoin('bookmark.post', 'post')
      .where('bookmark.userId = :userId', { userId })
      .select([
        'bookmark.id AS id',
        'post.type AS post_type',
        'post.videoUrl AS post_video_url',
        'post.category AS post_category',
      ])
      .getRawMany();

    let posts = 0;
    let articles = 0;
    let visuals = 0;
    let snippets = 0;

    for (const row of rawList) {
      const pType = row.post_type;
      const hasVideo = !!row.post_video_url;
      const cat = (row.post_category || '').toLowerCase();

      const isVisual =
        pType === 'visual' ||
        hasVideo ||
        cat === 'المرئيات' ||
        cat === 'visuals';
      const isSnippet =
        pType === 'snippet' ||
        cat === 'المقتطفات' ||
        cat === 'snippets';
      const isArticle = pType === 'article';

      if (isVisual) visuals++;
      if (isSnippet) snippets++;
      if (isArticle) articles++;
      if (pType === 'post' && !hasVideo && !isSnippet && !isVisual) {
        posts++;
      }
    }

    return {
      all: rawList.length,
      posts,
      articles,
      visuals,
      snippets,
    };
  }

  /**
   * Toggle save/unsave on a post or article
   */
  async toggleBookmark(
    userId: string,
    postId: string,
  ): Promise<{
    message: string;
    isSaved: boolean;
    bookmarksCount: number;
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(this.i18n.t('bookmarks.not_found'));
    }

    const existing = await this.bookmarksRepository.findOne({
      where: { userId, postId },
    });

    if (existing) {
      await this.bookmarksRepository.delete({ id: existing.id });
      await this.postsRepository.decrement({ id: postId }, 'bookmarksCount', 1);
      const newCount = Math.max(0, (post.bookmarksCount || 1) - 1);
      return {
        message: this.i18n.t('bookmarks.removed'),
        isSaved: false,
        bookmarksCount: newCount,
      };
    }

    const bookmark = this.bookmarksRepository.create({ userId, postId });
    await this.bookmarksRepository.save(bookmark);
    await this.postsRepository.increment({ id: postId }, 'bookmarksCount', 1);
    const newCount = (post.bookmarksCount || 0) + 1;

    return {
      message: this.i18n.t('bookmarks.saved'),
      isSaved: true,
      bookmarksCount: newCount,
    };
  }

  /**
   * Explicitly remove a post or article from bookmarks
   */
  async removeBookmark(
    userId: string,
    postId: string,
  ): Promise<{
    message: string;
    isSaved: boolean;
    bookmarksCount: number;
  }> {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException(this.i18n.t('bookmarks.not_found'));
    }

    const existing = await this.bookmarksRepository.findOne({
      where: { userId, postId },
    });

    if (existing) {
      await this.bookmarksRepository.delete({ id: existing.id });
      await this.postsRepository.decrement({ id: postId }, 'bookmarksCount', 1);
      return {
        message: this.i18n.t('bookmarks.removed'),
        isSaved: false,
        bookmarksCount: Math.max(0, (post.bookmarksCount || 1) - 1),
      };
    }

    return {
      message: this.i18n.t('bookmarks.already_removed'),
      isSaved: false,
      bookmarksCount: post.bookmarksCount || 0,
    };
  }

  /**
   * Check if a single post is saved by user
   */
  async checkSaved(
    userId: string,
    postId: string,
  ): Promise<{ postId: string; isSaved: boolean }> {
    const existing = await this.bookmarksRepository.findOne({
      where: { userId, postId },
      select: { id: true },
    });
    return {
      postId,
      isSaved: !!existing,
    };
  }
}

