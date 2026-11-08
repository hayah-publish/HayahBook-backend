import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interest } from './interest.entity';
import { User } from '../users/user.entity';
import { SelectInterestsDto } from './dto/select-interests.dto';
import { CreateInterestDto } from './dto/create-interest.dto';
import { I18nService } from '../i18n/i18n.service';
import { SupportedLanguage } from '../i18n/i18n.types';

export const SEED_INTERESTS = [
  // 1. الكتب (Books) - 34 اهتمام
  { name_ar: 'روايات', name_en: 'Novels', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'روايات مترجمة', name_en: 'Translated Novels', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'القصص القصيرة', name_en: 'Short Stories', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'المسرح', name_en: 'Theater', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الشعر', name_en: 'Poetry', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'كتب الأدب', name_en: 'Literature Books', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الكتب الدينية', name_en: 'Religious Books', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'اللغات', name_en: 'Languages', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الفن والإبداع', name_en: 'Art & Creativity', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الماورائيات', name_en: 'Paranormal', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'علم النفس', name_en: 'Psychology', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'علم الاجتماع', name_en: 'Sociology', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'أسلوب الحياة', name_en: 'Lifestyle', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'السفر والرحلات', name_en: 'Travel & Journeys', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الجغرافيا', name_en: 'Geography', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'السياسة', name_en: 'Politics', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الاقتصاد', name_en: 'Economics', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'التاريخ', name_en: 'History', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الصحافة والإعلام', name_en: 'Journalism & Media', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'القانون', name_en: 'Law', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الزراعة', name_en: 'Agriculture', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الصناعة', name_en: 'Industry', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'العلوم التطبيقية', name_en: 'Applied Sciences', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'التنمية البشرية', name_en: 'Human Development', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'المرأة والأسرة', name_en: 'Women & Family', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الأطفال والنشأة', name_en: 'Children & Parenting', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الهندسة', name_en: 'Engineering', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'التراجم وسير الأعلام', name_en: 'Biographies & Memoirs', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'علوم الطبيعة', name_en: 'Natural Sciences', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الفلسفة', name_en: 'Philosophy', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الموسوعات', name_en: 'Encyclopedias', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'التراث والنوادر', name_en: 'Heritage & Rarities', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'الطب والصحة', name_en: 'Medicine & Health', category_ar: 'الكتب', category_en: 'Books' },
  { name_ar: 'ريادة الأعمال والابتكار', name_en: 'Entrepreneurship & Innovation', category_ar: 'الكتب', category_en: 'Books' },

  // 2. المرئيات (Visuals) - 9 اهتمامات
  { name_ar: 'السياسة والاقتصاد', name_en: 'Politics & Economics', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'العلوم والتكنولوجيا', name_en: 'Science & Technology', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'الفن والإعلام', name_en: 'Art & Media', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'أسلوب الحياة', name_en: 'Lifestyle', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'الترفيه', name_en: 'Entertainment', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'المحتوى الصوتي والمرئي', name_en: 'Audio & Visual Content', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'الدين', name_en: 'Religion', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'التاريخ والوثائقيات', name_en: 'History & Documentaries', category_ar: 'المرئيات', category_en: 'Visuals' },
  { name_ar: 'الفكر والعلوم الإنسانية', name_en: 'Thought & Humanities', category_ar: 'المرئيات', category_en: 'Visuals' },

  // 3. المقالات (Articles) - 9 اهتمامات
  { name_ar: 'احداث حالية', name_en: 'Current events', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'تاريخ وتراث', name_en: 'History and heritage', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'ثقافة وفنون', name_en: 'Culture and arts', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'معرفة وتعليم', name_en: 'Knowledge and education', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'أعمال ومهارات', name_en: 'Business and skills', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'تطوير الذات', name_en: 'Self development', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'مجتمع وحياة', name_en: 'Society and life', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'مقالات حرة', name_en: 'Free articles', category_ar: 'المقالات', category_en: 'Articles' },
  { name_ar: 'سفر وأماكن', name_en: 'Travel and places', category_ar: 'المقالات', category_en: 'Articles' },

  // 4. المقتطفات (Snippets) - 11 اهتمام
  { name_ar: 'رومانسي', name_en: 'Romance', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'نفسي', name_en: 'Psychological', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'تحفيز', name_en: 'Motivation', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'حزن وفراق', name_en: 'Sadness & Separation', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'حكمة', name_en: 'Wisdom', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'حياة', name_en: 'Life', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'اقتباسات قصيرة', name_en: 'Short Quotes', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'اقتباسات طويلة', name_en: 'Long Quotes', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'صداقة', name_en: 'Friendship', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'تأمل', name_en: 'Contemplation', category_ar: 'المقتطفات', category_en: 'Snippets' },
  { name_ar: 'روحاني', name_en: 'Spiritual', category_ar: 'المقتطفات', category_en: 'Snippets' },
];

export interface FormattedInterest {
  id: string;
  displayName: string;
  name_ar: string;
  name_en: string;
  category: string;
  category_ar: string;
  category_en: string;
}

@Injectable()
export class InterestsService implements OnModuleInit {
  constructor(
    @InjectRepository(Interest)
    private readonly interestRepository: Repository<Interest>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly i18n: I18nService,
  ) { }

  async onModuleInit() {
    for (const item of SEED_INTERESTS) {
      let existing = await this.interestRepository.findOne({
        where: [
          { name_ar: item.name_ar, category_ar: item.category_ar },
          { name: item.name_ar, category_ar: item.category_ar },
        ],
      });

      if (!existing && item.name_ar === 'احداث حالية') {
        existing = await this.interestRepository.findOne({
          where: [
            { name_ar: 'أحداث حالية', category_ar: item.category_ar },
            { name: 'أحداث حالية', category_ar: item.category_ar },
          ],
        });
      }

      if (!existing) {
        const interest = this.interestRepository.create({
          name: item.name_ar,
          name_ar: item.name_ar,
          name_en: item.name_en,
          category: item.category_ar,
          category_ar: item.category_ar,
          category_en: item.category_en,
        });
        await this.interestRepository.save(interest);
      } else {
        let changed = false;
        if (existing.name_en !== item.name_en) {
          existing.name_en = item.name_en;
          changed = true;
        }
        if (existing.name_ar !== item.name_ar) {
          existing.name_ar = item.name_ar;
          existing.name = item.name_ar;
          changed = true;
        }
        if (existing.category_en !== item.category_en) {
          existing.category_en = item.category_en;
          changed = true;
        }
        if (changed) {
          await this.interestRepository.save(existing);
        }
      }
    }
  }

  formatInterest(interest: Interest, lang?: SupportedLanguage): FormattedInterest {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    return {
      id: interest.id,
      displayName:
        currentLang === 'en'
          ? (interest.name_en || interest.name)
          : (interest.name_ar || interest.name),
      name_ar: interest.name_ar || interest.name,
      name_en: interest.name_en || interest.name,
      category:
        currentLang === 'en'
          ? (interest.category_en || interest.category)
          : (interest.category_ar || interest.category),
      category_ar: interest.category_ar || interest.category,
      category_en: interest.category_en || 'Books',
    };
  }

  resolveInterest(input: string, allInterests: Interest[]): Interest | undefined {
    if (!input || !input.trim()) return undefined;
    const q = input.trim().toLowerCase();
    const normalizeAr = (s: string) =>
      s
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();
    const qNorm = normalizeAr(q);

    return allInterests.find((i) => {
      if (i.id.toLowerCase() === q) return true;

      const nameAr = (i.name_ar || i.name || '').trim().toLowerCase();
      const nameEn = (i.name_en || '').trim().toLowerCase();
      const nameArNorm = normalizeAr(nameAr);

      if (nameAr === q || nameArNorm === qNorm) return true;
      if (nameEn === q) return true;

      // Compatibility aliases
      if (
        (q === 'opinion articles' || q === 'free articles') &&
        (nameEn === 'free articles' || nameAr === 'مقالات حرة')
      ) {
        return true;
      }
      if (
        (q === 'self-development' || q === 'self development') &&
        (nameEn === 'self development' || nameAr === 'تطوير الذات')
      ) {
        return true;
      }
      return false;
    });
  }

  normalizeCategory(category: string): string {
    const c = category.trim().toLowerCase();
    if (
      c === 'articles' ||
      c === 'article' ||
      c === 'المقالات' ||
      c === 'مقالات' ||
      c === 'المقالة'
    ) {
      return 'المقالات';
    }
    if (
      c === 'books' ||
      c === 'book' ||
      c === 'الكتب' ||
      c === 'كتب' ||
      c === 'الكتاب'
    ) {
      return 'الكتب';
    }
    if (
      c === 'visuals' ||
      c === 'visual' ||
      c === 'المرئيات' ||
      c === 'مرئيات'
    ) {
      return 'المرئيات';
    }
    if (
      c === 'snippets' ||
      c === 'snippet' ||
      c === 'المقتطفات' ||
      c === 'مقتطفات' ||
      c === 'quotes'
    ) {
      return 'المقتطفات';
    }
    return category.trim();
  }

  async findAll(
    optionsOrLang?: string | { category?: string; lang?: SupportedLanguage },
  ): Promise<FormattedInterest[]> {
    let category: string | undefined;
    let lang: SupportedLanguage | undefined;

    if (typeof optionsOrLang === 'string') {
      if (optionsOrLang === 'ar' || optionsOrLang === 'en') {
        lang = optionsOrLang;
      } else {
        category = optionsOrLang;
      }
    } else if (optionsOrLang && typeof optionsOrLang === 'object') {
      category = optionsOrLang.category;
      lang = optionsOrLang.lang;
    }

    const currentLang = lang || this.i18n.getCurrentLanguage();
    const qb = this.interestRepository.createQueryBuilder('interest');

    if (category && category.trim()) {
      const normalized = this.normalizeCategory(category);
      qb.where(
        '(interest.category_ar = :catAr OR interest.category_en ILIKE :catEn OR interest.category = :catAr)',
        {
          catAr: normalized,
          catEn: category.trim(),
        },
      );
    }

    qb.orderBy('interest.createdAt', 'ASC');
    const data = await qb.getMany();

    return data.map((interest) => this.formatInterest(interest, currentLang));
  }

  async getArticleCategories(lang?: SupportedLanguage): Promise<FormattedInterest[]> {
    const list = await this.findAll({ category: 'articles', lang });
    const order = [
      'احداث حالية',
      'تاريخ وتراث',
      'ثقافة وفنون',
      'معرفة وتعليم',
      'أعمال ومهارات',
      'تطوير الذات',
      'مجتمع وحياة',
      'مقالات حرة',
      'سفر وأماكن',
    ];
    return list.sort((a, b) => {
      const idxA = order.indexOf(a.name_ar);
      const idxB = order.indexOf(b.name_ar);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return 0;
    });
  }

  async getCategoriesSummary(lang?: SupportedLanguage) {
    const currentLang = lang || this.i18n.getCurrentLanguage();
    const all = await this.interestRepository.find({
      order: { createdAt: 'ASC' },
    });

    const categoriesDef = [
      { key: 'books', name_ar: 'الكتب', name_en: 'Books' },
      { key: 'visuals', name_ar: 'المرئيات', name_en: 'Visuals' },
      { key: 'articles', name_ar: 'المقالات', name_en: 'Articles' },
      { key: 'snippets', name_ar: 'المقتطفات', name_en: 'Snippets' },
    ];

    return categoriesDef.map((cat) => {
      const items = all.filter(
        (i) =>
          (i.category_ar || i.category) === cat.name_ar ||
          (i.category_en || '').toLowerCase() === cat.name_en.toLowerCase(),
      );
      return {
        key: cat.key,
        displayName: currentLang === 'en' ? cat.name_en : cat.name_ar,
        name_ar: cat.name_ar,
        name_en: cat.name_en,
        category: currentLang === 'en' ? cat.name_en : cat.name_ar,
        category_ar: cat.name_ar,
        category_en: cat.name_en,
        count: items.length,
        items: items.map((i) => this.formatInterest(i, currentLang)),
      };
    });
  }

  async saveSingleCategory(userId: string, input?: string) {
    if (!input || !input.trim()) {
      throw new BadRequestException(
        this.i18n.t('categories.required') || 'يرجى تحديد الفئة المطلوبة',
      );
    }
    const all = await this.interestRepository.find();
    const matched = this.resolveInterest(input.trim(), all);
    if (!matched) {
      throw new NotFoundException(
        this.i18n.t('categories.not_found') || 'الفئة المحددة غير موجودة',
      );
    }
    const user = await this.userRepository.findOne({ where: { id: userId }, select: { id: true } });
    if (!user) throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    await this.userRepository.manager.query(
      'INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT (user_id, interest_id) DO NOTHING',
      [userId, matched.id],
    );
    const formatted = this.formatInterest(matched);
    return {
      success: true,
      message:
        this.i18n.t('categories.saved') || 'تم حفظ الفئة بنجاح',
      data: formatted,
    };
  }

  async getUserInterests(userId: string, lang?: SupportedLanguage): Promise<FormattedInterest[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { interests: true },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    }

    const currentLang = lang || this.i18n.getCurrentLanguage();
    return (user.interests ?? []).map((interest) => this.formatInterest(interest, currentLang));
  }

  async saveUserInterests(
    userId: string,
    dto: SelectInterestsDto,
  ): Promise<{
    message: string;
    interestsCount: number;
    categories: {
      books: number;
      visuals: number;
      articles: number;
      snippets: number;
    };
    interests: FormattedInterest[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { interests: true },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    }

    const currentLang = this.i18n.getCurrentLanguage();
    const rawInputs = (dto.data && dto.data.length > 0)
      ? dto.data
      : (dto.interestIds && dto.interestIds.length > 0)
        ? dto.interestIds
        : dto.interestNames;

    if (!rawInputs || rawInputs.length === 0) {
      throw new BadRequestException(this.i18n.t('interests.empty_selection'));
    }

    const allInterests = await this.interestRepository.find();
    const missing: string[] = [];
    const matchedMap = new Map<string, Interest>();

    for (const raw of rawInputs) {
      const trimmed = (raw ?? '').toString().trim();
      if (!trimmed) continue;
      const matched = this.resolveInterest(trimmed, allInterests);
      if (!matched) {
        missing.push(trimmed);
      } else {
        matchedMap.set(matched.id, matched);
      }
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        currentLang === 'ar'
          ? `بعض معرّفات أو أسماء الاهتمامات غير موجودة في قاعدة البيانات (${missing.slice(0, 2).join(', ')}...). يرجى استخدام قيم صالحة من GET /v1/interests`
          : `Some interest IDs or names were not found (${missing.slice(0, 2).join(', ')}...). Please use valid values from GET /v1/interests`,
      );
    }

    const targetInterests: Interest[] = Array.from(matchedMap.values());

    const isFirstTime = !user.interestsSelected;
    let finalInterests: Interest[] = [];

    if (isFirstTime) {
      // First-time onboarding (Step 4): Must choose at least 3 from each section
      finalInterests = targetInterests;

      const books = finalInterests.filter(
        (i) => (i.category_ar || i.category) === 'الكتب' || (i.category_en || '').toLowerCase() === 'books',
      );
      const visuals = finalInterests.filter(
        (i) => (i.category_ar || i.category) === 'المرئيات' || (i.category_en || '').toLowerCase() === 'visuals',
      );
      const articles = finalInterests.filter(
        (i) => (i.category_ar || i.category) === 'المقالات' || (i.category_en || '').toLowerCase() === 'articles',
      );
      const snippets = finalInterests.filter(
        (i) => (i.category_ar || i.category) === 'المقتطفات' || (i.category_en || '').toLowerCase() === 'snippets',
      );

      if (books.length < 3) {
        throw new BadRequestException(
          currentLang === 'ar'
            ? 'يجب اختيار 3 اهتمامات على الأقل من قسم الكتب'
            : 'You must select at least 3 interests from Books section',
        );
      }

      if (visuals.length < 3) {
        throw new BadRequestException(
          currentLang === 'ar'
            ? 'يجب اختيار 3 اهتمامات على الأقل من قسم المرئيات'
            : 'You must select at least 3 interests from Visuals section',
        );
      }

      if (articles.length < 3) {
        throw new BadRequestException(
          currentLang === 'ar'
            ? 'يجب اختيار 3 اهتمامات على الأقل من قسم المقالات'
            : 'You must select at least 3 interests from Articles section',
        );
      }

      if (snippets.length < 3) {
        throw new BadRequestException(
          currentLang === 'ar'
            ? 'يجب اختيار 3 اهتمامات على الأقل من قسم المقتطفات'
            : 'You must select at least 3 interests from Snippets section',
        );
      }

      user.interestsSelected = true;
    } else {
      // User has already completed onboarding before: can add or remove any number of interests!
      const existingInterests = user.interests || [];

      if (dto.mode === 'remove') {
        const removeIds = new Set(targetInterests.map((i) => i.id));
        finalInterests = existingInterests.filter((i) => !removeIds.has(i.id));
      } else if (dto.mode === 'replace') {
        finalInterests = targetInterests;
      } else {
        // Default: add/merge new interests with existing (avoid duplicates)
        const map = new Map<string, Interest>();
        for (const item of existingInterests) {
          map.set(item.id, item);
        }
        for (const item of targetInterests) {
          map.set(item.id, item);
        }
        finalInterests = Array.from(map.values());
      }
    }

    user.interests = finalInterests;
    await this.userRepository.save(user);

    const books = finalInterests.filter(
      (i) => (i.category_ar || i.category) === 'الكتب' || (i.category_en || '').toLowerCase() === 'books',
    );
    const visuals = finalInterests.filter(
      (i) => (i.category_ar || i.category) === 'المرئيات' || (i.category_en || '').toLowerCase() === 'visuals',
    );
    const articles = finalInterests.filter(
      (i) => (i.category_ar || i.category) === 'المقالات' || (i.category_en || '').toLowerCase() === 'articles',
    );
    const snippets = finalInterests.filter(
      (i) => (i.category_ar || i.category) === 'المقتطفات' || (i.category_en || '').toLowerCase() === 'snippets',
    );

    return {
      message: this.i18n.t('interests.saved'),
      interestsCount: finalInterests.length,
      categories: {
        books: books.length,
        visuals: visuals.length,
        articles: articles.length,
        snippets: snippets.length,
      },
      interests: (user.interests ?? []).map((i) => this.formatInterest(i, currentLang)),
    };
  }

  async removeUserInterest(userId: string, interestIdOrName: string): Promise<{
    message: string;
    interestsCount: number;
    interests: FormattedInterest[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { interests: true },
    });

    if (!user) {
      throw new NotFoundException(this.i18n.t('auth.user_not_found'));
    }

    const allInterests = await this.interestRepository.find();
    const resolved = this.resolveInterest(interestIdOrName, allInterests);
    const targetId = resolved ? resolved.id : interestIdOrName;

    user.interests = (user.interests || []).filter((i) => i.id !== targetId);
    await this.userRepository.save(user);

    const currentLang = this.i18n.getCurrentLanguage();
    const isArabic = currentLang === 'ar';
    return {
      message: isArabic ? 'تم حذف الاهتمام بنجاح' : 'Interest removed successfully',
      interestsCount: user.interests.length,
      interests: (user.interests || []).map((i) => this.formatInterest(i, currentLang)),
    };
  }

  async create(dto: CreateInterestDto): Promise<Interest> {
    const normalizedName = dto.name.trim();
    const existing = await this.interestRepository.findOne({
      where: { name: normalizedName, category: dto.category?.trim() || 'الكتب' },
    });

    if (existing) {
      throw new ConflictException(this.i18n.t('interests.already_exists'));
    }

    const interest = this.interestRepository.create({
      name: normalizedName,
      name_ar: normalizedName,
      category: dto.category?.trim() || 'الكتب',
      category_ar: dto.category?.trim() || 'الكتب',
    });

    return this.interestRepository.save(interest);
  }

  async remove(id: string): Promise<{ message: string }> {
    const result = await this.interestRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(this.i18n.t('interests.not_found'));
    }
    return { message: this.i18n.t('interests.deleted') };
  }
}
