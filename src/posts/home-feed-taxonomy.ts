export interface TaxonomySubcategory {
  id: string;
  nameAr: string;
  nameEn: string;
}

export interface TaxonomyCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  aliases?: string[];
  subcategories: TaxonomySubcategory[];
}

export interface FormattedTaxonomySubcategory {
  id: string;
  name: string;
  displayName: string;
  nameAr: string;
  nameEn: string;
}

export interface FormattedTaxonomyCategory {
  id: string;
  name: string;
  displayName: string;
  nameAr: string;
  nameEn: string;
  subcategories: FormattedTaxonomySubcategory[];
}

export const HOME_FEED_TAXONOMY: TaxonomyCategory[] = [
  {
    id: 'all',
    nameAr: 'الكل',
    nameEn: 'All',
    aliases: ['all', 'الكل', 'جميع', 'any'],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
    ],
  },
  {
    id: 'religion',
    nameAr: 'الدين',
    nameEn: 'Religion',
    aliases: ['دين', 'الدين', 'religion', 'islamic', 'إسلام', 'إسلاميات'],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'islamic-studies', nameAr: 'دراسات إسلامية', nameEn: 'Islamic Studies' },
      { id: 'quran-and-hadith', nameAr: 'القرآن والحديث', nameEn: 'Quran and Hadith' },
      { id: 'fiqh-and-sharia', nameAr: 'الفقه والشريعة', nameEn: 'Fiqh and Sharia' },
      { id: 'islamic-history', nameAr: 'التاريخ الإسلامي', nameEn: 'Islamic History' },
      { id: 'spirituality-and-faith', nameAr: 'الروحانيات والإيمانيات', nameEn: 'Spirituality and Faith' },
      { id: 'prophetic-biography', nameAr: 'السيرة النبوية', nameEn: 'Prophetic Biography' },
      { id: 'comparative-religion', nameAr: 'مقارنة الأديان', nameEn: 'Comparative Religion' },
    ],
  },
  {
    id: 'history-and-documentaries',
    nameAr: 'التاريخ والوثائقيات',
    nameEn: 'History and Documentaries',
    aliases: [
      'التاريخ والوثائقيات',
      'History and Documentaries',
      'History & Documentaries',
      'تاريخ ووثائقيات',
      'وثائقيات وتاريخ',
      'تاريخ',
      'history',
    ],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'documentaries', nameAr: 'وثائقيات', nameEn: 'Documentaries' },
      { id: 'civilizations', nameAr: 'حضارات', nameEn: 'Civilizations' },
      { id: 'history', nameAr: 'تاريخ', nameEn: 'History' },
      { id: 'archaeology', nameAr: 'آثار', nameEn: 'Archaeology' },
      { id: 'wars', nameAr: 'حروب', nameEn: 'Wars' },
      { id: 'historical-figures', nameAr: 'شخصيات تاريخية', nameEn: 'Historical Figures' },
      { id: 'travel-and-journeys', nameAr: 'السفر والرحلات', nameEn: 'Travel and Journeys' },
      { id: 'geography', nameAr: 'جغرافيا', nameEn: 'Geography' },
    ],
  },
  {
    id: 'politics-and-economics',
    nameAr: 'السياسة والاقتصاد',
    nameEn: 'Politics and Economics',
    aliases: [
      'السياسة والاقتصاد',
      'Politics and Economics',
      'Politics & Economics',
      'سياسة واقتصاد',
      'اقتصاد وسياسة',
      'سياسة',
      'اقتصاد',
      'politics',
      'economics',
    ],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'political-science', nameAr: 'علوم سياسية', nameEn: 'Political Science' },
      { id: 'international-politics', nameAr: 'سياسة دولية', nameEn: 'International Politics' },
      { id: 'global-economy', nameAr: 'اقتصاد عالمي', nameEn: 'Global Economy' },
      { id: 'investment-and-markets', nameAr: 'استثمار وأسواق', nameEn: 'Investment and Markets' },
      { id: 'contemporary-issues', nameAr: 'قضايا معاصرة', nameEn: 'Contemporary Issues' },
      { id: 'entrepreneurship', nameAr: 'ريادة الأعمال', nameEn: 'Entrepreneurship' },
      { id: 'business-and-management', nameAr: 'تجارة وإدارة', nameEn: 'Business and Management' },
    ],
  },
  {
    id: 'thought-and-humanities',
    nameAr: 'الفكر والعلوم الإنسانية',
    nameEn: 'Thought and Humanities',
    aliases: [
      'الفكر والعلوم الإنسانية',
      'Thought and Humanities',
      'Thought & Humanities',
      'فكر وعلوم إنسانية',
      'علوم إنسانية',
      'فكر',
      'thought',
      'humanities',
    ],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'philosophy', nameAr: 'فلسفة', nameEn: 'Philosophy' },
      { id: 'psychology', nameAr: 'علم النفس', nameEn: 'Psychology' },
      { id: 'sociology', nameAr: 'علم الاجتماع', nameEn: 'Sociology' },
      { id: 'islamic-thought', nameAr: 'فكر إسلامي', nameEn: 'Islamic Thought' },
      { id: 'literary-criticism', nameAr: 'نقد وأدب', nameEn: 'Criticism and Literature' },
      { id: 'logic-and-epistemology', nameAr: 'منطق ومعرفة', nameEn: 'Logic and Epistemology' },
      { id: 'anthropology', nameAr: 'أنثروبولوجيا', nameEn: 'Anthropology' },
    ],
  },
  {
    id: 'lifestyle',
    nameAr: 'أسلوب الحياة',
    nameEn: 'Lifestyle',
    aliases: ['أسلوب الحياة', 'Lifestyle', 'نمط الحياة', 'لايف ستايل'],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'self-development', nameAr: 'تطوير الذات', nameEn: 'Self Development' },
      { id: 'health-and-fitness', nameAr: 'صحة ولياقة', nameEn: 'Health and Fitness' },
      { id: 'relationships-and-parenting', nameAr: 'علاقات وتربية', nameEn: 'Relationships and Parenting' },
      { id: 'productivity-and-organization', nameAr: 'إنتاجية وتنظيم', nameEn: 'Productivity and Organization' },
      { id: 'nutrition-and-cooking', nameAr: 'تغذية وطبخ', nameEn: 'Nutrition and Cooking' },
      { id: 'fashion-and-beauty', nameAr: 'أزياء وجمال', nameEn: 'Fashion and Beauty' },
      { id: 'daily-habits', nameAr: 'عادات يومية', nameEn: 'Daily Habits' },
    ],
  },
  {
    id: 'art-and-media',
    nameAr: 'الفن والإعلام',
    nameEn: 'Art and Media',
    aliases: [
      'الفن والإعلام',
      'Art and Media',
      'Art & Media',
      'فن وإعلام',
      'فنون وإعلام',
      'art',
      'media',
    ],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'cinema-and-theater', nameAr: 'سينما ومسرح', nameEn: 'Cinema and Theater' },
      { id: 'visual-arts', nameAr: 'رسم وفنون بصرية', nameEn: 'Visual Arts' },
      { id: 'music-and-audio', nameAr: 'موسيقى وفنون صوتية', nameEn: 'Music and Audio Arts' },
      { id: 'journalism-and-media', nameAr: 'صحافة وإعلام', nameEn: 'Journalism and Media' },
      { id: 'photography', nameAr: 'تصوير فوتوغرافي', nameEn: 'Photography' },
      { id: 'architecture-and-design', nameAr: 'عمارة وتصميم', nameEn: 'Architecture and Design' },
    ],
  },
  {
    id: 'science-and-technology',
    nameAr: 'العلوم والتكنولوجيا',
    nameEn: 'Science and Technology',
    aliases: [
      'العلوم والتكنولوجيا',
      'Science and Technology',
      'Science & Technology',
      'علوم وتكنولوجيا',
      'تكنولوجيا',
      'علوم',
      'science',
      'technology',
    ],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'ai-and-programming', nameAr: 'ذكاء اصطناعي وبرمجة', nameEn: 'AI and Programming' },
      { id: 'space-and-astronomy', nameAr: 'فضاء وفلك', nameEn: 'Space and Astronomy' },
      { id: 'physics-and-chemistry', nameAr: 'فيزياء وكيمياء', nameEn: 'Physics and Chemistry' },
      { id: 'biology-and-medicine', nameAr: 'أحياء وطب', nameEn: 'Biology and Medicine' },
      { id: 'telecom-and-networks', nameAr: 'تكنولوجيا واتصالات', nameEn: 'Technology and Telecom' },
      { id: 'cybersecurity', nameAr: 'أمن سيبراني', nameEn: 'Cybersecurity' },
      { id: 'inventions-and-innovation', nameAr: 'ابتكار واختراعات', nameEn: 'Inventions and Innovation' },
    ],
  },
  {
    id: 'audio-and-visual-content',
    nameAr: 'المحتوى الصوتي والمرئي',
    nameEn: 'Audio and Visual Content',
    aliases: [
      'المحتوى الصوتي والمرئي',
      'Audio and Visual Content',
      'Audio & Visual Content',
      'صوتي ومرئي',
      'محتوى مرئي',
      'محتوى صوتي',
      'audio visual',
    ],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'podcasts', nameAr: 'بودكاست', nameEn: 'Podcasts' },
      { id: 'talk-shows', nameAr: 'برامج حوارية', nameEn: 'Talk Shows' },
      { id: 'visual-documentaries', nameAr: 'وثائقيات مرئية', nameEn: 'Visual Documentaries' },
      { id: 'book-reviews', nameAr: 'مراجعات كتب', nameEn: 'Book Reviews' },
      { id: 'audio-summaries', nameAr: 'ملخصات صوتية', nameEn: 'Audio Summaries' },
      { id: 'seminars-and-lectures', nameAr: 'ندوات ومحاضرات', nameEn: 'Seminars and Lectures' },
    ],
  },
  {
    id: 'entertainment',
    nameAr: 'الترفيه',
    nameEn: 'Entertainment',
    aliases: ['الترفيه', 'Entertainment', 'ترفيه', 'تسلية'],
    subcategories: [
      { id: 'all', nameAr: 'الكل', nameEn: 'All' },
      { id: 'comedy-and-fun', nameAr: 'كوميديا ومرح', nameEn: 'Comedy and Fun' },
      { id: 'gaming', nameAr: 'ألعاب إلكترونية', nameEn: 'Gaming' },
      { id: 'competitions-and-challenges', nameAr: 'مسابقات وتحديات', nameEn: 'Competitions and Challenges' },
      { id: 'oddities-and-trivia', nameAr: 'غرائب وطرائف', nameEn: 'Oddities and Trivia' },
      { id: 'stories-and-tales', nameAr: 'قصص وحكايات', nameEn: 'Stories and Tales' },
    ],
  },
];

