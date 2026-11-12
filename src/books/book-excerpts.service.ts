import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserBookExcerpt } from './user-book-excerpt.entity';
import { Book } from './book.entity';
import { CreateExcerptDto } from './dto/create-excerpt.dto';
import { UpdateExcerptDto } from './dto/update-excerpt.dto';
import { ExcerptsQueryDto } from './dto/excerpts-query.dto';
import { I18nService } from '../i18n/i18n.service';

export interface FormattedExcerpt {
  id: string;
  bookId: string;
  userId: string;
  content: string;
  note: string | null;
  chapter: string | null;
  pageNumber: number | null;
  color: string;
  cfiRange: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class BookExcerptsService {
  constructor(
    @InjectRepository(UserBookExcerpt)
    private readonly excerptRepo: Repository<UserBookExcerpt>,
    @InjectRepository(Book)
    private readonly bookRepo: Repository<Book>,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Create a new excerpt for a book owned by the current authenticated user.
   */
  async createExcerpt(
    userId: string,
    bookId: string,
    dto: CreateExcerptDto,
  ): Promise<{ message: string; data: FormattedExcerpt }> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException(this.i18n.t('books.not_found'));
    }

    const excerpt = this.excerptRepo.create({
      userId,
      bookId,
      content: dto.content,
      note: dto.note || null,
      chapter: dto.chapter || null,
      pageNumber: dto.pageNumber || null,
      color: dto.color || '#FF7A00',
      cfiRange: dto.cfiRange || null,
    });

    const saved = await this.excerptRepo.save(excerpt);

    return {
      message: this.i18n.t('excerpts.created'),
      data: this.formatExcerpt(saved),
    };
  }

