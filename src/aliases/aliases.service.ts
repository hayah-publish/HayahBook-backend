import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { UserAlias } from './user-alias.entity';
import { User } from '../users/user.entity';
import { Comment } from '../comments/comment.entity';
import { UserBook } from '../books/user-book.entity';
import { UploadService } from '../upload/upload.service';
import { UploadFile } from '../upload/upload-file.interface';
import { I18nService } from '../i18n/i18n.service';
import { CreateAliasDto } from './dto/create-alias.dto';
import { UpdateAliasDto } from './dto/update-alias.dto';

export interface AliasPresetAvatar {
  id: string;
  key: string;
  avatarUrl: string;
  // Optional compatibility fields
  displayName?: string;
  name_ar?: string;
  name_en?: string;
  displayNickname?: string;
  suggestedNickname_ar?: string;
  suggestedNickname_en?: string;
}

export const PRESET_DEFINITIONS = [
  {
    id: '1f71559f-4980-4b02-be6a-24c4ea3d7ea0',
    key: 'preset-frog-red',
    avatarUrl: 'https://cdn.hayahbook.com/presets/aliases/preset-frog-red.jpg',
  },
  {
    id: '63f8bb61-4fa3-433e-bfa3-82ef5be023b8',
    key: 'preset-monster-green',
    avatarUrl:
      'https://cdn.hayahbook.com/presets/aliases/preset-monster-green.jpg',
  },
  {
    id: 'c5a5e381-863a-4e2b-bb9f-5cbfda0583b6',
    key: 'preset-owl-blue',
    avatarUrl: 'https://cdn.hayahbook.com/presets/aliases/preset-owl-blue.jpg',
  },
  {
    id: 'e46bfb30-e88f-4ad4-aa35-64906f977fc2',
    key: 'preset-fox-orange',
    avatarUrl:
      'https://cdn.hayahbook.com/presets/aliases/preset-fox-orange.jpg',
  },
  {
    id: 'f5815ec6-b33a-4df0-9ce8-9ec189cbb32e',
    key: 'preset-cat-purple',
    avatarUrl:
      'https://cdn.hayahbook.com/presets/aliases/preset-cat-purple.jpg',
  },
];

export const PRESET_AVATARS: AliasPresetAvatar[] = PRESET_DEFINITIONS.map(
  (p) => ({
    id: p.id,
    key: p.key,
    avatarUrl: p.avatarUrl,
  }),
);

@Injectable()
export class AliasesService {
  constructor(
    @InjectRepository(UserAlias)
    private readonly aliasRepo: Repository<UserAlias>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectRepository(UserBook)
    private readonly userBookRepo: Repository<UserBook>,
    private readonly uploadService: UploadService,
    private readonly i18n: I18nService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Return preset avatars (pictures only)
   */
  getPresets(): AliasPresetAvatar[] {
    return PRESET_DEFINITIONS.map((p) => ({
      id: p.id,
      key: p.key,
      avatarUrl: p.avatarUrl,
    }));
  }

  /**
   * Get bottom sheet identity options for comments (Image 1)
   */
  async getIdentityOptions(userId: string, lang?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.i18n.t('users.not_found'));
    }

    const aliases = await this.aliasRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    const isAr = (lang || this.i18n?.getCurrentLanguage?.() || 'ar') === 'ar';

