import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import { Book } from './book.entity';
import { Audiobook } from './audiobook.entity';
import { UserBook } from './user-book.entity';
import { UserAlias } from '../aliases/user-alias.entity';
import { User } from '../users/user.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { CreateAudiobookDto } from './dto/create-audiobook.dto';
import { UpdateAudiobookDto } from './dto/update-audiobook.dto';
import { UpdateReadingStatusDto } from './dto/update-reading-status.dto';
import { MyBooksQueryDto } from './dto/my-books-query.dto';
import { I18nService } from '../i18n/i18n.service';
import { SEED_BOOKS, SEED_AUDIOBOOKS } from './books.seed';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FormattedUserBook {
  id: string;
  bookId: string | null;
  audiobookId: string | null;
  title: string;
  author: string | null;
  narrator?: string | null;
  category: string | null;
  type: 'ebook' | 'audiobook' | 'both';
  contentType: 'ebook' | 'audiobook' | 'both';
  hasEbook: boolean;
  hasAudio: boolean;
  availableFormats: ('ebook' | 'audiobook')[];
  coverUrl: string | null;
  audioUrl?: string | null;
  duration?: number | null;
  status: 'finished' | 'reading' | 'want_to_read';
  progress: number;
  rating: number;
  readsCount: number;
  listensCount: number;
  views: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly booksRepository: Repository<Book>,
    @InjectRepository(Audiobook)
    private readonly audiobooksRepository: Repository<Audiobook>,
    @InjectRepository(UserBook)
    private readonly userBooksRepository: Repository<UserBook>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async seedDevelopmentCatalog(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Development catalog seeding is disabled in production');
    }
    const booksByTitle = new Map<string, Book>();
    for (const item of SEED_BOOKS) {
      let book = await this.booksRepository.findOne({
        where: { title: item.title },
      });
      if (!book)
        book = await this.booksRepository.save(
          this.booksRepository.create(item),
        );
      booksByTitle.set(book.title, book);
    }
    for (const item of SEED_AUDIOBOOKS) {
      const exists = await this.audiobooksRepository.findOne({
        where: { title: item.title },
      });
      if (exists) continue;
      const { companionBookTitle, ...audioFields } = item;
      const companion = companionBookTitle
        ? booksByTitle.get(companionBookTitle)
        : undefined;
      await this.audiobooksRepository.save(
        this.audiobooksRepository.create({
          ...audioFields,
          bookId: companion?.id ?? null,
        }),
      );
    }
  }

  private async seedBooksAndAudiobooks() {
    // 1. Seed or update e-books in 'books' table
    for (const item of SEED_BOOKS) {
      const existing = await this.booksRepository.findOne({
        where: { title: item.title },
      });
      if (!existing) {
        const book = this.booksRepository.create(item);
        await this.booksRepository.save(book);
      } else {
        existing.author = existing.author || item.author;
        existing.category = existing.category || item.category;
        existing.coverUrl = existing.coverUrl || item.coverUrl;
        existing.rating = item.rating;
        existing.views = item.views;
        existing.readsCount = item.readsCount;
        existing.contentType = 'ebook';
        await this.booksRepository.save(existing);
      }
    }

    // 2. Seed or update audiobooks in 'audiobooks' table
    const allBooks = await this.booksRepository.find();
    const booksByTitle = new Map(allBooks.map((b) => [b.title, b]));

    for (const item of SEED_AUDIOBOOKS) {
      const companionBook = item.companionBookTitle
        ? booksByTitle.get(item.companionBookTitle)
        : null;

      const existing = await this.audiobooksRepository.findOne({
        where: { title: item.title },
      });

      if (!existing) {
        const audiobook = this.audiobooksRepository.create({
          title: item.title,
          author: item.author,
          narrator: item.narrator,
          category: item.category,
          description: item.description,
          coverUrl: item.coverUrl,
          audioUrl: item.audioUrl || null,
          duration: item.duration,
          rating: item.rating,
          views: item.views,
          listensCount: item.listensCount,
          bookId: companionBook?.id || null,
        });
        await this.audiobooksRepository.save(audiobook);
      } else {
        existing.author = item.author;
        existing.narrator = item.narrator;
        existing.category = item.category;
        existing.description = item.description;
        existing.coverUrl = item.coverUrl;
        existing.audioUrl = item.audioUrl || existing.audioUrl;
        existing.duration = item.duration;
        existing.rating = item.rating;
        existing.views = item.views;
        existing.listensCount = item.listensCount;
        existing.bookId = companionBook?.id || existing.bookId;
        await this.audiobooksRepository.save(existing);
      }
    }

    // 3. Seed reading & listening list for existing users if needed
    const allUsers = await this.usersRepository.find({
      select: { id: true, email: true, name: true },
    });
    if (allUsers.length === 0) return;

    const allAudiobooks = await this.audiobooksRepository.find();
    const audiobooksByTitle = new Map(
      allAudiobooks.map((ab) => [ab.title, ab]),
    );

    const userBooksCount = await this.userBooksRepository.count();

    if (userBooksCount === 0) {
      const now = new Date();
      const pastDate1 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const pastDate2 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

      // Book candidates
      const weakPointsBook = booksByTitle.get('نقاط ضعفك');
      const weakPointsAudio = audiobooksByTitle.get('نقاط ضعفك');

      const executionerBook = booksByTitle.get('الجلاد تحت جلدي');
      const executionerAudio = audiobooksByTitle.get('الجلاد تحت جلدي');

      const atomicHabitsBook = booksByTitle.get('العادات الذرية');
      const atomicHabitsAudio = audiobooksByTitle.get('العادات الذرية');

      const loveRulesBook = booksByTitle.get('قواعد العشق الأربعون');

      const subtleArtBook = booksByTitle.get('فن اللامبالاة');
      const subtleArtAudio = audiobooksByTitle.get('فن اللامبالاة');

      const granadaBook = booksByTitle.get('ثلاثية غرناطة');

      const fnjanAudio = audiobooksByTitle.get(
        'أسرار القراءة والتفكير - بودكاست فنجان',
      );

      const sealedNectarBook = booksByTitle.get('الرحيق المختوم');
      const sealedNectarAudio = audiobooksByTitle.get('الرحيق المختوم');

      const elakkadAudio = audiobooksByTitle.get('عبقريات العقاد الصوتية');

      for (const user of allUsers) {
        // Finished 1: نقاط ضعفك (both)
        if (weakPointsBook) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: weakPointsBook.id,
              audiobookId: weakPointsAudio?.id || null,
              status: 'finished',
              progress: 100,
              rating: 4.5,
              startedAt: pastDate2,
              finishedAt: pastDate1,
            }),
          );
        }

        // Finished 2: الجلاد تحت جلدي (both)
        if (executionerBook) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: executionerBook.id,
              audiobookId: executionerAudio?.id || null,
              status: 'finished',
              progress: 100,
              rating: 4.5,
              startedAt: pastDate2,
              finishedAt: pastDate1,
            }),
          );
        }

        // Finished 3: العادات الذرية (both)
        if (atomicHabitsBook) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: atomicHabitsBook.id,
              audiobookId: atomicHabitsAudio?.id || null,
              status: 'finished',
              progress: 100,
              rating: 4.8,
              startedAt: pastDate1,
              finishedAt: now,
            }),
          );
        }

        // Finished 4: قواعد العشق الأربعون (ebook only)
        if (loveRulesBook) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: loveRulesBook.id,
              audiobookId: null,
              status: 'finished',
              progress: 100,
              rating: 4.6,
              startedAt: pastDate1,
              finishedAt: now,
            }),
          );
        }

        // Reading 1: فن اللامبالاة (both)
        if (subtleArtBook) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: subtleArtBook.id,
              audiobookId: subtleArtAudio?.id || null,
              status: 'reading',
              progress: 65,
              rating: null,
              startedAt: now,
              finishedAt: null,
            }),
          );
        }

        // Reading 2: ثلاثية غرناطة (ebook only)
        if (granadaBook) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: granadaBook.id,
              audiobookId: null,
              status: 'reading',
              progress: 40,
              rating: null,
              startedAt: now,
              finishedAt: null,
            }),
          );
        }

        // Reading 3: أسرار القراءة والتفكير - بودكاست فنجان (audiobook only)
        if (fnjanAudio) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: null,
              audiobookId: fnjanAudio.id,
              status: 'reading',
              progress: 80,
              rating: null,
              startedAt: now,
              finishedAt: null,
            }),
          );
        }

        // Want to read 1: الرحيق المختوم (both)
        if (sealedNectarBook) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: sealedNectarBook.id,
              audiobookId: sealedNectarAudio?.id || null,
              status: 'want_to_read',
              progress: 0,
              rating: null,
              startedAt: null,
              finishedAt: null,
            }),
          );
        }

        // Want to read 2: عبقريات العقاد الصوتية (audiobook only)
        if (elakkadAudio) {
          await this.userBooksRepository.save(
            this.userBooksRepository.create({
              userId: user.id,
              bookId: null,
              audiobookId: elakkadAudio.id,
              status: 'want_to_read',
              progress: 0,
              rating: null,
              startedAt: null,
              finishedAt: null,
            }),
          );
        }
      }
    }
  }

  // E-Books CRUD
  async findAll(page = 1, limit = 20): Promise<PaginatedResult<Book>> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const [data, total] = await this.booksRepository.findAndCount({
      relations: { audiobooks: true },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async create(createBookDto: CreateBookDto): Promise<Book> {
    const book = this.booksRepository.create(createBookDto);
    return this.booksRepository.save(book);
  }

  async update(id: string, updateBookDto: UpdateBookDto): Promise<Book> {
    const existingBook = await this.findOne(id);
    const updatedBook = this.booksRepository.merge(existingBook, updateBookDto);
    return this.booksRepository.save(updatedBook);
  }

  async remove(id: string): Promise<void> {
    const result = await this.booksRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(this.i18n.t('books.not_found'));
    }
  }

  async findOne(id: string): Promise<Book> {
    const book = await this.booksRepository.findOne({
      where: { id },
      relations: { audiobooks: true },
    });

    if (!book) {
      throw new NotFoundException(this.i18n.t('books.not_found'));
    }

    return book;
  }

  async search(
    query: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Book>> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const [data, total] = await this.booksRepository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.audiobooks', 'audiobooks')
      .where(
        `(
          book.title ILIKE :query
          OR book.author ILIKE :query
          OR book.category ILIKE :query
        )`,
        { query: `%${query}%` },
      )
      .orderBy('book.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async findByType(
    type: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Book>> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const [data, total] = await this.booksRepository.findAndCount({
      where: { contentType: type },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async filterBooks(
    page = 1,
    limit = 20,
    query?: string,
    type?: 'ebook' | 'audiobook',
    category?: string,
  ): Promise<PaginatedResult<Book>> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const qb = this.booksRepository
      .createQueryBuilder('book')
      .leftJoinAndSelect('book.audiobooks', 'audiobooks');

    if (query?.trim()) {
      qb.andWhere(
        '(book.title ILIKE :query OR book.author ILIKE :query OR book.category ILIKE :query)',
        { query: `%${query.trim()}%` },
      );
    }

    if (type) {
      qb.andWhere('book.contentType = :type', { type });
    }

    if (category?.trim()) {
      qb.andWhere('book.category ILIKE :category', {
        category: `%${category.trim()}%`,
      });
    }

    qb.orderBy('book.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async getCategoryCounts(): Promise<{ category: string; count: number }[]> {
    const results = await this.booksRepository
      .createQueryBuilder('book')
      .select('book.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('book.category IS NOT NULL')
      .andWhere("TRIM(book.category) <> ''")
      .groupBy('book.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return results.map((item) => ({
      category: item.category,
      count: Number(item.count),
    }));
  }

  // Audiobooks CRUD
  async findAllAudiobooks(
    page = 1,
    limit = 20,
    category?: string,
    query?: string,
  ): Promise<PaginatedResult<Audiobook>> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const qb = this.audiobooksRepository
      .createQueryBuilder('audiobook')
      .leftJoinAndSelect('audiobook.book', 'book');

    if (query?.trim()) {
      qb.andWhere(
        '(audiobook.title ILIKE :query OR audiobook.author ILIKE :query OR audiobook.narrator ILIKE :query OR audiobook.category ILIKE :query)',
        { query: `%${query.trim()}%` },
      );
    }

    if (category?.trim()) {
      qb.andWhere('audiobook.category ILIKE :category', {
        category: `%${category.trim()}%`,
      });
    }

    qb.orderBy('audiobook.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async findLatestAudiobooks(limit = 20): Promise<PaginatedResult<Audiobook>> {
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    return this.findAllAudiobooks(1, safeLimit);
  }

  async searchAudiobooks(
    query: string,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Audiobook>> {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const [data, total] = await this.audiobooksRepository
      .createQueryBuilder('audiobook')
      .leftJoinAndSelect('audiobook.book', 'book')
      .where(
        `(
          audiobook.title ILIKE :query
          OR audiobook.author ILIKE :query
          OR audiobook.narrator ILIKE :query
          OR audiobook.category ILIKE :query
        )`,
        { query: `%${query}%` },
      )
      .orderBy('audiobook.createdAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  async getAudiobookCategoryCounts(): Promise<
    { category: string; count: number }[]
  > {
    const results = await this.audiobooksRepository
      .createQueryBuilder('audiobook')
      .select('audiobook.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('audiobook.category IS NOT NULL')
      .andWhere("TRIM(audiobook.category) <> ''")
      .groupBy('audiobook.category')
      .orderBy('count', 'DESC')
      .getRawMany();

    return results.map((item) => ({
      category: item.category,
      count: Number(item.count),
    }));
  }

  async findOneAudiobook(id: string): Promise<Audiobook> {
    const audiobook = await this.audiobooksRepository.findOne({
      where: { id },
      relations: { book: true },
    });
    if (!audiobook) {
      throw new NotFoundException(this.i18n.t('audiobooks.not_found'));
    }
    return audiobook;
  }

  async createAudiobook(dto: CreateAudiobookDto): Promise<Audiobook> {
    const audiobook = this.audiobooksRepository.create(dto);
    return this.audiobooksRepository.save(audiobook);
  }

  async updateAudiobook(
    id: string,
    dto: UpdateAudiobookDto,
  ): Promise<Audiobook> {
    const existing = await this.findOneAudiobook(id);
    const updated = this.audiobooksRepository.merge(existing, dto);
    return this.audiobooksRepository.save(updated);
  }

  async removeAudiobook(id: string): Promise<void> {
    const result = await this.audiobooksRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(this.i18n.t('audiobooks.not_found'));
    }
  }

  // Combined Reading & Listening Tracker (My Books)
  async getMyBooks(
    userId: string,
    query: MyBooksQueryDto,
  ): Promise<{
    data: FormattedUserBook[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));

    const qb = this.userBooksRepository
      .createQueryBuilder('ub')
      .leftJoinAndSelect('ub.book', 'book')
      .leftJoinAndSelect('ub.audiobook', 'audiobook')
      .where('ub.user_id = :userId', { userId });

    if (query.status && query.status !== 'all') {
      qb.andWhere('ub.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      qb.andWhere(
        `(
          book.title ILIKE :search OR book.author ILIKE :search OR book.category ILIKE :search
          OR audiobook.title ILIKE :search OR audiobook.author ILIKE :search OR audiobook.narrator ILIKE :search
        )`,
        { search: `%${query.search.trim()}%` },
      );
    }

    if (query.type === 'ebook') qb.andWhere('ub.bookId IS NOT NULL');
    else if (query.type === 'audiobook')
      qb.andWhere('ub.audiobookId IS NOT NULL');
    else if (query.type === 'both')
      qb.andWhere('ub.bookId IS NOT NULL AND ub.audiobookId IS NOT NULL');

    qb.orderBy('ub.finishedAt', 'DESC', 'NULLS LAST')
      .addOrderBy('ub.updatedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [allItems, total] = await qb.getManyAndCount();

    const formattedData: FormattedUserBook[] = allItems.map((ub) => {
      const b = ub.book;
      const ab = ub.audiobook;

      const hasEbook = !!b;
      const hasAudio = !!ab;
      const type: 'ebook' | 'audiobook' | 'both' =
        hasEbook && hasAudio ? 'both' : hasAudio ? 'audiobook' : 'ebook';

      const availableFormats: ('ebook' | 'audiobook')[] = [];
      if (hasEbook) availableFormats.push('ebook');
      if (hasAudio) availableFormats.push('audiobook');

      const title = b?.title || ab?.title || '';
      const author = b?.author || ab?.author || null;
      const category = b?.category || ab?.category || null;
      const coverUrl = b?.coverUrl || ab?.coverUrl || null;
      const rating = ub.rating
        ? Number(ub.rating)
        : Number(b?.rating || ab?.rating || 4.5);
      const views = (b?.views || 0) + (ab?.views || 0);
      const readsCount = b?.readsCount || 0;
      const listensCount = ab?.listensCount || 0;
      const narrator = ab?.narrator || null;
      const duration = ab?.duration || null;
      const audioUrl = ab?.audioUrl || null;

      return {
        id: ub.id,
        bookId: ub.bookId || b?.id || null,
        audiobookId: ub.audiobookId || ab?.id || null,
        title,
        author,
        narrator,
        category,
        type,
        contentType: type,
        hasEbook,
        hasAudio,
        availableFormats,
        coverUrl,
        audioUrl,
        duration,
        status: ub.status,
        progress: ub.progress,
        rating,
        readsCount,
        listensCount,
        views,
        startedAt: ub.startedAt,
        finishedAt: ub.finishedAt,
        createdAt: ub.createdAt,
      };
    });

    return {
      data: formattedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async updateReadingStatus(
    userId: string,
    id: string,
    dto: UpdateReadingStatusDto,
  ): Promise<{
    message: string;
    data: FormattedUserBook;
  }> {
    let book = await this.booksRepository.findOne({ where: { id } });
    let audiobook = await this.audiobooksRepository.findOne({ where: { id } });
    let userBookDirect: UserBook | null = null;

    if (!book && !audiobook) {
      userBookDirect = await this.userBooksRepository.findOne({
        where: { id, userId },
        relations: { book: true, audiobook: true },
      });
      if (userBookDirect) {
        book =
          userBookDirect.book ||
          (userBookDirect.bookId
            ? await this.booksRepository.findOne({
                where: { id: userBookDirect.bookId },
              })
            : null);
        audiobook =
          userBookDirect.audiobook ||
          (userBookDirect.audiobookId
            ? await this.audiobooksRepository.findOne({
                where: { id: userBookDirect.audiobookId },
              })
            : null);
      }
    }

    if (!book && !audiobook && !userBookDirect) {
      throw new NotFoundException(this.i18n.t('books.not_found'));
    }

    // Link complementary format if available
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

    const bookId = book?.id || null;
    const audiobookId = audiobook?.id || null;

    const lockKey = [
      userId,
      bookId || userBookDirect?.bookId || '',
      audiobookId || userBookDirect?.audiobookId || '',
    ].join(':');
    const saved = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        lockKey,
      ]);
      const userBookRepo = manager.getRepository(UserBook);
      let userBook: UserBook | null = null;
      if (userBookDirect) {
        userBook = await userBookRepo.findOne({
          where: { id: userBookDirect.id, userId },
          relations: { book: true, audiobook: true },
        });
      }
      if (!userBook) {
        const where: FindOptionsWhere<UserBook>[] = [];
        if (bookId) where.push({ userId, bookId });
        if (audiobookId) where.push({ userId, audiobookId });
        if (where.length)
          userBook = await userBookRepo.findOne({
            where,
            relations: { book: true, audiobook: true },
          });
      }

      const now = new Date();
      const wasFinished = userBook?.status === 'finished';
      const oldAliasId =
        userBook?.identityType === 'alias'
          ? userBook.aliasId
          : null;
      const oldHadRating =
        userBook?.rating !== null && userBook?.rating !== undefined;
      const oldHadReview = !!userBook?.notes?.trim();
      if (!userBook) {
        userBook = userBookRepo.create({
          userId,
          bookId,
          audiobookId,
          book: book || undefined,
          audiobook: audiobook || undefined,
        });
      } else {
        if (bookId && !userBook.bookId) userBook.bookId = bookId;
        if (audiobookId && !userBook.audiobookId)
          userBook.audiobookId = audiobookId;
        if (book) userBook.book = book;
        if (audiobook) userBook.audiobook = audiobook;
      }
      userBook.status = dto.status;
      if (dto.progress !== undefined) userBook.progress = dto.progress;
      if (dto.rating !== undefined) userBook.rating = dto.rating;
      if (dto.notes !== undefined) userBook.notes = dto.notes;
      if (dto.identityType) userBook.identityType = dto.identityType;
      if (dto.aliasId !== undefined) {
        userBook.aliasId = dto.aliasId || null;
        if (dto.aliasId) userBook.identityType = 'alias';
      }
      if (userBook.identityType !== 'alias') {
        userBook.aliasId = null;
      } else {
        if (!userBook.aliasId)
          throw new BadRequestException(this.i18n.t('aliases.not_found'));
        const ownedAlias = await manager
          .getRepository(UserAlias)
          .findOne({ where: { id: userBook.aliasId, userId } });
        if (!ownedAlias)
          throw new BadRequestException(this.i18n.t('aliases.not_found'));
      }

      const newAliasId =
        userBook.identityType === 'alias'
          ? userBook.aliasId
          : null;
      const newRating = dto.rating !== undefined ? dto.rating : userBook.rating;
      const newNotes = dto.notes !== undefined ? dto.notes : userBook.notes;
      const newHasRating = newRating !== null && newRating !== undefined;
      const newHasReview = !!newNotes?.trim();
      if (
        oldAliasId &&
        (oldAliasId !== newAliasId || (oldHadRating && !newHasRating))
      ) {
        await manager.query(
          'UPDATE user_aliases SET ratings_count = GREATEST(ratings_count - 1, 0) WHERE id = $1',
          [oldAliasId],
        );
      }
      if (
        oldAliasId &&
        (oldAliasId !== newAliasId || (oldHadReview && !newHasReview))
      ) {
        await manager.query(
          'UPDATE user_aliases SET reviews_count = GREATEST(reviews_count - 1, 0) WHERE id = $1',
          [oldAliasId],
        );
      }
      if (
        newAliasId &&
        (newAliasId !== oldAliasId || (!oldHadRating && newHasRating))
      ) {
        await manager.query(
          'UPDATE user_aliases SET ratings_count = ratings_count + 1 WHERE id = $1',
          [newAliasId],
        );
      }
      if (
        newAliasId &&
        (newAliasId !== oldAliasId || (!oldHadReview && newHasReview))
      ) {
        await manager.query(
          'UPDATE user_aliases SET reviews_count = reviews_count + 1 WHERE id = $1',
          [newAliasId],
        );
      }

      if (dto.status === 'finished') {
        if (dto.progress === undefined) userBook.progress = 100;
        if (!userBook.finishedAt) userBook.finishedAt = now;
        if (!wasFinished && book) {
          await manager.increment(Book, { id: book.id }, 'readsCount', 1);
          book.readsCount = (book.readsCount || 0) + 1;
        }
        if (!wasFinished && audiobook) {
          await manager.increment(
            Audiobook,
            { id: audiobook.id },
            'listensCount',
            1,
          );
          audiobook.listensCount = (audiobook.listensCount || 0) + 1;
        }
      } else {
        if (wasFinished && book) {
          await manager.query(
            'UPDATE books SET reads_count = GREATEST(COALESCE(reads_count, 0) - 1, 0) WHERE id = $1',
            [book.id],
          );
          book.readsCount = Math.max(0, (book.readsCount || 0) - 1);
        }
        if (wasFinished && audiobook) {
          await manager.query(
            'UPDATE audiobooks SET listens_count = GREATEST(COALESCE(listens_count, 0) - 1, 0) WHERE id = $1',
            [audiobook.id],
          );
          audiobook.listensCount = Math.max(
            0,
            (audiobook.listensCount || 0) - 1,
          );
        }
        if (dto.status === 'reading') {
          if (!userBook.startedAt) userBook.startedAt = now;
          userBook.finishedAt = null;
        } else if (dto.status === 'want_to_read') {
          userBook.progress = 0;
          userBook.finishedAt = null;
        }
      }
      return userBookRepo.save(userBook);
    });
    saved.book = book;
    saved.audiobook = audiobook;

    const hasEbook = !!book;
    const hasAudio = !!audiobook;
    const type: 'ebook' | 'audiobook' | 'both' =
      hasEbook && hasAudio ? 'both' : hasAudio ? 'audiobook' : 'ebook';

    return {
      message: this.i18n.t('books.status_updated'),
      data: {
        id: saved.id,
        bookId: saved.bookId,
        audiobookId: saved.audiobookId,
        title: book?.title || audiobook?.title || '',
        author: book?.author || audiobook?.author || null,
        narrator: audiobook?.narrator || null,
        category: book?.category || audiobook?.category || null,
        type,
        contentType: type,
        hasEbook,
        hasAudio,
        availableFormats:
          hasEbook && hasAudio
            ? ['ebook', 'audiobook']
            : hasAudio
              ? ['audiobook']
              : ['ebook'],
        coverUrl: book?.coverUrl || audiobook?.coverUrl || null,
        audioUrl: audiobook?.audioUrl || null,
        duration: audiobook?.duration || null,
        status: saved.status,
        progress: saved.progress,
        rating: saved.rating
          ? Number(saved.rating)
          : Number(book?.rating || audiobook?.rating || 4.5),
        readsCount: book?.readsCount || 0,
        listensCount: audiobook?.listensCount || 0,
        views: (book?.views || 0) + (audiobook?.views || 0),
        startedAt: saved.startedAt,
        finishedAt: saved.finishedAt,
        createdAt: saved.createdAt,
      },
    };
  }

  async removeReadingStatus(
    userId: string,
    id: string,
  ): Promise<{ message: string }> {
    const existing = await this.userBooksRepository.findOne({
      where: [
        { id, userId },
        { userId, bookId: id },
        { userId, audiobookId: id },
      ],
    });

    if (!existing) {
      throw new NotFoundException(this.i18n.t('books.not_found'));
    }

    if (
      existing.aliasId &&
      existing.identityType === 'alias' &&
      typeof this.dataSource?.query === 'function'
    ) {
      if (existing.rating !== null && existing.rating !== undefined) {
        await this.dataSource.query(
          'UPDATE user_aliases SET ratings_count = GREATEST(ratings_count - 1, 0) WHERE id = $1',
          [existing.aliasId],
        );
      }
      if (existing.notes?.trim()) {
        await this.dataSource.query(
          'UPDATE user_aliases SET reviews_count = GREATEST(reviews_count - 1, 0) WHERE id = $1',
          [existing.aliasId],
        );
      }
    }

    await this.userBooksRepository.delete(existing.id);

    return {
      message: this.i18n.t('books.status_removed'),
    };
  }
}