  /**
   * Get all excerpts for a specific book belonging strictly to the current user.
   */
  async getExcerptsForBook(
    userId: string,
    bookId: string,
    query: ExcerptsQueryDto = {},
  ): Promise<{
    book: {
      id: string;
      title: string;
      author: string | null;
      coverUrl: string | null;
      category: string | null;
    };
    data: FormattedExcerpt[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) {
      throw new NotFoundException(this.i18n.t('books.not_found'));
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.excerptRepo
      .createQueryBuilder('excerpt')
      .where('excerpt.userId = :userId', { userId })
      .andWhere('excerpt.bookId = :bookId', { bookId });

    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('(excerpt.content ILIKE :term OR excerpt.note ILIKE :term)', {
        term,
      });
    }

    if (query.chapter && query.chapter.trim()) {
      qb.andWhere('excerpt.chapter ILIKE :chapter', {
        chapter: `%${query.chapter.trim()}%`,
      });
    }

    const sortField =
      query.sortBy === 'pageNumber'
        ? 'excerpt.pageNumber'
        : query.sortBy === 'updatedAt'
          ? 'excerpt.updatedAt'
          : 'excerpt.createdAt';

    const sortOrder = query.order === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortField, sortOrder);
    if (sortField !== 'excerpt.createdAt') {
      qb.addOrderBy('excerpt.createdAt', 'DESC');
    }

    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      book: {
        id: book.id,
        title: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        category: book.category,
      },
      data: items.map((e) => this.formatExcerpt(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Get all books that have excerpts for the current user (summary grouped by book).
   * Perfect for displaying: "مقتطفاتي لكتاب 1، ومقتطفاتي لكتاب 2..."
   */
  async getMyBooksWithExcerpts(
    userId: string,
    query?: { search?: string; page?: number; limit?: number },
  ): Promise<{
    data: Array<{
      bookId: string;
      title: string;
      author: string | null;
      coverUrl: string | null;
      category: string | null;
      excerptsCount: number;
      latestExcerptAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.excerptRepo
      .createQueryBuilder('excerpt')
      .innerJoin('excerpt.book', 'book')
      .select('book.id', 'bookId')
      .addSelect('book.title', 'title')
      .addSelect('book.author', 'author')
      .addSelect('book.coverUrl', 'coverUrl')
      .addSelect('book.category', 'category')
      .addSelect('COUNT(excerpt.id)', 'excerptsCount')
      .addSelect('MAX(excerpt.createdAt)', 'latestExcerptAt')
      .where('excerpt.userId = :userId', { userId })
      .groupBy('book.id')
      .addGroupBy('book.title')
      .addGroupBy('book.author')
      .addGroupBy('book.coverUrl')
      .addGroupBy('book.category');

    if (query?.search && query.search.trim()) {
      qb.andWhere('(book.title ILIKE :term OR book.author ILIKE :term)', {
        term: `%${query.search.trim()}%`,
      });
    }

    qb.orderBy('"latestExcerptAt"', 'DESC');

    const rawTotal = await qb.getCount();
    const rawResults = await qb.offset(skip).limit(limit).getRawMany();

    const data = rawResults.map((r) => ({
      bookId: r.bookId,
      title: r.title,
      author: r.author,
      coverUrl: r.coverUrl,
      category: r.category,
      excerptsCount: Number(r.excerptsCount) || 0,
      latestExcerptAt: r.latestExcerptAt,
    }));

    return {
      data,
      total: rawTotal,
      page,
      limit,
      totalPages: Math.ceil(rawTotal / limit) || 1,
    };
  }

  /**
   * Get a single excerpt by ID, ensuring strict ownership.
   */
  async getExcerptById(
    userId: string,
    excerptId: string,
  ): Promise<FormattedExcerpt & { book?: any }> {
    const excerpt = await this.excerptRepo.findOne({
      where: { id: excerptId },
      relations: { book: true },
    });

    if (!excerpt || excerpt.userId !== userId) {
      throw new NotFoundException(this.i18n.t('excerpts.not_found'));
    }

    return {
      ...this.formatExcerpt(excerpt),
      book: excerpt.book
        ? {
            id: excerpt.book.id,
            title: excerpt.book.title,
            author: excerpt.book.author,
            coverUrl: excerpt.book.coverUrl,
          }
        : undefined,
    };
  }

  /**
   * Update an excerpt, ensuring strict ownership.
   */
  async updateExcerpt(
    userId: string,
    excerptId: string,
    dto: UpdateExcerptDto,
  ): Promise<{ message: string; data: FormattedExcerpt }> {
    const excerpt = await this.excerptRepo.findOne({
      where: { id: excerptId },
    });

    if (!excerpt || excerpt.userId !== userId) {
      throw new NotFoundException(this.i18n.t('excerpts.not_found'));
    }

    if (dto.content !== undefined) excerpt.content = dto.content;
    if (dto.note !== undefined) excerpt.note = dto.note || null;
    if (dto.chapter !== undefined) excerpt.chapter = dto.chapter || null;
    if (dto.pageNumber !== undefined) excerpt.pageNumber = dto.pageNumber || null;
    if (dto.color !== undefined) excerpt.color = dto.color;
    if (dto.cfiRange !== undefined) excerpt.cfiRange = dto.cfiRange || null;

    const saved = await this.excerptRepo.save(excerpt);

    return {
      message: this.i18n.t('excerpts.updated'),
      data: this.formatExcerpt(saved),
    };
  }

  /**
   * Delete an excerpt, ensuring strict ownership.
   */
  async deleteExcerpt(
    userId: string,
    excerptId: string,
  ): Promise<{ message: string; success: boolean }> {
    const excerpt = await this.excerptRepo.findOne({
      where: { id: excerptId },
    });

    if (!excerpt || excerpt.userId !== userId) {
      throw new NotFoundException(this.i18n.t('excerpts.not_found'));
    }

    await this.excerptRepo.remove(excerpt);

    return {
      message: this.i18n.t('excerpts.deleted'),
      success: true,
    };
  }

  private formatExcerpt(entity: UserBookExcerpt): FormattedExcerpt {
    return {
      id: entity.id,
      bookId: entity.bookId,
      userId: entity.userId,
      content: entity.content,
      note: entity.note ?? null,
      chapter: entity.chapter ?? null,
      pageNumber: entity.pageNumber ?? null,
      color: entity.color || '#FF7A00',
      cfiRange: entity.cfiRange ?? null,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
