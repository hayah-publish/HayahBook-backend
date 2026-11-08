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
      email: creator.showEmail ? creator.email : null,
      phone: creator.showPhone ? creator.phone : null,
      countryCode: creator.showPhone ? creator.countryCode : null,
      country: this.i18n.formatCountry(creator.country) ?? creator.country ?? null,
      birthday: creator.showBirthday ? creator.birthday : null,
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

    const safeLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit) || 50)));
    const interestRows: Array<{ interest_id: string }> = userId
      ? await this.creatorRepo.query('SELECT interest_id FROM user_interests WHERE user_id = $1', [userId])
      : [];
    const interestIds = interestRows.map((row) => row.interest_id);
    const follows = userId ? await this.followRepo.find({ where: { userId } }) : [];
    const followedIds = new Set(follows.map((row) => row.creatorId));
    const ranked: Array<{ id: string }> = await this.creatorRepo.query(`
      SELECT c.id
      FROM creators c
      LEFT JOIN user_interests ui ON ui.user_id = c.id
      GROUP BY c.id
      ORDER BY COUNT(ui.interest_id) FILTER (WHERE ui.interest_id = ANY($1::uuid[])) DESC,
               c."followersCount" DESC NULLS LAST, c.id
      LIMIT $2
    `, [interestIds, safeLimit]);
    if (!ranked.length) return [];
    const ids = ranked.map((row) => row.id);
    const creators = await this.creatorRepo.findBy({ id: In(ids) });
    const byId = new Map(creators.map((creator) => [creator.id, creator]));
    const rows: Array<{ creatorId: string; interestId: string; name: string; name_ar: string; name_en: string }> =
      await this.creatorRepo.query(`
        SELECT ui.user_id AS "creatorId", i.id AS "interestId", i.name, i.name_ar, i.name_en
        FROM user_interests ui JOIN interests i ON i.id = ui.interest_id
        WHERE ui.user_id = ANY($1::uuid[])
      `, [ids]);
    const matching = new Map<string, string[]>();
    const selectedInterestIds = new Set(interestIds);
    for (const row of rows) {
      if (!selectedInterestIds.has(row.interestId)) continue;
      const list = matching.get(row.creatorId) ?? [];
      list.push(currentLang === 'en' ? (row.name_en || row.name) : (row.name_ar || row.name));
      matching.set(row.creatorId, list);
    }
    return ids.flatMap((id) => {
      const creator = byId.get(id);
      return creator ? [this.mapCreatorToResponse(creator, matching.get(id) ?? [], followedIds.has(id), currentLang)] : [];
    });
  }

  async followMultiple(
    userId: string,
    dto: FollowMultipleCreatorsDto,
  ): Promise<{
    message: string;
    followingCount: number;
    creatorsSelected: boolean;
  }> {
    const incomingCreatorIds = (dto.data && dto.data.length > 0) ? dto.data : dto.creatorIds;
    if (!incomingCreatorIds || incomingCreatorIds.length === 0) {
      throw new BadRequestException(
        this.i18n.getCurrentLanguage() === 'ar'
          ? 'قائمة معرّفات صناع المحتوى لا يمكن أن تكون فارغة'
          : 'Creator IDs list cannot be empty',
      );
    }

    const distinctIds = Array.from(new Set(incomingCreatorIds));
    return this.userRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const userRepo = manager.getRepository(User);
      const creatorRepo = manager.getRepository(Creator);
      const followRepo = manager.getRepository(UserCreatorFollow);
      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException(this.i18n.t('auth.user_not_found'));
      const creators = await creatorRepo.findBy({ id: In(distinctIds) });
      if (creators.length !== distinctIds.length) {
        throw new BadRequestException(this.i18n.t('creators.some_not_found'));
      }
      const existing = await followRepo.find({ where: { userId } });
      const existingIds = new Set(existing.map((follow) => follow.creatorId));
      const newCreators = creators.filter((creator) => !existingIds.has(creator.id));
      if (!user.creatorsSelected && existingIds.size + newCreators.length < 5) {
        throw new BadRequestException(this.i18n.t('creators.select_at_least_5'));
      }
      for (const creator of newCreators) {
        await followRepo.save(followRepo.create({ userId, creatorId: creator.id }));
        await creatorRepo.increment({ id: creator.id }, 'followersCount', 1);
        await userRepo.increment({ id: creator.id }, 'followersCount', 1);
      }
      user.creatorsSelected = true;
      await userRepo.save(user);
      const totalFollowing = await followRepo.count({ where: { userId } });
      return {
        message: this.i18n.t('creators.followed_success'),
        followingCount: totalFollowing,
        creatorsSelected: true,
      };
    });
  }

  async toggleFollow(
    userId: string,
    creatorId: string,
  ): Promise<{
    isFollowing: boolean;
    message: string;
    followersCount: number;
  }> {
    return this.userRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const creatorRepo = manager.getRepository(Creator);
      const userRepo = manager.getRepository(User);
      const followRepo = manager.getRepository(UserCreatorFollow);
      const creator = await creatorRepo.findOne({ where: { id: creatorId } });
      if (!creator) throw new NotFoundException(this.i18n.t('creators.not_found'));
      const existing = await followRepo.findOne({ where: { userId, creatorId } });
      const nowFollowing = !existing;
      if (existing) {
        await followRepo.delete({ id: existing.id });
        await manager.query('UPDATE creators SET "followersCount" = GREATEST(COALESCE("followersCount", 0) - 1, 0) WHERE id = $1', [creatorId]);
        await manager.query('UPDATE users SET "followersCount" = GREATEST(COALESCE("followersCount", 0) - 1, 0) WHERE id = $1', [creatorId]);
      } else {
        await followRepo.save(followRepo.create({ userId, creatorId }));
        await creatorRepo.increment({ id: creatorId }, 'followersCount', 1);
        await userRepo.increment({ id: creatorId }, 'followersCount', 1);
        const user = await userRepo.findOne({ where: { id: userId } });
        if (user && !user.creatorsSelected && await followRepo.count({ where: { userId } }) >= 5) {
          user.creatorsSelected = true;
          await userRepo.save(user);
        }
      }
      const updated = await creatorRepo.findOne({ where: { id: creatorId } });
      return {
        isFollowing: nowFollowing,
        message: this.i18n.t(nowFollowing ? 'creators.followed_single_success' : 'creators.unfollowed_success'),
        followersCount: Math.max(0, updated?.followersCount ?? 0),
      };
    });
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
