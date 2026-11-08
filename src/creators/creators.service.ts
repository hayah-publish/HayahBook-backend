import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Creator } from './creator.entity';
import { UserCreatorFollow } from './user-creator-follow.entity';
import { User } from '../users/user.entity';
import { Interest } from '../interests/interest.entity';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';
import { FollowMultipleCreatorsDto } from './dto/follow-multiple-creators.dto';

export interface CreatorResponse {
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
export class CreatorsService implements OnModuleInit {
  constructor(
    @InjectRepository(Creator)
    private readonly creatorRepo: Repository<Creator>,
    @InjectRepository(UserCreatorFollow)
    private readonly followRepo: Repository<UserCreatorFollow>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Interest)
    private readonly interestRepo: Repository<Interest>,
    private readonly i18n: I18nService,
  ) {}

  async onModuleInit() {
    // Seeding is disabled to protect database integrity and permanent creators.
  }

  private mapCreatorToResponse(
    creator: Creator,
    matchingInterests: string[] = [],
    isFollowing: boolean = false,
    lang?: SupportedLanguage,
  ): CreatorResponse {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const isArabic = currentLang === 'ar';
    const userTypeLabel = isArabic ? 'صانع محتوى' : 'Content Creator';

    return {
      id: creator.id,
      name: creator.name,
      email: creator.email,
      phone: creator.phone,
      countryCode: creator.countryCode,
      country: this.i18n.formatCountry(creator.country) ?? creator.country ?? null,
      birthday: creator.birthday,
      profileUrl: creator.profileUrl,
      aboutMe: creator.aboutMe,
      userType: creator.userType || 'ContentCreator',
      userTypeLabel,
      role: creator.role || 'creator',
      isVerified: creator.isVerified,
      followersCount: creator.followersCount,
      matchingInterests,
      isFollowing,
      createdAt: creator.createdAt,
    };
  }

  async getSuggested(
    userId?: string,
    lang?: SupportedLanguage,
    limit: number = 50,
  ): Promise<CreatorResponse[]> {
    const currentLang = lang || this.i18n.getCurrentLanguage();

    let userInterestIds = new Set<string>();
    let followedCreatorIds = new Set<string>();

    if (userId) {
      const userInterestsRows: Array<{ interest_id: string }> = await this.creatorRepo.query(
        `SELECT interest_id FROM user_interests WHERE user_id = $1`,
        [userId],
      );
      userInterestIds = new Set(userInterestsRows.map((r) => r.interest_id));

      const follows = await this.followRepo.find({
        where: { userId },
      });
      followedCreatorIds = new Set(follows.map((f) => f.creatorId));
    }

    const allCreators = await this.creatorRepo.find();

    const creatorInterestsRows: Array<{
      creatorId: string;
      interestId: string;
      name: string;
      name_ar: string;
      name_en: string;
    }> = await this.creatorRepo.query(`
      SELECT ui.user_id as "creatorId", i.id as "interestId", i.name, i.name_ar, i.name_en
      FROM user_interests ui
      JOIN interests i ON i.id = ui.interest_id
    `);

    const creatorInterestsMap = new Map<
      string,
      Array<{ id: string; name: string; name_ar: string; name_en: string }>
    >();
    for (const row of creatorInterestsRows) {
      const list = creatorInterestsMap.get(row.creatorId) || [];
      list.push({
        id: row.interestId,
        name: row.name,
        name_ar: row.name_ar,
        name_en: row.name_en,
      });
      creatorInterestsMap.set(row.creatorId, list);
    }

    const mapped = allCreators.map((creator) => {
      const cInterests = creatorInterestsMap.get(creator.id) || [];
      const matched = cInterests.filter((i) => userInterestIds.has(i.id));

      return {
        creator,
        matchCount: matched.length,
        matchingInterests: matched.map((i) =>
          currentLang === 'en' ? (i.name_en || i.name) : (i.name_ar || i.name),
        ),
        isFollowing: followedCreatorIds.has(creator.id),
      };
    });

    mapped.sort((a, b) => {
      if (b.matchCount !== a.matchCount) {
        return b.matchCount - a.matchCount;
      }
      return (b.creator.followersCount || 0) - (a.creator.followersCount || 0);
    });

    const topCreators = mapped.slice(0, limit);

    return topCreators.map((item) =>
      this.mapCreatorToResponse(
        item.creator,
        item.matchingInterests,
        item.isFollowing,
        currentLang,
      ),
    );
  }

  async followMultiple(
    userId: string,
    dto: FollowMultipleCreatorsDto,
  ): Promise<{
    message: string;
    followingCount: number;
    creatorsSelected: boolean;
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    }

    const incomingCreatorIds = (dto.data && dto.data.length > 0) ? dto.data : dto.creatorIds;
    if (!incomingCreatorIds || incomingCreatorIds.length === 0) {
      throw new BadRequestException(
        this.i18n.getCurrentLanguage() === 'ar'
          ? 'قائمة معرّفات صناع المحتوى لا يمكن أن تكون فارغة'
          : 'Creator IDs list cannot be empty',
      );
    }

    const isFirstTime = !user.creatorsSelected;
    const existingCount = await this.followRepo.count({ where: { userId } });
    const distinctIds = Array.from(new Set(incomingCreatorIds));

    // Require at least 5 creators on initial onboarding selection
    if (isFirstTime && (existingCount + distinctIds.length) < 5) {
      throw new BadRequestException(this.i18n.t('creators.select_at_least_5'));
    }

    const creators = await this.creatorRepo.findBy({ id: In(distinctIds) });
    if (creators.length !== distinctIds.length) {
      throw new BadRequestException(this.i18n.t('creators.some_not_found'));
    }

