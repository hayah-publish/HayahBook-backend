
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './book.entity';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BooksService {
  constructor(
    @InjectRepository(Book)
    private readonly booksRepository: Repository<Book>,
  ) {}

  async findAll(
    page = 1,
    limit = 20,
  ): Promise<{ data: Book[]; total: number }> {
    const [data, total] = await this.booksRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async create(createBookDto: CreateBookDto): Promise<Book> {
    const book = this.booksRepository.create(createBookDto);
    return this.booksRepository.save(book);
  }

  async update(
    id: string,
    updateBookDto: UpdateBookDto,
  ): Promise<Book> {
    const existingBook = await this.findOne(id);
    const updatedBook = this.booksRepository.merge(existingBook, updateBookDto);
    return this.booksRepository.save(updatedBook);
  }

  async remove(id: string): Promise<void> {
    const result = await this.booksRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException('الكتاب غير موجود');
    }
  }

  async findOne(id: string): Promise<Book> {
    const book = await this.booksRepository.findOne({
      where: { id },
    });

    if (!book) {
      throw new NotFoundException('الكتاب غير موجود');
    }

    return book;
  }

  async search(
    query: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Book[]; total: number }> {
    const [data, total] = await this.booksRepository
      .createQueryBuilder('book')
      .where(
        `(
          book.title ILIKE :query
          OR book.author ILIKE :query
          OR book.category ILIKE :query
        )`,
        { query: `%${query}%` },
      )
      .orderBy('book.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

  async findByType(
    type: 'ebook' | 'audiobook',
    page = 1,
    limit = 20,
  ): Promise<{ data: Book[]; total: number }> {
    const [data, total] = await this.booksRepository.findAndCount({
      where: { contentType: type },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async filterBooks(
    page = 1,
    limit = 20,
    query?: string,
    type?: 'ebook' | 'audiobook',
    category?: string,
  ): Promise<{ data: Book[]; total: number }> {
    const qb = this.booksRepository.createQueryBuilder('book');

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

    const [data, total] = await qb
      .orderBy('book.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total };
  }

async getCategoryCounts(): Promise<
  { category: string; count: number }[]
> {
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

}
