import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Author } from './author.entity';
import { UserAuthorFollow } from './user-author-follow.entity';
import { User } from '../users/user.entity';
import { UserBlock } from '../users/user-block.entity';
import { Interest } from '../interests/interest.entity';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';
import { FollowMultipleAuthorsDto } from './dto/follow-multiple.dto';

export interface AuthorResponse {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  countryCode: string | null;
  country: string | null;
  birthday: string | null;
  profileUrl: string | null;
  aboutMe: string | null;
  userType: string;
  userTypeLabel: string;
  role: string;
  isVerified: boolean;
  followersCount: number;
  matchingInterests: string[];
  isFollowing: boolean;
  createdAt: Date;
}

@Injectable()
export class AuthorsService implements OnModuleInit {
  constructor(
    @InjectRepository(Author)
    private readonly authorRepo: Repository<Author>,
    @InjectRepository(UserAuthorFollow)
    private readonly followRepo: Repository<UserAuthorFollow>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Interest)
    private readonly interestRepo: Repository<Interest>,
    private readonly i18n: I18nService,
  ) {}

  async onModuleInit() {
    // Seeding is disabled to protect database integrity and permanent authors.
  }

  private mapAuthorToResponse(
    author: Author,
    matchingInterests: string[] = [],
    isFollowing: boolean = false,
    lang?: SupportedLanguage,
  ): AuthorResponse {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const isArabic = currentLang === 'ar';

    const userType = author.userType || 'Author';
    const userTypeLabel =
      userType === 'Publisher'
        ? isArabic
          ? 'دار نشر'
          : 'Publisher'
        : isArabic
          ? 'مؤلف'
          : 'Author';

    return {
      id: author.id,
      name: author.name,
      email: author.showEmail ? (author.email ?? null) : null,
      phone: author.showPhone ? (author.phone ?? null) : null,
      countryCode: author.showPhone ? (author.countryCode ?? null) : null,
      country:
        this.i18n.formatCountry(author.country) ?? author.country ?? null,
      birthday: author.showBirthday ? (author.birthday ?? null) : null,
      profileUrl: author.profileUrl,
      aboutMe: author.aboutMe,
      userType,
      userTypeLabel,
      role: author.role || 'author',
      isVerified: author.isVerified,
      followersCount: author.followersCount,
      matchingInterests,
      isFollowing,
      createdAt: author.createdAt,
    };
  }

  async getSuggested(
    userId?: string,
    lang?: SupportedLanguage,
    limit: number = 50,
  ): Promise<AuthorResponse[]> {
    const currentLang = lang || this.i18n.getCurrentLanguage();

    const safeLimit = Math.max(
      1,
      Math.min(100, Math.trunc(Number(limit) || 50)),
    );
    const interestRows: Array<{ interest_id: string }> = userId
      ? await this.authorRepo.query(
          'SELECT interest_id FROM user_interests WHERE user_id = $1',
          [userId],
        )
      : [];
    const interestIds = interestRows.map((row) => row.interest_id);
    const follows = userId
      ? await this.followRepo.find({ where: { userId } })
      : [];
    const followedIds = new Set(follows.map((row) => row.authorId));
    const ranked: Array<{ id: string }> = await this.authorRepo.query(
      `
      SELECT a.id
      FROM authors a
      LEFT JOIN user_interests ui ON ui.user_id = a.id
      GROUP BY a.id
      ORDER BY COUNT(ui.interest_id) FILTER (WHERE ui.interest_id = ANY($1::uuid[])) DESC,
               a."followersCount" DESC NULLS LAST, a.id
      LIMIT $2
    `,
      [interestIds, safeLimit],
    );
    if (!ranked.length) return [];
    const ids = ranked.map((row) => row.id);
    const authors = await this.authorRepo.findBy({ id: In(ids) });
    const byId = new Map(authors.map((author) => [author.id, author]));
    const rows: Array<{
      authorId: string;
      interestId: string;
      name: string;
      name_ar: string;
      name_en: string;
    }> = await this.authorRepo.query(
      `
        SELECT ui.user_id AS "authorId", i.id AS "interestId", i.name, i.name_ar, i.name_en
        FROM user_interests ui JOIN interests i ON i.id = ui.interest_id
        WHERE ui.user_id = ANY($1::uuid[])
      `,
      [ids],
    );
    const matching = new Map<string, string[]>();
    const selectedInterestIds = new Set(interestIds);
    for (const row of rows) {
      if (!selectedInterestIds.has(row.interestId)) continue;
      const list = matching.get(row.authorId) ?? [];
      list.push(
        currentLang === 'en'
          ? row.name_en || row.name
          : row.name_ar || row.name,
      );
      matching.set(row.authorId, list);
    }
    return ids.flatMap((id) => {
      const author = byId.get(id);
      return author
        ? [
            this.mapAuthorToResponse(
              author,
              matching.get(id) ?? [],
              followedIds.has(id),
              currentLang,
            ),
          ]
        : [];
    });
  }

  async followMultiple(
    userId: string,
    dto: FollowMultipleAuthorsDto,
  ): Promise<{
    message: string;
    followingCount: number;
    authorsSelected: boolean;
    followersSelected?: boolean;
  }> {
    const incomingAuthorIds =
      dto.data && dto.data.length > 0 ? dto.data : dto.authorIds;
    if (!incomingAuthorIds || incomingAuthorIds.length === 0) {
      throw new BadRequestException(this.i18n.t('authors.ids_empty'));
    }

    const distinctIds = Array.from(new Set(incomingAuthorIds));
    return this.userRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      const userRepo = manager.getRepository(User);
      const authorRepo = manager.getRepository(Author);
      const followRepo = manager.getRepository(UserAuthorFollow);
      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user)
        throw new NotFoundException(this.i18n.t('auth.user_not_found'));
      const authors = await authorRepo.findBy({ id: In(distinctIds) });
      if (authors.length !== distinctIds.length) {
        throw new BadRequestException(this.i18n.t('authors.some_not_found'));
      }
      const blocks = await manager.getRepository(UserBlock).find({
        where: distinctIds.flatMap((id) => [
          { blockerId: userId, blockedId: id },
          { blockerId: id, blockedId: userId },
        ]),
      });
      if (blocks.length)
        throw new ForbiddenException(this.i18n.t('users.block_relationship'));
      const existing = await followRepo.find({ where: { userId } });
      const existingIds = new Set(existing.map((follow) => follow.authorId));
      const newAuthors = authors.filter(
        (author) => !existingIds.has(author.id),
      );
      if (!user.authorsSelected && existingIds.size + newAuthors.length < 5) {
        throw new BadRequestException(this.i18n.t('authors.select_at_least_5'));
      }
      for (const author of newAuthors) {
        await followRepo.save(
          followRepo.create({ userId, authorId: author.id }),
        );
        await authorRepo.increment({ id: author.id }, 'followersCount', 1);
        await userRepo.increment({ id: author.id }, 'followersCount', 1);
      }
      user.authorsSelected = true;
      await userRepo.save(user);
      const totalFollowing = await followRepo.count({ where: { userId } });
      return {
        message: this.i18n.t('authors.followed_success'),
        followingCount: totalFollowing,
        authorsSelected: true,
        followersSelected: true,
      };
    });
  }

  async toggleFollow(
    userId: string,
    authorId: string,
  ): Promise<{
    isFollowing: boolean;
    message: string;
    followersCount: number;
  }> {
    return this.userRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      const authorRepo = manager.getRepository(Author);
      const userRepo = manager.getRepository(User);
      const followRepo = manager.getRepository(UserAuthorFollow);
      const author = await authorRepo.findOne({ where: { id: authorId } });
      if (!author)
        throw new NotFoundException(this.i18n.t('authors.not_found'));
      const block = await manager.getRepository(UserBlock).findOne({
        where: [
          { blockerId: userId, blockedId: authorId },
          { blockerId: authorId, blockedId: userId },
        ],
      });
      if (block)
        throw new ForbiddenException(this.i18n.t('users.block_relationship'));
      const existing = await followRepo.findOne({
        where: { userId, authorId },
      });
      const nowFollowing = !existing;
      if (existing) {
        await followRepo.delete({ id: existing.id });
        await manager.query(
          'UPDATE authors SET "followersCount" = GREATEST(COALESCE("followersCount", 0) - 1, 0) WHERE id = $1',
          [authorId],
        );
        await manager.query(
          'UPDATE users SET "followersCount" = GREATEST(COALESCE("followersCount", 0) - 1, 0) WHERE id = $1',
          [authorId],
        );
      } else {
        await followRepo.save(followRepo.create({ userId, authorId }));
        await authorRepo.increment({ id: authorId }, 'followersCount', 1);
        await userRepo.increment({ id: authorId }, 'followersCount', 1);
        const user = await userRepo.findOne({ where: { id: userId } });
        if (
          user &&
          !user.authorsSelected &&
          (await followRepo.count({ where: { userId } })) >= 5
        ) {
          user.authorsSelected = true;
          await userRepo.save(user);
        }
      }
      const updated = await authorRepo.findOne({ where: { id: authorId } });
      return {
        isFollowing: nowFollowing,
        message: this.i18n.t(
          nowFollowing
            ? 'authors.followed_single_success'
            : 'authors.unfollowed_success',
        ),
        followersCount: Math.max(0, updated?.followersCount ?? 0),
      };
    });
  }

  async getFollowed(
    userId: string,
    lang?: SupportedLanguage,
  ): Promise<AuthorResponse[]> {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const follows = await this.followRepo.find({
      where: { userId },
      relations: { author: true },
    });

    if (follows.length === 0) {
      return [];
    }

    const authorIds = follows.map((f) => f.author.id);
    const authorInterestsRows: Array<{
      authorId: string;
      name: string;
      name_ar: string;
      name_en: string;
    }> = await this.authorRepo.query(
      `SELECT ui.user_id as "authorId", i.name, i.name_ar, i.name_en
       FROM user_interests ui
       JOIN interests i ON i.id = ui.interest_id
       WHERE ui.user_id = ANY($1::uuid[])`,
      [authorIds],
    );

    const interestsByAuthorId = new Map<string, string[]>();
    for (const row of authorInterestsRows) {
      const list = interestsByAuthorId.get(row.authorId) || [];
      list.push(
        currentLang === 'en'
          ? row.name_en || row.name
          : row.name_ar || row.name,
      );
      interestsByAuthorId.set(row.authorId, list);
    }

    return follows.map((f) =>
      this.mapAuthorToResponse(
        f.author,
        interestsByAuthorId.get(f.author.id) || [],
        true,
        currentLang,
      ),
    );
  }

  async findById(
    id: string,
    userId?: string,
    lang?: SupportedLanguage,
  ): Promise<AuthorResponse> {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const author = await this.authorRepo.findOne({
      where: { id },
    });

    if (!author) {
      throw new NotFoundException(
        this.i18n.t('authors.not_found', currentLang),
      );
    }

    let isFollowing = false;
    if (userId) {
      const follow = await this.followRepo.findOne({
        where: { userId, authorId: id },
      });
      isFollowing = Boolean(follow);
    }

    const authorInterestsRows: Array<{
      id: string;
      name: string;
      name_ar: string;
      name_en: string;
    }> = await this.authorRepo.query(
      `SELECT i.id, i.name, i.name_ar, i.name_en
       FROM user_interests ui
       JOIN interests i ON i.id = ui.interest_id
       WHERE ui.user_id = $1`,
      [id],
    );

    let matchingInterests: string[] = [];
    if (userId) {
      const userInterestsRows: Array<{ interest_id: string }> =
        await this.authorRepo.query(
          `SELECT interest_id FROM user_interests WHERE user_id = $1`,
          [userId],
        );
      const userInterestIds = new Set(
        userInterestsRows.map((r) => r.interest_id),
      );
      const filtered =
        userInterestIds.size > 0
          ? authorInterestsRows.filter((i) => userInterestIds.has(i.id))
          : authorInterestsRows;
      matchingInterests = filtered.map((i) =>
        currentLang === 'en' ? i.name_en || i.name : i.name_ar || i.name,
      );
    } else {
      matchingInterests = authorInterestsRows.map((i) =>
        currentLang === 'en' ? i.name_en || i.name : i.name_ar || i.name,
      );
    }

    return this.mapAuthorToResponse(
      author,
      matchingInterests,
      isFollowing,
      currentLang,
    );
  }
}