    for (const creator of creators) {
      const existingFollow = await this.followRepo.findOne({
        where: { userId, creatorId: creator.id },
      });

      if (!existingFollow) {
        const follow = this.followRepo.create({
          userId,
          creatorId: creator.id,
        });
        await this.followRepo.save(follow);
        await this.creatorRepo.increment({ id: creator.id }, 'followersCount', 1);
        await this.userRepo.increment({ id: creator.id }, 'followersCount', 1);
      }
    }

    user.creatorsSelected = true;
    await this.userRepo.save(user);

    const totalFollowing = await this.followRepo.count({
      where: { userId },
    });

    return {
      message: this.i18n.t('creators.followed_success'),
      followingCount: totalFollowing,
      creatorsSelected: true,
    };
  }

  async toggleFollow(
    userId: string,
    creatorId: string,
  ): Promise<{
    isFollowing: boolean;
    message: string;
    followersCount: number;
  }> {
    const creator = await this.creatorRepo.findOne({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new NotFoundException(this.i18n.t('creators.not_found'));
    }

    const existing = await this.followRepo.findOne({
      where: { userId, creatorId },
    });

    if (existing) {
      await this.followRepo.delete({ id: existing.id });
      await this.creatorRepo.decrement({ id: creatorId }, 'followersCount', 1);
      await this.userRepo.decrement({ id: creatorId }, 'followersCount', 1);
      const updated = (await this.creatorRepo.findOne({ where: { id: creatorId } }))!;
      return {
        isFollowing: false,
        message: this.i18n.t('creators.unfollowed_success'),
        followersCount: Math.max(0, updated.followersCount),
      };
    } else {
      const follow = this.followRepo.create({ userId, creatorId });
      await this.followRepo.save(follow);
      await this.creatorRepo.increment({ id: creatorId }, 'followersCount', 1);
      await this.userRepo.increment({ id: creatorId }, 'followersCount', 1);
      const updated = (await this.creatorRepo.findOne({ where: { id: creatorId } }))!;

      // If user reaches 5 followed creators, mark creatorsSelected as true
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (user && !user.creatorsSelected) {
        const totalCount = await this.followRepo.count({ where: { userId } });
        if (totalCount >= 5) {
          user.creatorsSelected = true;
          await this.userRepo.save(user);
        }
      }

      return {
        isFollowing: true,
        message: this.i18n.t('creators.followed_single_success'),
        followersCount: updated.followersCount,
      };
    }
  }

  async getFollowed(userId: string, lang?: SupportedLanguage): Promise<CreatorResponse[]> {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const follows = await this.followRepo.find({
      where: { userId },
      relations: { creator: true },
    });

    if (follows.length === 0) {
      return [];
    }

    const creatorIds = follows.map((f) => f.creator.id);
    const creatorInterestsRows: Array<{
      creatorId: string;
      name: string;
      name_ar: string;
      name_en: string;
    }> = await this.creatorRepo.query(
      `SELECT ui.user_id as "creatorId", i.name, i.name_ar, i.name_en
       FROM user_interests ui
       JOIN interests i ON i.id = ui.interest_id
       WHERE ui.user_id = ANY($1::uuid[])`,
      [creatorIds],
    );

    const interestsByCreatorId = new Map<string, string[]>();
    for (const row of creatorInterestsRows) {
      const list = interestsByCreatorId.get(row.creatorId) || [];
      list.push(currentLang === 'en' ? (row.name_en || row.name) : (row.name_ar || row.name));
      interestsByCreatorId.set(row.creatorId, list);
    }

    return follows.map((f) =>
      this.mapCreatorToResponse(
        f.creator,
        interestsByCreatorId.get(f.creator.id) || [],
        true,
        currentLang,
      ),
    );
  }

  async findById(id: string, userId?: string, lang?: SupportedLanguage): Promise<CreatorResponse> {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const creator = await this.creatorRepo.findOne({
      where: { id },
    });

    if (!creator) {
      throw new NotFoundException(this.i18n.t('creators.not_found'));
    }

    let isFollowing = false;
    if (userId) {
      const follow = await this.followRepo.findOne({
        where: { userId, creatorId: id },
      });
      isFollowing = Boolean(follow);
    }

    const creatorInterestsRows: Array<{
      creatorId: string;
      interestId: string;
      name: string;
      name_ar: string;
      name_en: string;
    }> = await this.creatorRepo.query(
      `SELECT ui.user_id as "creatorId", i.id as "interestId", i.name, i.name_ar, i.name_en
       FROM user_interests ui
       JOIN interests i ON i.id = ui.interest_id
       WHERE ui.user_id = $1`,
      [id],
    );

    let matchingInterests: string[] = [];
    if (userId) {
      const userInterestsRows: Array<{ interest_id: string }> = await this.creatorRepo.query(
        `SELECT interest_id FROM user_interests WHERE user_id = $1`,
        [userId],
      );
      const userInterestIds = new Set(userInterestsRows.map((r) => r.interest_id));
      const matched = creatorInterestsRows.filter((r) => userInterestIds.has(r.interestId));
      matchingInterests = matched.map((i) =>
        currentLang === 'en' ? (i.name_en || i.name) : (i.name_ar || i.name),
      );
    } else {
      matchingInterests = creatorInterestsRows.map((i) =>
        currentLang === 'en' ? (i.name_en || i.name) : (i.name_ar || i.name),
      );
    }

    return this.mapCreatorToResponse(
      creator,
      matchingInterests,
      isFollowing,
      currentLang,
    );
  }
}
