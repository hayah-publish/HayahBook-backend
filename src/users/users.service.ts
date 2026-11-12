import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import { User } from './user.entity';
import { UserUserFollow } from './user-user-follow.entity';
import { UserBlock } from './user-block.entity';
import { UserAuthorFollow } from '../authors/user-author-follow.entity';
import { UserCreatorFollow } from '../creators/user-creator-follow.entity';
import { Author } from '../authors/author.entity';
import { Creator } from '../creators/creator.entity';
import { I18nService } from '../i18n/i18n.service';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserUserFollow)
    private readonly userFollowRepo: Repository<UserUserFollow>,
    private readonly dataSource: DataSource,
    @InjectRepository(Author)
    private readonly authorsRepository: Repository<Author>,
    @InjectRepository(Creator)
    private readonly creatorsRepository: Repository<Creator>,
    private readonly configService: ConfigService,
    private readonly i18n: I18nService,
    @Optional()
    @InjectRepository(UserBlock)
    private readonly userBlockRepo?: Repository<UserBlock>,
  ) {}

  async onModuleInit() {
    const adminEmail = this.configService
      .get<string>('ADMIN_EMAIL')
      ?.toLowerCase()
      .trim();
    if (adminEmail) {
      const user = await this.findByEmail(adminEmail);
      if (user && user.emailVerified && user.role !== 'admin') {
        await this.setRole(user.id, 'admin');
      }
    }
  }

  private getRoleForEmail(email: string): 'user' | 'admin' {
    const adminEmail = this.configService
      .get<string>('ADMIN_EMAIL')
      ?.toLowerCase()
      .trim();
    if (adminEmail && email.toLowerCase().trim() === adminEmail) {
      return 'admin';
    }
    return 'user';
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('LOWER(user.email) = :email', {
        email: email.toLowerCase().trim(),
      })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .getOne();
  }

  private async saveUserWithAnonymousRetry(user: User): Promise<User> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.usersRepository.save(user);
      } catch (err: any) {
        if (err?.code === '23505' && attempt < 2) {
          user.anonymousNumber = await this.generateUniqueAnonymousNumber();
          continue;
        }
        throw err;
      }
    }
    return this.usersRepository.save(user);
  }

  async createUser(email: string): Promise<User> {
    const anonymousNumber = await this.generateUniqueAnonymousNumber();
    const user = this.usersRepository.create({
      email: email.toLowerCase().trim(),
      role: this.getRoleForEmail(email),
      isActive: true,
      emailVerified: false,
      profileCompleted: false,
      interestsSelected: false,
      authorsSelected: false,
      creatorsSelected: false,
      followersCount: 0,
      userType: 'Reader',
      tokenVersion: 1,
      anonymousNumber,
    });

    return this.saveUserWithAnonymousRetry(user);
  }

  /**
   * Generate a unique 5-digit anonymous number between 10000 and 99999.
   * If collisions occur or 99999 is reached, increments by 1 sequentially.
   */
  async generateUniqueAnonymousNumber(): Promise<number> {
    const MIN = 10000;
    const MAX = 99999;
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
      const exists = await this.usersRepository.findOne({
        where: { anonymousNumber: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
    }

    const maxRow = await this.usersRepository
      .createQueryBuilder('user')
      .select('MAX(user.anonymousNumber)', 'max')
      .getRawOne();
    const currentMax = Number(maxRow?.max) || MAX;
    return Math.max(currentMax, MAX) + 1;
  }

  async markEmailVerified(id: string): Promise<User> {
    await this.usersRepository.update(id, { emailVerified: true });
    const user = await this.findById(id);
    const adminEmail = this.configService
      .get<string>('ADMIN_EMAIL')
      ?.toLowerCase()
      .trim();
    if (user && adminEmail && user.email.toLowerCase().trim() === adminEmail) {
      await this.usersRepository.update(id, { role: 'admin' });
      user.role = 'admin';
    }
    return user!;
  }

  async incrementTokenVersion(id: string): Promise<void> {
    await this.usersRepository.increment({ id }, 'tokenVersion', 1);
  }

  async createGoogleUser(
    email: string,
    name?: string,
    profileUrl?: string,
  ): Promise<User> {
    const anonymousNumber = await this.generateUniqueAnonymousNumber();
    const user = this.usersRepository.create({
      email: email.toLowerCase().trim(),
      name: name ?? null,
      profileUrl: profileUrl ?? null,
      role: this.getRoleForEmail(email),
      isActive: true,
      emailVerified: true,
      acceptTerms: true,
      profileCompleted: false,
      interestsSelected: false,
      authorsSelected: false,
      creatorsSelected: false,
      followersCount: 0,
      userType: 'Reader',
      tokenVersion: 1,
      anonymousNumber,
    });

    return this.saveUserWithAnonymousRetry(user);
  }

  async createUserWithPassword(
    email: string,
    passwordHash: string,
    name?: string,
    phone?: string,
    countryCode?: string,
    acceptTerms: boolean = true,
  ): Promise<User> {
    const anonymousNumber = await this.generateUniqueAnonymousNumber();
    const user = this.usersRepository.create({
      email: email.toLowerCase().trim(),
      password: passwordHash,
      name: name?.trim() || null,
      phone: phone?.trim() || null,
      countryCode: countryCode?.trim() || null,
      role: 'user',
      isActive: true,
      emailVerified: false,
      acceptTerms,
      profileCompleted: false,
      interestsSelected: false,
      authorsSelected: false,
      creatorsSelected: false,
      followersCount: 0,
      userType: 'Reader',
      tokenVersion: 1,
      anonymousNumber,
    });

    return this.saveUserWithAnonymousRetry(user);
  }

  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.update(id, { password: passwordHash });
  }

  async setRole(id: string, role: 'user' | 'admin'): Promise<void> {
    await this.usersRepository.update(id, { role });
  }

  async updateProfile(
    id: string,
    data: {
      name?: string;
      phone?: string;
      countryCode?: string;
      profileUrl?: string;
      birthday?: string;
      country?: string;
      aboutMe?: string;
      acceptTerms?: boolean;
      profileCompleted?: boolean;
      interestsSelected?: boolean;
      authorsSelected?: boolean;
      followersSelected?: boolean;
      creatorsSelected?: boolean;
      followersCount?: number;
      readingLanguage?: string;
      userType?: string;
      showEmail?: boolean;
      showPhone?: boolean;
      showBirthday?: boolean;
    },
  ): Promise<User> {
    const updateData: Partial<User> = {};
    if (data.name !== undefined) updateData.name = data.name?.trim() || null;
    if (data.phone !== undefined) updateData.phone = data.phone?.trim() || null;
    if (data.countryCode !== undefined)
      updateData.countryCode = data.countryCode?.trim() || null;
    if (data.profileUrl !== undefined)
      updateData.profileUrl = data.profileUrl?.trim() || null;
    if (data.birthday !== undefined)
      updateData.birthday = data.birthday?.trim() || null;
    if (data.country !== undefined)
      updateData.country = data.country?.trim() || null;
    if (data.aboutMe !== undefined)
      updateData.aboutMe = data.aboutMe?.trim() || null;
    if (data.acceptTerms !== undefined)
      updateData.acceptTerms = data.acceptTerms;
    if (data.profileCompleted !== undefined)
      updateData.profileCompleted = data.profileCompleted;
    if (data.interestsSelected !== undefined)
      updateData.interestsSelected = data.interestsSelected;
    if (data.authorsSelected !== undefined)
      updateData.authorsSelected = data.authorsSelected;
    if (data.followersSelected !== undefined)
      updateData.authorsSelected = data.followersSelected;
    if (data.creatorsSelected !== undefined)
      updateData.creatorsSelected = data.creatorsSelected;
    if (data.followersCount !== undefined)
      updateData.followersCount = data.followersCount;
    if (data.readingLanguage !== undefined)
      updateData.readingLanguage = data.readingLanguage?.trim() || null;
    if (data.userType !== undefined)
      updateData.userType = data.userType?.trim() || 'Reader';
    if (data.showEmail !== undefined) updateData.showEmail = data.showEmail;
    if (data.showPhone !== undefined) updateData.showPhone = data.showPhone;
    if (data.showBirthday !== undefined)
      updateData.showBirthday = data.showBirthday;

    if (Object.keys(updateData).length > 0) {
      await this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const authors = manager.getRepository(Author);
      const creators = manager.getRepository(Creator);
      await users.update(id, updateData);

      // Keep authors table synchronized if user is an author
      const authorExists = await authors.findOne({
        where: { id },
      });
      if (authorExists) {
        const authorUpdate: Partial<Author> = {};
        if (updateData.name !== undefined)
          authorUpdate.name = updateData.name || '';
        if (updateData.phone !== undefined)
          authorUpdate.phone = updateData.phone;
        if (updateData.countryCode !== undefined)
          authorUpdate.countryCode = updateData.countryCode;
        if (updateData.country !== undefined)
          authorUpdate.country = updateData.country;
        if (updateData.birthday !== undefined)
          authorUpdate.birthday = updateData.birthday;
        if (updateData.showEmail !== undefined)
          authorUpdate.showEmail = updateData.showEmail;
        if (updateData.showPhone !== undefined)
          authorUpdate.showPhone = updateData.showPhone;
        if (updateData.showBirthday !== undefined)
          authorUpdate.showBirthday = updateData.showBirthday;
        if (updateData.aboutMe !== undefined)
          authorUpdate.aboutMe = updateData.aboutMe;
        if (updateData.profileUrl !== undefined)
          authorUpdate.profileUrl = updateData.profileUrl;
        if (updateData.userType !== undefined)
          authorUpdate.userType = updateData.userType;
        if (updateData.followersCount !== undefined)
          authorUpdate.followersCount = updateData.followersCount;
        if (Object.keys(authorUpdate).length > 0) {
          await authors.update(id, authorUpdate);
        }
      }

      // Keep creators table synchronized if user is a creator
      const creatorExists = await creators.findOne({
        where: { id },
      });
      if (creatorExists) {
        const creatorUpdate: Partial<Creator> = {};
        if (updateData.name !== undefined)
          creatorUpdate.name = updateData.name || '';
        if (updateData.phone !== undefined)
          creatorUpdate.phone = updateData.phone;
        if (updateData.countryCode !== undefined)
          creatorUpdate.countryCode = updateData.countryCode;
        if (updateData.country !== undefined)
          creatorUpdate.country = updateData.country;
        if (updateData.birthday !== undefined)
          creatorUpdate.birthday = updateData.birthday;
        if (updateData.showEmail !== undefined)
          creatorUpdate.showEmail = updateData.showEmail;
        if (updateData.showPhone !== undefined)
          creatorUpdate.showPhone = updateData.showPhone;
        if (updateData.showBirthday !== undefined)
          creatorUpdate.showBirthday = updateData.showBirthday;
        if (updateData.aboutMe !== undefined)
          creatorUpdate.aboutMe = updateData.aboutMe;
        if (updateData.profileUrl !== undefined)
          creatorUpdate.profileUrl = updateData.profileUrl;
        if (updateData.userType !== undefined)
          creatorUpdate.userType = updateData.userType;
        if (updateData.followersCount !== undefined)
          creatorUpdate.followersCount = updateData.followersCount;
        if (Object.keys(creatorUpdate).length > 0) {
          await creators.update(id, creatorUpdate);
        }
      }
      });
    }
    const user = await this.findById(id);
    return user!;
  }

  async deleteUser(id: string): Promise<void> {
    await this.creatorsRepository.delete(id);
    await this.authorsRepository.delete(id);
    await this.usersRepository.delete(id);
  }

  async updateEmail(id: string, newEmail: string): Promise<User> {
    const normalized = newEmail.toLowerCase().trim();
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(User).update(id, { email: normalized, emailVerified: true });
      await manager.getRepository(Author).update(id, { email: normalized });
      await manager.getRepository(Creator).update(id, { email: normalized });
    });
    const user = await this.findById(id);
    return user!;
  }

  async updatePhone(
    id: string,
    countryCode: string,
    phone: string,
  ): Promise<User> {
    await this.dataSource.transaction(async (manager) => {
      const update = { countryCode: countryCode.trim(), phone: phone.trim() };
      await manager.getRepository(User).update(id, update);
      await manager.getRepository(Author).update(id, update);
      await manager.getRepository(Creator).update(id, update);
    });
    const user = await this.findById(id);
    return user!;
  }

  async updateLanguage(id: string, language: 'ar' | 'en'): Promise<User> {
    await this.usersRepository.update(id, { language });
    const user = await this.findById(id);
    return user!;
  }

  async toggleFollowUser(
    followerId: string,
    followingId: string,
    desiredState?: boolean,
  ): Promise<{
    isFollowing: boolean;
    message: string;
    followersCount: number;
    followingCount: number;
  }> {
    if (followerId === followingId)
      throw new BadRequestException(this.i18n.t('users.cannot_follow_self'));
    return this.dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const follows = manager.getRepository(UserUserFollow);
      const lockedUsers = await users
        .createQueryBuilder('user')
        .where('user.id IN (:...ids)', { ids: [followerId, followingId] })
        .orderBy('user.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      const follower = lockedUsers.find((user) => user.id === followerId);
      if (!follower)
        throw new NotFoundException(this.i18n.t('auth.user_not_found'));
      const target = lockedUsers.find((user) => user.id === followingId);
      if (!target) throw new NotFoundException(this.i18n.t('users.not_found'));
      const block = await manager.getRepository(UserBlock).findOne({
        where: [
          { blockerId: followerId, blockedId: followingId },
          { blockerId: followingId, blockedId: followerId },
        ],
      });
      if (block)
        throw new ForbiddenException(this.i18n.t('users.block_relationship'));
      const existing = await follows.findOne({
        where: { followerId, followingId },
      });
      const shouldFollow = desiredState ?? !existing;
      if (existing && !shouldFollow) {
        await follows.delete({ id: existing.id });
        if ((target.followersCount ?? 0) > 0) {
          await users.decrement({ id: followingId }, 'followersCount', 1);
        }
        if ((follower.followingCount ?? 0) > 0) {
          await users.decrement({ id: followerId }, 'followingCount', 1);
        }
      } else if (!existing && shouldFollow) {
        await follows.save(follows.create({ followerId, followingId }));
        await users.increment({ id: followingId }, 'followersCount', 1);
        await users.increment({ id: followerId }, 'followingCount', 1);
      }
      const [updatedTarget, updatedFollower] = await Promise.all([
        users.findOne({ where: { id: followingId } }),
        users.findOne({ where: { id: followerId } }),
      ]);
      return {
        isFollowing: shouldFollow,
        message: this.i18n.t(
          shouldFollow ? 'users.followed_success' : 'users.unfollowed_success',
        ),
        followersCount: Math.max(0, updatedTarget?.followersCount ?? 0),
        followingCount: Math.max(0, updatedFollower?.followingCount ?? 0),
      };
    });
  }

  async getFollowers(
    userId: string,
    currentUserId?: string,
  ): Promise<
    Array<{
      id: string;
      name: string | null;
      profileUrl: string | null;
      userType: string;
      followersCount: number;
      isFollowing: boolean;
      createdAt: Date;
    }>
  > {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.i18n.t('users.not_found'));
    }

    const follows = await this.userFollowRepo.find({
      where: { followingId: userId },
      relations: { follower: true },
      order: { createdAt: 'DESC' },
    });

    let currentFollowingSet = new Set<string>();
    if (currentUserId) {
      const myFollows = await this.userFollowRepo.find({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      currentFollowingSet = new Set(myFollows.map((f) => f.followingId));
    }

    return follows.map((f) => ({
      id: f.follower.id,
      name: f.follower.name ?? null,
      profileUrl: f.follower.profileUrl ?? null,
      userType: f.follower.userType ?? 'Reader',
      followersCount: f.follower.followersCount ?? 0,
      isFollowing: currentFollowingSet.has(f.follower.id),
      createdAt: f.createdAt,
    }));
  }

  async getFollowing(
    userId: string,
    currentUserId?: string,
    search?: string,
  ): Promise<
    Array<{
      id: string;
      name: string | null;
      profileUrl: string | null;
      userType: string;
      followersCount: number;
      isFollowing: boolean;
      createdAt: Date;
    }>
  > {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.i18n.t('users.not_found'));
    }

    const follows = await this.userFollowRepo.find({
      where: { followerId: userId },
      relations: { following: true },
      order: { createdAt: 'DESC' },
    });

    let currentFollowingSet = new Set<string>();
    if (currentUserId) {
      const myFollows = await this.userFollowRepo.find({
        where: { followerId: currentUserId },
        select: { followingId: true },
      });
      currentFollowingSet = new Set(myFollows.map((f) => f.followingId));
    }

    let results = follows.map((f) => ({
      id: f.following.id,
      name: f.following.name ?? null,
      profileUrl: f.following.profileUrl ?? null,
      userType: f.following.userType ?? 'Reader',
      followersCount: f.following.followersCount ?? 0,
      isFollowing: currentFollowingSet.has(f.following.id),
      createdAt: f.createdAt,
    }));

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(
        (u) => u.name && u.name.toLowerCase().includes(q),
      );
    }

    return results;
  }

  async getFollowersPage(
    userId: string,
    currentUserId?: string,
    pageInput?: number,
    limitInput?: number,
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(this.i18n.t('users.not_found'));

    const page = Math.max(1, Math.floor(Number(pageInput) || 1));
    const limit = Math.max(
      1,
      Math.min(100, Math.floor(Number(limitInput) || 20)),
    );
    const [follows, total] = await this.userFollowRepo
      .createQueryBuilder('follow')
      .innerJoinAndSelect('follow.follower', 'follower')
      .where('follow.followingId = :userId', { userId })
      .orderBy('follow.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const ids = follows.map((f) => f.followerId);
    const currentFollows =
      currentUserId && ids.length
        ? await this.userFollowRepo.find({
            where: { followerId: currentUserId, followingId: In(ids) },
            select: { followingId: true },
          })
        : [];
    const followingSet = new Set(currentFollows.map((f) => f.followingId));
    return {
      data: follows.map((f) => ({
        id: f.follower.id,
        name: f.follower.name ?? null,
        profileUrl: f.follower.profileUrl ?? null,
        userType: f.follower.userType ?? 'Reader',
        followersCount: f.follower.followersCount ?? 0,
        isFollowing: followingSet.has(f.follower.id),
        createdAt: f.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getFollowingPage(
    userId: string,
    currentUserId?: string,
    search?: string,
    pageInput?: number,
    limitInput?: number,
  ) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(this.i18n.t('users.not_found'));

    const page = Math.max(1, Math.floor(Number(pageInput) || 1));
    const limit = Math.max(
      1,
      Math.min(100, Math.floor(Number(limitInput) || 20)),
    );
    const qb = this.userFollowRepo
      .createQueryBuilder('follow')
      .innerJoinAndSelect('follow.following', 'following')
      .where('follow.followerId = :userId', { userId });
    if (search?.trim())
      qb.andWhere('following.name ILIKE :search', {
        search: '%' + search.trim() + '%',
      });
    const [follows, total] = await qb
      .orderBy('follow.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    const ids = follows.map((f) => f.followingId);
    const currentFollows =
      currentUserId && ids.length
        ? await this.userFollowRepo.find({
            where: { followerId: currentUserId, followingId: In(ids) },
            select: { followingId: true },
          })
        : [];
    const followingSet = new Set(currentFollows.map((f) => f.followingId));
    return {
      data: follows.map((f) => ({
        id: f.following.id,
        name: f.following.name ?? null,
        profileUrl: f.following.profileUrl ?? null,
        userType: f.following.userType ?? 'Reader',
        followersCount: f.following.followersCount ?? 0,
        isFollowing: followingSet.has(f.following.id),
        createdAt: f.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getUserPublicProfile(targetUserId: string, currentUserId?: string) {
    const user = await this.usersRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user) {
      throw new NotFoundException(this.i18n.t('users.not_found'));
    }

    if (currentUserId && currentUserId !== targetUserId) {
      if (await this.isUserBlocked(targetUserId, currentUserId)) {
        throw new ForbiddenException(this.i18n.t('users.blocked_interaction'));
      }
    }

    let isFollowing = false;
    if (currentUserId) {
      const follow = await this.userFollowRepo.findOne({
        where: { followerId: currentUserId, followingId: targetUserId },
      });
      isFollowing = Boolean(follow);
    }

    return {
      id: user.id,
      name: user.name ?? null,
      email: user.showEmail ? user.email : null,
      phone: user.showPhone ? user.phone : null,
      countryCode: user.showPhone ? user.countryCode : null,
      birthday: user.showBirthday ? user.birthday : null,
      profileUrl: user.profileUrl ?? null,
      aboutMe: user.aboutMe ?? null,
      country: this.i18n.formatCountry(user.country) ?? user.country ?? null,
      userType: user.userType ?? 'Reader',
      followersCount: Math.max(0, user.followersCount ?? 0),
      followingCount: Math.max(0, user.followingCount ?? 0),
      isFollowing,
      createdAt: user.createdAt,
    };
  }

  /**
   * Block a user
   */
  async blockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{
    isBlocked: boolean;
    message: string;
    blockedUser: {
      id: string;
      name: string | null;
      profileUrl: string | null;
    };
  }> {
    if (blockerId === blockedId) {
      throw new BadRequestException(this.i18n.t('users.cannot_block_self'));
    }

    const target = await this.usersRepository.findOne({
      where: { id: blockedId },
    });
    if (!target) {
      throw new NotFoundException(this.i18n.t('users.not_found'));
    }

    return this.dataSource.transaction(async (manager) => {
      const blocks = manager.getRepository(UserBlock);
      const follows = manager.getRepository(UserUserFollow);
      const users = manager.getRepository(User);
      const lockedUsers = await users
        .createQueryBuilder('user')
        .where('user.id IN (:...ids)', { ids: [blockerId, blockedId] })
        .orderBy('user.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      if (lockedUsers.length !== 2) {
        throw new NotFoundException(this.i18n.t('users.not_found'));
      }

      let existingBlock = await blocks.findOne({
        where: { blockerId, blockedId },
      });

      if (!existingBlock) {
        existingBlock = await blocks.save(
          blocks.create({ blockerId, blockedId }),
        );
      }

      const blockerUser = lockedUsers.find((u) => u.id === blockerId)!;
      const blockedUser = lockedUsers.find((u) => u.id === blockedId)!;

      // Remove mutual follows if present
      const follow1 = await follows.findOne({
        where: { followerId: blockerId, followingId: blockedId },
      });
      if (follow1) {
        await follows.delete({ id: follow1.id });
        if ((blockedUser.followersCount ?? 0) > 0) {
          await users.decrement({ id: blockedId }, 'followersCount', 1);
        }
        if ((blockerUser.followingCount ?? 0) > 0) {
          await users.decrement({ id: blockerId }, 'followingCount', 1);
        }
      }

      const follow2 = await follows.findOne({
        where: { followerId: blockedId, followingId: blockerId },
      });
      if (follow2) {
        await follows.delete({ id: follow2.id });
        if ((blockerUser.followersCount ?? 0) > 0) {
          await users.decrement({ id: blockerId }, 'followersCount', 1);
        }
        if ((blockedUser.followingCount ?? 0) > 0) {
          await users.decrement({ id: blockedId }, 'followingCount', 1);
        }
      }

      const authorFollows = manager.getRepository(UserAuthorFollow);
      const creatorFollows = manager.getRepository(UserCreatorFollow);
      const authors = manager.getRepository(Author);
      const creators = manager.getRepository(Creator);
      for (const [follower, followed] of [
        [blockerId, blockedId],
        [blockedId, blockerId],
      ]) {
        const authorFollow = await authorFollows.findOne({
          where: { userId: follower, authorId: followed },
        });
        if (authorFollow) {
          await authorFollows.delete({ id: authorFollow.id });
          await authors.decrement({ id: followed }, 'followersCount', 1);
        }
        const creatorFollow = await creatorFollows.findOne({
          where: { userId: follower, creatorId: followed },
        });
        if (creatorFollow) {
          await creatorFollows.delete({ id: creatorFollow.id });
          await creators.decrement({ id: followed }, 'followersCount', 1);
        }
      }

      return {
        isBlocked: true,
        message: this.i18n.t('users.blocked_success'),
        blockedUser: {
          id: target.id,
          name: target.name ?? null,
          profileUrl: target.profileUrl ?? null,
        },
      };
    });
  }

  /**
   * Unblock a user
   */
  async unblockUser(
    blockerId: string,
    blockedId: string,
  ): Promise<{
    isBlocked: boolean;
    message: string;
  }> {
    if (blockerId === blockedId) {
      throw new BadRequestException(this.i18n.t('users.cannot_block_self'));
    }

    const blocks =
      this.userBlockRepo || this.dataSource.getRepository(UserBlock);
    const existing = await blocks.findOne({
      where: { blockerId, blockedId },
    });

    if (!existing) {
      return {
        isBlocked: false,
        message: this.i18n.t('users.not_blocked'),
      };
    }

    await blocks.delete({ id: existing.id });
    return {
      isBlocked: false,
      message: this.i18n.t('users.unblocked_success'),
    };
  }

  /**
   * Get list of blocked users
   */
  async getBlockedUsers(userId: string): Promise<
    {
      id: string;
      blockedUser: {
        id: string;
        name: string | null;
        profileUrl: string | null;
        userType: string;
      };
      createdAt: Date;
    }[]
  > {
    const blocks =
      this.userBlockRepo || this.dataSource.getRepository(UserBlock);
    const list = await blocks.find({
      where: { blockerId: userId },
      relations: { blocked: true },
      order: { createdAt: 'DESC' },
    });

    return list.map((b) => ({
      id: b.id,
      blockedUser: {
        id: b.blocked?.id || b.blockedId,
        name: b.blocked?.name || null,
        profileUrl: b.blocked?.profileUrl || null,
        userType: b.blocked?.userType || 'Reader',
      },
      createdAt: b.createdAt,
    }));
  }

  /**
   * Check if user is blocked (either direction)
   */
  async isUserBlocked(userId1: string, userId2: string): Promise<boolean> {
    if (!userId1 || !userId2 || userId1 === userId2) return false;
    const blocks =
      this.userBlockRepo ||
      (typeof this.dataSource?.getRepository === 'function'
        ? this.dataSource.getRepository(UserBlock)
        : undefined);
    if (!blocks) return false;
    const count = await blocks.count({
      where: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    });
    return count > 0;
  }
}
