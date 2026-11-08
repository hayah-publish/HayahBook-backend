import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Author } from './author.entity';
import { UserAuthorFollow } from './user-author-follow.entity';
import { User } from '../users/user.entity';
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
  ) { }

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
      email: author.email ?? null,
      phone: author.phone ?? null,
      countryCode: author.countryCode ?? null,
      country: this.i18n.formatCountry(author.country) ?? author.country ?? null,
      birthday: author.birthday ?? null,
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

    let userInterestIds = new Set<string>();
    let followedAuthorIds = new Set<string>();

    if (userId) {
      const userInterestsRows: Array<{ interest_id: string }> = await this.authorRepo.query(
        `SELECT interest_id FROM user_interests WHERE user_id = $1`,
        [userId],
      );
      userInterestIds = new Set(userInterestsRows.map((r) => r.interest_id));

      const follows = await this.followRepo.find({
        where: { userId },
      });
      followedAuthorIds = new Set(follows.map((f) => f.authorId));
    }

    const allAuthors = await this.authorRepo.find();

    // Fetch all author interests from user_interests table
    const authorInterestsRows: Array<{
      authorId: string;
      interestId: string;
      name: string;
      name_ar: string;
      name_en: string;
    }> = await this.authorRepo.query(`
      SELECT ui.user_id as "authorId", i.id as "interestId", i.name, i.name_ar, i.name_en
      FROM user_interests ui
      JOIN interests i ON i.id = ui.interest_id
    `);

    const authorInterestsMap = new Map<
      string,
      Array<{ id: string; name: string; name_ar: string; name_en: string }>
    >();
    for (const row of authorInterestsRows) {
      const list = authorInterestsMap.get(row.authorId) || [];
      list.push({
        id: row.interestId,
        name: row.name,
        name_ar: row.name_ar,
        name_en: row.name_en,
      });
      authorInterestsMap.set(row.authorId, list);
    }

    const mapped = allAuthors.map((author) => {
      const authorInterests = authorInterestsMap.get(author.id) || [];
      const matched = authorInterests.filter((i) => userInterestIds.has(i.id));

      return {
        author,
        matchCount: matched.length,
        matchingInterests: matched.map((i) =>
          currentLang === 'en' ? (i.name_en || i.name) : (i.name_ar || i.name),
        ),
        isFollowing: followedAuthorIds.has(author.id),
      };
    });

    // Ranking algorithm:
    // 1. "Shared interests + followers": highest matchCount first
    // 2. If tie in matchCount: highest followersCount first (giving priority to authors with more followers)
    // 3. Authors with 0 matches are also ranked by followersCount
    mapped.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return (b.author.followersCount || 0) - (a.author.followersCount || 0);
    });

    // Display first 10 authors if list contains more than 10
    const limited = mapped.slice(0, limit);

    return limited.map(({ author, matchingInterests, isFollowing }) =>
      this.mapAuthorToResponse(author, matchingInterests, isFollowing, currentLang),
    );
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
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    }

    const incomingAuthorIds = (dto.data && dto.data.length > 0) ? dto.data : dto.authorIds;
    if (!incomingAuthorIds || incomingAuthorIds.length === 0) {
      throw new BadRequestException(this.i18n.t('authors.ids_empty'));
    }

    const isFirstTime = !user.authorsSelected;
    const existingCount = await this.followRepo.count({ where: { userId } });
    const distinctIds = Array.from(new Set(incomingAuthorIds));

    if (isFirstTime && (existingCount + distinctIds.length < 5)) {
      throw new BadRequestException(this.i18n.t('authors.select_at_least_5'));
    }

    const authors = await this.authorRepo.findBy({
      id: In(incomingAuthorIds),
    });

    if (authors.length < incomingAuthorIds.length) {
      const foundIds = new Set(authors.map((a) => a.id));
      const missing = incomingAuthorIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `${this.i18n.t('authors.some_not_found')} (${missing.slice(0, 2).join(', ')}...)`,
      );
    }

    // Insert user_follows avoiding duplicate entries
    for (const author of authors) {
      const existing = await this.followRepo.findOne({
        where: { userId, authorId: author.id },
      });

      if (!existing) {
        const follow = this.followRepo.create({
          userId,
          authorId: author.id,
        });
        await this.followRepo.save(follow);
        await this.authorRepo.increment({ id: author.id }, 'followersCount', 1);
        await this.userRepo.increment({ id: author.id }, 'followersCount', 1);
      }
    }

    user.authorsSelected = true;
    await this.userRepo.save(user);

    const totalFollowing = await this.followRepo.count({
      where: { userId },
    });

    return {
      message: this.i18n.t('authors.followed_success'),
      followingCount: totalFollowing,
      authorsSelected: true,
      followersSelected: true,
    };
  }

  async toggleFollow(
    userId: string,
    authorId: string,
  ): Promise<{
    isFollowing: boolean;
    message: string;
    followersCount: number;
  }> {
    const author = await this.authorRepo.findOne({
      where: { id: authorId },
    });

    if (!author) {
      throw new NotFoundException(this.i18n.t('authors.not_found'));
    }

    const existing = await this.followRepo.findOne({
      where: { userId, authorId },
    });

    if (existing) {
      await this.followRepo.delete({ id: existing.id });
      await this.authorRepo.decrement({ id: authorId }, 'followersCount', 1);
      await this.userRepo.decrement({ id: authorId }, 'followersCount', 1);
      const updated = (await this.authorRepo.findOne({ where: { id: authorId } }))!;
      return {
        isFollowing: false,
        message: this.i18n.t('authors.unfollowed_success'),
        followersCount: Math.max(0, updated.followersCount),
      };
    } else {
      const follow = this.followRepo.create({ userId, authorId });
      await this.followRepo.save(follow);
      await this.authorRepo.increment({ id: authorId }, 'followersCount', 1);
      await this.userRepo.increment({ id: authorId }, 'followersCount', 1);
      const updated = (await this.authorRepo.findOne({ where: { id: authorId } }))!;

      // If user reaches 5 followed authors, mark authorsSelected as true
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user && !user.authorsSelected) {
        const totalCount = await this.followRepo.count({ where: { userId } });
        if (totalCount >= 5) {
          user.authorsSelected = true;
          await this.userRepo.save(user);
        }
      }

      return {
        isFollowing: true,
        message: this.i18n.t('authors.followed_single_success'),
        followersCount: updated.followersCount,
      };
    }
  }

  async getFollowed(userId: string, lang?: SupportedLanguage): Promise<AuthorResponse[]> {
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
      list.push(currentLang === 'en' ? (row.name_en || row.name) : (row.name_ar || row.name));
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

  async findById(id: string, userId?: string, lang?: SupportedLanguage): Promise<AuthorResponse> {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const author = await this.authorRepo.findOne({
      where: { id },
    });

    if (!author) {
      throw new NotFoundException(this.i18n.t('authors.not_found', currentLang));
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

    const matchingInterests = authorInterestsRows.map((i) =>
      currentLang === 'en' ? (i.name_en || i.name) : (i.name_ar || i.name),
    );

    return this.mapAuthorToResponse(author, matchingInterests, isFollowing, currentLang);
  }
}