    return {
      primary: {
        id: user.id,
        name: user.name,
        profileUrl: user.profileUrl,
        userType: user.userType,
        isVerified: user.role === 'admin' || user.userType === 'Author',
      },
      aliases: aliases.map((a) => ({
        id: a.id,
        nickname: a.nickname,
        avatarUrl: a.avatarUrl || PRESET_AVATARS[0].avatarUrl,
        isDefault: a.isDefault,
        agreedCount: a.agreedCount,
        searchCount: a.searchCount,
      })),
      anonymousOption: {
        title: isAr
          ? 'التعليق على هذا المنشور دون إظهار اسمك'
          : 'Comment on this post without showing your name',
        anonymousName: user.anonymousNumber
          ? isAr
            ? `مستخدم مجهول - ${user.anonymousNumber}`
            : `Anonymous Reader - ${user.anonymousNumber}`
          : isAr
            ? 'مستخدم مجهول'
            : 'Anonymous Reader',
        anonymousNumber: user.anonymousNumber ?? null,
      },
      selectedOption: aliases.find((a) => a.isDefault)?.id || 'primary',
    };
  }

  private isOwnedAliasAvatar(userId: string, url?: string | null): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    if (PRESET_AVATARS.some((p) => p.avatarUrl === trimmed)) {
      return false;
    }
    if (trimmed.startsWith('https://cdn.hayahbook.com/presets/')) {
      return false;
    }
    return (
      trimmed.includes(`/aliases/${userId}/`) ||
      trimmed.startsWith(`aliases/${userId}/`)
    );
  }

  private isAllowedAliasAvatarUrl(userId: string, url: string): boolean {
    const trimmed = url.trim();
    return (
      PRESET_AVATARS.some((p) => p.avatarUrl === trimmed) ||
      trimmed.startsWith('https://cdn.hayahbook.com/presets/') ||
      trimmed.includes(`/aliases/${userId}/`) ||
      trimmed.startsWith(`aliases/${userId}/`)
    );
  }

  /**
   * Check if a nickname is unique and available
   */
  async checkNicknameAvailability(
    nickname: string,
    excludeAliasId?: string,
  ): Promise<{ available: boolean; message: string }> {
    const trimmed = nickname?.trim();
    if (!trimmed) {
      throw new BadRequestException(this.i18n.t('aliases.nickname_required'));
    }

    if (trimmed.length > 50) {
      throw new BadRequestException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Nickname cannot exceed 50 characters'
          : 'الاسم المستعار لا يمكن أن يتجاوز 50 حرفاً',
      );
    }

    let query = this.aliasRepo
      .createQueryBuilder('alias')
      .where('LOWER(alias.nickname) = LOWER(:nickname)', {
        nickname: trimmed,
      });

    if (excludeAliasId) {
      query = query.andWhere('alias.id != :excludeAliasId', { excludeAliasId });
    }

    const existing = await query.getOne();

    if (existing) {
      return {
        available: false,
        message: this.i18n.t('aliases.nickname_already_taken'),
      };
    }

    return {
      available: true,
      message: this.i18n.t('aliases.nickname_available'),
    };
  }

  /**
   * Create an alias (Image 2)
   */
  async createAlias(
    userId: string,
    dto: CreateAliasDto,
    file?: UploadFile,
  ): Promise<UserAlias> {
    const normalizedNickname = dto.nickname?.trim();
    if (!normalizedNickname) {
      throw new BadRequestException(this.i18n.t('aliases.nickname_required'));
    }

    let uploadedUrl: string | null = null;
    if (
      !file &&
      dto.avatarUrl?.trim() &&
      !this.isAllowedAliasAvatarUrl(userId, dto.avatarUrl)
    ) {
      throw new BadRequestException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Invalid avatar URL'
          : 'رابط الصورة الرمزية غير صالح',
      );
    }
    let avatarUrl = dto.avatarUrl?.trim() || PRESET_AVATARS[0].avatarUrl;
    if (file) {
      uploadedUrl = await this.uploadService.uploadAliasAvatar(userId, file);
      avatarUrl = uploadedUrl;
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
          userId,
        ]);
        const aliases = manager.getRepository(UserAlias);
        const existingCount = await aliases.count({ where: { userId } });
        if (existingCount >= 5)
          throw new BadRequestException(
            this.i18n.getCurrentLanguage?.() === 'en'
              ? 'You can create a maximum of 5 aliases'
              : 'يمكنك إنشاء 5 أسماء مستعارة بحد أقصى',
          );

        // Check if nickname is already taken by another alias (case-insensitive)
        const nicknameTaken = await aliases
          .createQueryBuilder('alias')
          .where('LOWER(alias.nickname) = LOWER(:nickname)', {
            nickname: normalizedNickname,
          })
          .getOne();

        if (nicknameTaken) {
          throw new ConflictException(
            this.i18n.t('aliases.nickname_already_taken'),
          );
        }

        const isDefault = dto.isDefault ?? existingCount === 0;
        if (isDefault) await aliases.update({ userId }, { isDefault: false });
        return aliases.save(
          aliases.create({
            userId,
            nickname: normalizedNickname,
            avatarUrl,
            isDefault,
          }),
        );
      });
    } catch (error) {
      if (uploadedUrl) await this.uploadService.deleteFileByUrl(uploadedUrl);
      if (this.isNicknameUniqueViolation(error)) {
        throw new ConflictException(
          this.i18n.t('aliases.nickname_already_taken'),
        );
      }
      throw error;
    }
  }

  /**
   * Get all aliases owned by caller
   */
  async getMyAliases(userId: string): Promise<UserAlias[]> {
    return this.aliasRepo.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  /**
   * Get public profile of an alias (Image 3)
   */
  async getAliasProfile(aliasId: string): Promise<any> {
    const alias = await this.aliasRepo.findOne({ where: { id: aliasId } });
    if (!alias) {
      throw new NotFoundException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Alias not found'
          : 'الاسم المستعار غير موجود',
      );
    }

    // Increment search/view count
    await this.aliasRepo.increment({ id: aliasId }, 'searchCount', 1);

    const commentsCount = await this.commentRepo.count({
      where: { aliasId, isHidden: false },
    });
    const reviewsCount = await this.userBookRepo
      .createQueryBuilder('ub')
      .where(
        'ub.aliasId = :aliasId AND ub.notes IS NOT NULL AND TRIM(ub.notes) != :empty',
        { aliasId, empty: '' },
      )
      .getCount();
    const ratingsCount = await this.userBookRepo
      .createQueryBuilder('ub')
      .where('ub.aliasId = :aliasId AND ub.rating IS NOT NULL', { aliasId })
      .getCount();

    return {
      id: alias.id,
      nickname: alias.nickname,
      avatarUrl: alias.avatarUrl,
      agreedCount: alias.agreedCount,
      searchCount: alias.searchCount + 1,
      stats: {
        agreedBadge: `${alias.agreedCount} people agreed with him`,
        agreedBadgeAr: `${alias.agreedCount} شخص اتفقوا معه`,
        searchBadge: `${alias.searchCount + 1} people searched for it`,
        searchBadgeAr: `${alias.searchCount + 1} شخص بحثوا عنه`,
        commentsCount,
        reviewsCount,
        ratingsCount,
      },
      createdAt: alias.createdAt,
    };
  }

  /**
   * Get comments written by this alias (Image 3 Tab 1 "Comments")
   */
  async getAliasComments(aliasId: string, page = 1, limit = 20) {
    const alias = await this.aliasRepo.findOne({ where: { id: aliasId } });
    if (!alias) {
      throw new NotFoundException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Alias not found'
          : 'الاسم المستعار غير موجود',
      );
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));

    const [comments, total] = await this.commentRepo.findAndCount({
      where: { aliasId, isHidden: false },
      relations: { post: { user: true } },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    const data = comments.map((c) => ({
      id: c.id,
      content: c.content,
      imageUrl: c.imageUrl,
      createdAt: c.createdAt,
      likesCount: c.likesCount,
      reactionsCount: c.reactionsCount,
      repliesCount: c.repliesCount,
      post: c.post
        ? {
            id: c.post.id,
            content: c.post.content,
            title: c.post.title,
            type: c.post.type,
            publisher: c.post.user
              ? {
                  id: c.post.user.id,
                  name: c.post.user.name,
                  profileUrl: c.post.user.profileUrl,
                  role: c.post.user.role,
                  isVerified:
                    c.post.user.role === 'admin' ||
                    (c.post.user as any).userType === 'Author',
                }
              : null,
          }
        : null,
      author: {
        id: alias.id,
        nickname: alias.nickname,
        avatarUrl: alias.avatarUrl,
        isAlias: true,
      },
    }));

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Get book reviews written by this alias (Image 3 Tab 2 "Books" -> "Reviews")
   */
  async getAliasBookReviews(aliasId: string, page = 1, limit = 20) {
    const alias = await this.aliasRepo.findOne({ where: { id: aliasId } });
    if (!alias) {
      throw new NotFoundException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Alias not found'
          : 'الاسم المستعار غير موجود',
      );
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));

    const qb = this.userBookRepo
      .createQueryBuilder('ub')
      .leftJoinAndSelect('ub.book', 'book')
      .leftJoinAndSelect('ub.audiobook', 'audiobook')
      .where('ub.aliasId = :aliasId', { aliasId })
      .andWhere('ub.notes IS NOT NULL AND TRIM(ub.notes) != :empty', {
        empty: '',
      })
      .orderBy('ub.updatedAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((ub) => {
      const target = ub.book || ub.audiobook;
      return {
        id: ub.id,
        review: ub.notes,
        rating: ub.rating ? Number(ub.rating) : null,
        status: ub.status,
        createdAt: ub.createdAt,
        updatedAt: ub.updatedAt,
        book: target
          ? {
              id: target.id,
              title: target.title,
              author:
                (target as any).author || (target as any).authorName || null,
              coverUrl: target.coverUrl,
              rating: (target as any).rating || 0,
              ratingsCount: (target as any).ratingsCount || 0,
              category: target.category,
            }
          : null,
        author: {
          id: alias.id,
          nickname: alias.nickname,
          avatarUrl: alias.avatarUrl,
          isAlias: true,
        },
      };
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Get book ratings given by this alias (Image 3 Tab 2 "Books" -> "Ratings")
   */
  async getAliasBookRatings(aliasId: string, page = 1, limit = 20) {
    const alias = await this.aliasRepo.findOne({ where: { id: aliasId } });
    if (!alias) {
      throw new NotFoundException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Alias not found'
          : 'الاسم المستعار غير موجود',
      );
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));

    const qb = this.userBookRepo
      .createQueryBuilder('ub')
      .leftJoinAndSelect('ub.book', 'book')
      .leftJoinAndSelect('ub.audiobook', 'audiobook')
      .where('ub.aliasId = :aliasId', { aliasId })
      .andWhere('ub.rating IS NOT NULL')
      .orderBy('ub.updatedAt', 'DESC')
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit);

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((ub) => {
      const target = ub.book || ub.audiobook;
      return {
        id: ub.id,
        rating: Number(ub.rating),
        status: ub.status,
        createdAt: ub.createdAt,
        updatedAt: ub.updatedAt,
        book: target
          ? {
              id: target.id,
              title: target.title,
              author:
                (target as any).author || (target as any).authorName || null,
              coverUrl: target.coverUrl,
              category: target.category,
            }
          : null,
        author: {
          id: alias.id,
          nickname: alias.nickname,
          avatarUrl: alias.avatarUrl,
          isAlias: true,
        },
      };
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    };
  }

  /**
   * Update an alias
   */
  async updateAlias(
    userId: string,
    aliasId: string,
    dto: UpdateAliasDto,
    file?: UploadFile,
  ): Promise<UserAlias> {
    const existing = await this.aliasRepo.findOne({
      where: { id: aliasId, userId },
    });
    if (!existing) {
      const exists = await this.aliasRepo.exists({ where: { id: aliasId } });
      if (!exists)
        throw new NotFoundException(
          this.i18n.getCurrentLanguage?.() === 'en'
            ? 'Alias not found'
            : 'الاسم المستعار غير موجود',
        );
      throw new ForbiddenException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'You do not own this alias'
          : 'ليس لديك صلاحية لتعديل هذا الاسم المستعار',
      );
    }
    if (
      !file &&
      dto.avatarUrl?.trim() &&
      !this.isAllowedAliasAvatarUrl(userId, dto.avatarUrl)
    ) {
      throw new BadRequestException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Invalid avatar URL'
          : 'رابط الصورة الرمزية غير صالح',
      );
    }
    const previousAvatar = existing.avatarUrl;
    const uploadedUrl = file
      ? await this.uploadService.uploadAliasAvatar(userId, file)
      : null;
    try {
      const updated = await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
          userId,
        ]);
        const aliases = manager.getRepository(UserAlias);
        const alias = await aliases.findOne({
          where: { id: aliasId, userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!alias)
          throw new NotFoundException(
            this.i18n.getCurrentLanguage?.() === 'en'
              ? 'Alias not found'
              : 'الاسم المستعار غير موجود',
          );
        if (dto.nickname !== undefined) {
          const normalizedNickname = dto.nickname.trim();
          if (!normalizedNickname) {
            throw new BadRequestException(
              this.i18n.t('aliases.nickname_required'),
            );
          }

          const nicknameTaken = await aliases
            .createQueryBuilder('alias')
            .where(
              'LOWER(alias.nickname) = LOWER(:nickname) AND alias.id != :aliasId',
              {
                nickname: normalizedNickname,
                aliasId,
              },
            )
            .getOne();

          if (nicknameTaken) {
            throw new ConflictException(
              this.i18n.t('aliases.nickname_already_taken'),
            );
          }

          alias.nickname = normalizedNickname;
        }
        if (uploadedUrl) alias.avatarUrl = uploadedUrl;
        else if (dto.avatarUrl) alias.avatarUrl = dto.avatarUrl.trim();
        if (dto.isDefault === true) {
          await aliases.update({ userId }, { isDefault: false });
          alias.isDefault = true;
        } else if (dto.isDefault === false) alias.isDefault = false;
        return aliases.save(alias);
      });
      if (
        previousAvatar &&
        previousAvatar !== updated.avatarUrl &&
        this.isOwnedAliasAvatar(userId, previousAvatar)
      )
        await this.uploadService.deleteFileByUrl(previousAvatar);
      return updated;
    } catch (error) {
      if (uploadedUrl) await this.uploadService.deleteFileByUrl(uploadedUrl);
      if (this.isNicknameUniqueViolation(error)) {
        throw new ConflictException(
          this.i18n.t('aliases.nickname_already_taken'),
        );
      }
      throw error;
    }
  }

  private isNicknameUniqueViolation(error: unknown): boolean {
    const databaseError = error as {
      code?: string;
      driverError?: { code?: string; constraint?: string };
      constraint?: string;
    };
    const code = databaseError?.driverError?.code ?? databaseError?.code;
    const constraint =
      databaseError?.driverError?.constraint ?? databaseError?.constraint;
    return (
      code === '23505' &&
      (!constraint ||
        constraint.includes('alias') ||
        constraint.includes('nickname'))
    );
  }

  /**
   * Delete an alias
   */
  async deleteAlias(
    userId: string,
    aliasId: string,
  ): Promise<{ message: string }> {
    const alias = await this.aliasRepo.findOne({ where: { id: aliasId } });
    if (!alias)
      throw new NotFoundException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Alias not found'
          : 'الاسم المستعار غير موجود',
      );
    if (alias.userId !== userId)
      throw new ForbiddenException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'You do not own this alias'
          : 'ليس لديك صلاحية لتعديل هذا الاسم المستعار',
      );
    const wasDefault = alias.isDefault;
    await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [
        userId,
      ]);
      const aliases = manager.getRepository(UserAlias);
      await aliases.delete({ id: aliasId, userId });
      if (wasDefault) {
        const next = await aliases.findOne({
          where: { userId },
          order: { createdAt: 'ASC' },
        });
        if (next) {
          next.isDefault = true;
          await aliases.save(next);
        }
      }
    });
    if (this.isOwnedAliasAvatar(userId, alias.avatarUrl)) {
      await this.uploadService.deleteFileByUrl(alias.avatarUrl);
    }
    return {
      message:
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Alias deleted successfully'
          : 'تم حذف الاسم المستعار بنجاح',
    };
  }

  /**
   * Validate alias ownership helper
   */
  async validateUserAlias(userId: string, aliasId: string): Promise<UserAlias> {
    const alias = await this.aliasRepo.findOne({ where: { id: aliasId } });
    if (!alias || alias.userId !== userId) {
      throw new ForbiddenException(
        this.i18n.getCurrentLanguage?.() === 'en'
          ? 'Invalid alias or alias does not belong to you'
          : 'الاسم المستعار غير صالح أو لا ينتمي لهذا الحساب',
      );
    }
    return alias;
  }
}