/**
 * Format taxonomy tree for API responses with localized displayName
 */
export function formatHomeTaxonomy(
  lang: 'ar' | 'en' = 'ar',
): FormattedTaxonomyCategory[] {
  const isEn = lang === 'en';
  return HOME_FEED_TAXONOMY.map((cat) => ({
    id: cat.id,
    name: isEn ? cat.nameEn : cat.nameAr,
    displayName: isEn ? cat.nameEn : cat.nameAr,
    nameAr: cat.nameAr,
    nameEn: cat.nameEn,
    subcategories: cat.subcategories.map((sub) => ({
      id: sub.id,
      name: isEn ? sub.nameEn : sub.nameAr,
      displayName: isEn ? sub.nameEn : sub.nameAr,
      nameAr: sub.nameAr,
      nameEn: sub.nameEn,
    })),
  }));
}

/**
 * Resolve a category from input (id, nameAr, nameEn, or alias)
 */
export function resolveTaxonomyCategory(
  input?: string | null,
): TaxonomyCategory | null {
  if (!input) return null;
  const clean = input.trim().toLowerCase();
  if (!clean || clean === 'all' || clean === 'الكل') return null;

  return (
    HOME_FEED_TAXONOMY.find((cat) => {
      if (cat.id === 'all') return false;
      if (cat.id.toLowerCase() === clean) return true;
      if (cat.nameAr.toLowerCase() === clean) return true;
      if (cat.nameEn.toLowerCase() === clean) return true;
      if (cat.aliases?.some((a) => a.toLowerCase() === clean)) return true;
      return false;
    }) || null
  );
}

/**
 * Resolve a subcategory from input within a category or across all categories
 */
export function resolveTaxonomySubcategory(
  subcategoryInput?: string | null,
  categoryInput?: string | null,
): TaxonomySubcategory | null {
  if (!subcategoryInput) return null;
  const cleanSub = subcategoryInput.trim().toLowerCase();
  if (!cleanSub || cleanSub === 'all' || cleanSub === 'الكل') return null;

  const parentCat = resolveTaxonomyCategory(categoryInput);
  const pool = parentCat
    ? parentCat.subcategories
    : HOME_FEED_TAXONOMY.flatMap((c) => c.subcategories);

  return (
    pool.find((sub) => {
      if (sub.id === 'all') return false;
      if (sub.id.toLowerCase() === cleanSub) return true;
      if (sub.nameAr.toLowerCase() === cleanSub) return true;
      if (sub.nameEn.toLowerCase() === cleanSub) return true;
      return false;
    }) || null
  );
}
