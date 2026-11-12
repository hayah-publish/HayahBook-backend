export const ar = {
  // Common
  'common.success': 'تمت العملية بنجاح',
  'common.unauthorized': 'غير مصرح بالوصول',
  'common.forbidden': 'هذا الإجراء متاح للمشرفين فقط',
  'common.not_found': 'العنصر المطلوب غير موجود',
  'common.bad_request': 'طلب غير صالح',
  'common.rate_limit': 'يرجى الانتظار دقيقة واحدة قبل طلب رمز تحقق جديد',
  'common.too_many_requests': 'عدد الطلبات كبير جداً. يرجى المحاولة مرة أخرى لاحقاً.',

  // Language
  'language.updated': 'تم ضبط لغة التطبيق بنجاح',
  'language.invalid': 'اللغة غير مدعومة. اللغات المدعومة هي: ar, en',

  // Auth
  'auth.unauthorized': 'غير مصرح بالوصول',
  'auth.signup_success': 'تم إنشاء الحساب بنجاح',
  'auth.signup_email_verified': 'تم تأكيد البريد الإلكتروني بنجاح',
  'auth.login_success': 'تم تسجيل الدخول بنجاح',
  'auth.google_login_success': 'تم تسجيل الدخول بواسطة جوجل بنجاح',
  'auth.email_already_registered': 'البريد الإلكتروني مسجل بالفعل',
  'auth.email_registered_oauth':
    'تم إنشاء حساب بهذا البريد عبر جوجل أو رمز التحقق. يرجى تسجيل الدخول بتلك الطريقة.',
  'auth.invalid_credentials': 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'auth.account_disabled': 'الحساب معطل',
  'auth.email_not_verified': 'يرجى تأكيد البريد الإلكتروني أولاً',
  'auth.user_not_found': 'الحساب غير موجود',
  'auth.account_not_found_email':
    'البريد الإلكتروني المُدخل غير مسجل، الحساب غير موجود',
  'auth.session_revoked': 'تم إلغاء الجلسة. يرجى تسجيل الدخول مجدداً.',
  'auth.invalid_token': 'التوكن غير صالح أو منتهي الصلاحية',
  'auth.invalid_token_type': 'نوع التوكن غير صالح',
  'auth.logged_out': 'تم تسجيل الخروج بنجاح',
  'auth.password_changed': 'تم تغيير كلمة المرور بنجاح',
  'auth.passwords_do_not_match': 'كلمة المرور وتأكيد كلمة المرور غير متطابقين',
  'auth.current_password_incorrect': 'كلمة المرور الحالية غير صحيحة',
  'auth.invalid_current_password': 'كلمة المرور الحالية غير صحيحة',
  'validation.birthday_invalid':
    'تاريخ الميلاد يجب أن يكون بصيغة صالحة (مثال: YYYY-MM-DD)',
  'auth.password_reset_success':
    'تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
  'auth.profile_completed': 'تم إكمال الملف الشخصي بنجاح',
  'auth.profile_updated': 'تم تحديث الملف الشخصي بنجاح',
  'auth.profile_url_required': 'رابط الصورة الشخصية مطلوب',
  'auth.country_required': 'الدولة مطلوبة',
  'auth.account_deleted': 'تم حذف الحساب نهائياً بنجاح',
  'auth.email_changed': 'تم تغيير البريد الإلكتروني بنجاح',
  'auth.email_same_as_current': 'البريد الجديد مطابق للبريد الحالي',
  'auth.email_already_in_use': 'البريد الإلكتروني الجديد مسجل بالفعل بحساب آخر',
  'auth.phone_updated': 'تم تعديل رقم الهاتف بنجاح',
  'auth.no_phone_registered':
    'لا يوجد رقم هاتف مسجل لهذا الحساب لتأكيد الحذف عبره',
  'auth.google_invalid_token': 'توكن جوجل غير صالح',
  'auth.google_email_not_verified': 'البريد الإلكتروني لحساب جوجل غير مؤكد',
  'auth.e164_invalid':
    'مجموع أرقام رمز الدولة ورقم الجوال يجب ألا يتجاوز 15 رقماً وفق معيار E.164',
  'auth.e164_digits_only': 'رمز الدولة ورقم الجوال يجب أن يحتويا على أرقام فقط',

  // OTP
  'otp.signup_if_exists': 'إذا كان البريد مؤهلاً، فسيتم إرسال رمز التحقق إليه',
  'otp.sent_email': 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح',
  'otp.sent_phone': 'تم إرسال رمز التحقق إلى رقم هاتفك بنجاح',
  'otp.verified': 'تم التحقق من الرمز بنجاح',
  'otp.code_valid': 'رمز التحقق صحيح',
  'otp.expired': 'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد',
  'otp.invalid': 'رمز التحقق غير صحيح',
  'otp.invalid_or_expired': 'رمز التحقق غير صحيح أو منتهي الصلاحية',
  'otp.too_many_attempts': 'تم تجاوز الحد الأقصى للمحاولات لهذا الرمز',
  'otp.wait_cooldown': 'يرجى الانتظار دقيقة واحدة قبل طلب رمز تحقق جديد',
  'otp.delivery_failed': 'تعذر إرسال رمز التحقق. حاول مرة أخرى لاحقاً.',
  'otp.reset_if_exists':
    'إذا كان هناك حساب مرتبط بهذا البريد، فسيتم إرسال رمز إعادة تعيين كلمة المرور.',
  'otp.subject_signup': 'رمز التحقق لإنشاء الحساب - HayahBook',
  'otp.subject_reset': 'إعادة تعيين كلمة المرور - HayahBook',
  'otp.subject_change_password': 'رمز التحقق لتغيير كلمة المرور - HayahBook',
  'otp.subject_change_email': 'رمز التحقق لتغيير البريد الإلكتروني - HayahBook',
  'otp.subject_delete_account': 'رمز تأكيد حذف الحساب - HayahBook',
  'otp.subject_update_phone': 'رمز تأكيد تعديل رقم الهاتف - HayahBook',
  'otp.subject_login': 'رمز تسجيل الدخول - HayahBook',

  // Countries
  'countries.not_found':
    'معرف الدولة غير صحيح أو غير موجود، يرجى اختيار دولة صالحة من القائمة',

  // Interests
  'interests.saved': 'تم حفظ الاهتمامات بنجاح',
  'interests.empty_selection': 'يجب إرسال interestIds أو interestNames',
  'interests.already_exists': 'الاهتمام موجود مسبقاً',
  'interests.not_found': 'الاهتمام غير موجود',
  'interests.deleted': 'تم حذف الاهتمام بنجاح',
  'categories.saved': 'تم حفظ الفئة بنجاح',
  'categories.not_found': 'الفئة المحددة غير موجودة',
  'categories.required': 'يرجى تحديد الفئة المطلوبة',

  // Books
  'books.not_found': 'الكتاب غير موجود',
  'books.deleted': 'تم حذف الكتاب بنجاح',
  'books.empty_search': 'اكتب كلمة للبحث',
  'books.invalid_type': 'النوع يجب أن يكون ebook أو audiobook',
  'books.status_updated': 'تم تحديث حالة قراءة الكتاب بنجاح',
  'books.status_removed': 'تمت إزالة الكتاب من قائمة القراءة بنجاح',
  'books.reading_status_invalid': 'حالة القراءة غير صحيحة',

  // Audiobooks
  'audiobooks.not_found': 'الكتاب الصوتي غير موجود',
  'audiobooks.created': 'تم إنشاء الكتاب الصوتي بنجاح',
  'audiobooks.updated': 'تم تحديث الكتاب الصوتي بنجاح',
  'audiobooks.deleted': 'تم حذف الكتاب الصوتي بنجاح',

  // Authors
  'authors.not_found': 'المؤلف غير موجود',
  'authors.ids_empty': 'قائمة معرّفات الكُتّاب لا يمكن أن تكون فارغة',
  'authors.select_at_least_3': 'اختر (5) على الأقل للمتابعة',
  'authors.select_at_least_5': 'اختر (5) على الأقل للمتابعة',
  'authors.followed_success': 'تمت متابعة المؤلفين بنجاح',
  'authors.followed_single_success': 'تمت المتابعة بنجاح',
  'authors.unfollowed_success': 'تم إلغاء المتابعة بنجاح',
  'authors.already_followed': 'تمت المتابعة بالفعل',
  'authors.already_not_following': 'غير متابع بالفعل',
  'authors.some_not_found': 'بعض معرّفات المؤلفين غير موجودة',

  // Creators
  'creators.not_found': 'صانع المحتوى غير موجود',
  'creators.select_at_least_3': 'اختر (5) على الأقل للمتابعة',
  'creators.select_at_least_5': 'اختر (5) على الأقل للمتابعة',
  'creators.followed_success': 'تمت متابعة صناع المحتوى بنجاح',
  'creators.followed_single_success': 'تمت المتابعة بنجاح',
  'creators.unfollowed_success': 'تم إلغاء المتابعة بنجاح',
  'creators.already_followed': 'تمت المتابعة بالفعل',
  'creators.already_not_following': 'غير متابع بالفعل',
  'creators.some_not_found': 'بعض معرّفات صناع المحتوى غير موجودة',
  'creators.user_type_creator': 'صانع محتوى',

  // User Following & Blocking
  'users.cannot_follow_self': 'لا يمكنك متابعة حسابك الشخصي',
  'users.not_found': 'المستخدم غير موجود',
  'users.followed_success': 'تمت متابعة المستخدم بنجاح',
  'users.unfollowed_success': 'تم إلغاء متابعة المستخدم بنجاح',
  'users.already_following': 'أنت تتابع هذا المستخدم بالفعل',
  'users.already_not_following': 'أنت لا تتابع هذا المستخدم بالفعل',
  'users.cannot_block_self': 'لا يمكنك حظر نفسك',
  'users.blocked_success': 'تم حظر المستخدم بنجاح',
  'users.unblocked_success': 'تم إلغاء حظر المستخدم بنجاح',
  'users.already_blocked': 'المستخدم محظور بالفعل',
  'users.not_blocked': 'المستخدم غير محظور',
  'users.block_relationship':
    'لا يمكنك التفاعل مع هذا المستخدم أثناء وجود حظر نشط',
  'users.blocked_interaction':
    'لا يمكنك التفاعل مع هذا المستخدم أثناء وجود حظر نشط',

  // Upload
  'upload.avatar_success': 'تم رفع الصورة الشخصية بنجاح',
  'upload.file_required': 'يرجى اختيار صورة',
  'upload.invalid_file_type':
    'نوع الملف غير مدعوم. الأنواع المسموحة: JPG, PNG, WEBP, HEIC',
  'upload.file_too_large': 'حجم الملف يتجاوز الحد الأقصى (10 ميجابايت)',
  'upload.file_too_large_general': 'حجم الملف يتجاوز الحد الأقصى المسموح به',
  'upload.payload_too_large': 'حجم البيانات يتجاوز الحد الأقصى المسموح به',
  'upload.post_images_success': 'تم رفع الصور بنجاح',
  'upload.post_video_success': 'تم رفع الفيديو بنجاح',
  'upload.images_limit_exceeded':
    'الحد الأقصى المسموح به هو 10 صور فقط لكل منشور',
  'upload.image_size_exceeded':
    'حجم الصورة الواحدة يتجاوز الحد الأقصى (20 ميجابايت)',
  'upload.video_limit_exceeded': 'يسمح برفع فيديو واحد فقط لكل منشور',
  'upload.video_size_exceeded': 'حجم الفيديو يتجاوز الحد الأقصى (500 ميجابايت)',
  'upload.invalid_video_type':
    'نوع الفيديو غير مدعوم. الأنواع المسموحة: MP4, MOV, WEBM, MKV',

  // Posts
  'posts.created': 'تم نشر المنشور بنجاح',
  'posts.updated': 'تم تعديل المنشور بنجاح',
  'posts.deleted': 'تم حذف المنشور بنجاح',
  'posts.not_found': 'المنشور غير موجود',
  'posts.unauthorized': 'غير مصرح لك بحذف هذا المنشور',
  'posts.edit_unauthorized': 'غير مصرح لك بتعديل هذا المنشور',
  'posts.toggle_comments_unauthorized':
    'غير مصرح لك بتغيير إعدادات التعليقات لهذا المنشور',
  'posts.content_required': 'محتوى المنشور مطلوب',
  'posts.content_or_media_required': 'محتوى المنشور مطلوب',
  'posts.min_words_required': 'يجب أن يحتوي المنشور على كلمة واحدة على الأقل في حال كتابة نص',
  'posts.max_words_exceeded': 'يجب ألا يتجاوز محتوى المنشور 500 كلمة',
  'posts.comments_disabled': 'التعليقات معطلة على هذا المنشور',
  'posts.comments_disabled_success': 'تم تعطيل التعليقات على هذا المنشور بنجاح',
  'posts.comments_enabled_success': 'تم تفعيل التعليقات على هذا المنشور بنجاح',
  'posts.hidden_success': 'تم إخفاء المنشور، ستشاهد محتوى أقل من هذا النوع',
  'posts.unhidden_success': 'تمت استعادة المنشور بنجاح',
  'posts.shared_success': 'تمت مشاركة المنشور بنجاح',
  'posts.cannot_report_own': 'لا يمكنك الإبلاغ عن منشورك الخاص',
  'posts.already_reported': 'لقد قمت بالإبلاغ عن هذا المنشور مسبقاً',
  'posts.reported_success': 'تم تقديم البلاغ بنجاح وسيتم مراجعته',

  // Articles
  'articles.created': 'تم نشر المقال بنجاح',
  'articles.deleted': 'تم حذف المقال بنجاح',
  'articles.not_found': 'المقال غير موجود',
  'articles.unauthorized': 'غير مصرح لك بحذف هذا المقال',
  'articles.title_required': 'عنوان المقال مطلوب',
  'articles.cover_required': 'الصورة الرئيسية للمقال مطلوبة',
  'articles.category_required':
    'تصنيف المقال مطلوب، يرجى اختيار تصنيف من قائمة الفئات',
  'articles.category_invalid':
    'التصنيف المحدد غير صالح. يرجى اختيار تصنيف من فئات المقالات المعتمدة',
  'articles.content_required': 'نص المقال مطلوب',
  'articles.min_words_required': 'يجب ألا يقل محتوى المقال عن 501 كلمة',
  'articles.max_words_exceeded': 'يجب ألا يتجاوز محتوى المقال 5000 كلمة',
  'articles.terms_required':
    'يجب الموافقة على الشروط والخصوصية لمجتمع Hayahbook لنشر المقال',

  // Bookmarks / Saved (المحفوظات)
  'bookmarks.saved': 'تمت إضافة العنصر إلى المحفوظات بنجاح',
  'bookmarks.removed': 'تمت إزالة العنصر من المحفوظات بنجاح',
  'bookmarks.already_removed': 'العنصر غير موجود في المحفوظات',
  'bookmarks.not_found': 'العنصر المطلوب غير موجود',

  // Reactions (التفاعلات)
  'reactions.target_id_required': 'معرّف العنصر مطلوب (id أو postId أو targetId)',
  'reactions.added': 'تم التفاعل بنجاح',
  'reactions.updated': 'تم تعديل التفاعل بنجاح',
  'reactions.removed': 'تمت إزالة التفاعل بنجاح',
  'reactions.invalid_type':
    'نوع التفاعل غير صالح. الأنواع المتاحة: اتفق، احببته، احسنت، يستحق التفكير، اعترض',
  'reactions.agree': 'اتفق',
  'reactions.love': 'احببته',
  'reactions.applaud': 'احسنت',
  'reactions.insightful': 'يستحق التفكير',
  'reactions.disagree': 'اعترض',

  // Comments (التعليقات)
  'comments.alias_id_required':
    'معرف الاسم المستعار مطلوب عند اختيار الاسم المستعار',
  'comments.alias_invalid_or_not_owned':
    'الاسم المستعار غير صالح أو لا ينتمي لهذا الحساب',
  'comments.anonymous_reader': 'مستخدم مجهول',
  'comments.anonymous_reader_with_num': 'مستخدم مجهول - {num}',
  'comments.created': 'تم نشر التعليق بنجاح',
  'comments.reply_created': 'تم نشر الرد بنجاح',
  'comments.updated': 'تم تعديل التعليق بنجاح',
  'comments.deleted': 'تم حذف التعليق بنجاح',
  'comments.not_found': 'التعليق غير موجود',
  'comments.content_required': 'محتوى التعليق مطلوب',
  'comments.post_required': 'معرف المحتوى مطلوب',
  'comments.comment_required': 'معرف التعليق مطلوب',
  'comments.unauthorized_edit': 'غير مصرح لك بتعديل هذا التعليق',
  'comments.unauthorized_delete': 'غير مصرح لك بحذف هذا التعليق',
  'comments.unauthorized_pin': 'يسمح لصاحب المنشور فقط بتثبيت التعليقات',
  'comments.pinned': 'تم تثبيت التعليق في الأعلى بنجاح',
  'comments.unpinned': 'تم إلغاء تثبيت التعليق',
  'comments.hidden': 'تم إخفاء التعليق بنجاح',
  'comments.unhidden': 'تم إظهار التعليق بنجاح',
  'comments.muted': 'تم كتم إشعارات هذا التعليق',
  'comments.unmuted': 'تم تفعيل إشعارات هذا التعليق',
  'comments.reported': 'تم إرسال البلاغ بنجاح وسيتم مراجعته',
  'comments.already_reported':
    'لقد قمت بالإبلاغ عن هذا التعليق مسبقاً وسيتم مراجعته',
  'comments.cannot_report_own_comment': 'لا يمكنك الإبلاغ عن تعليقك الخاص',
  'comments.invalid_report_reason': 'سبب الإبلاغ غير صالح',
  'comments.report_title': 'الإبلاغ عن تعليق',
  'comments.report_subtitle':
    'لماذا تبلغ عن هذا التعليق؟ بلاغك سري ومجهول الهوية.',

  // Report Reasons (أسباب الإبلاغ)
  'reports.title': 'الإبلاغ عن تعليق',
  'reports.subtitle': 'لماذا تبلغ عن هذا التعليق؟ بلاغك سري ومجهول الهوية.',
  'reports.block_title': 'حظر',
  'reports.submitted': 'تم إرسال البلاغ بنجاح وسيتم مراجعته',
  'reports.already_reported':
    'لقد قمت بالإبلاغ عن هذا التعليق مسبقاً وسيتم مراجعته',
  'reports.cannot_report_own_comment': 'لا يمكنك الإبلاغ عن تعليقك الخاص',
  'reports.invalid_reason': 'سبب الإبلاغ غير صالح',
  'reports.spam': 'محتوى غير مرغوب فيه',
  'reports.harassment_or_bullying': 'مضايقة أو تنمر',
  'reports.hate_speech': 'خطاب كراهية',
  'reports.violence_or_threats': 'عنف أو تهديدات',
  'reports.nudity_or_sexual_content': 'عري أو محتوى جنسي',
  'reports.scam_or_fraud': 'احتيال أو خداع',
  'reports.false_information': 'معلومات كاذبة أو مضللة',
  'reports.something_else': 'سبب آخر',
  'reports.details_too_long': 'يجب ألا تتجاوز تفاصيل البلاغ 160 حرفاً',
  'reports.details_title': 'إضافة المزيد من التفاصيل',
  'reports.details_subtitle':
    'اختياري. يساعد السياق فريقنا على مراجعة هذا التعليق بشكل أسرع.',
  'reports.details_placeholder': 'أخبرنا ما المشكلة في هذا التعليق...',
  'reports.submit_button': 'إرسال',
  'reports.success_title': 'شكراً، لقد تلقينا بلاغك',
  'reports.success_subtitle':
    'سنقوم بمراجعته وإعلامك بالنتيجة في إشعاراتك. يمكنك أيضاً حماية مساحتك:',
  'reports.block_subtitle': 'لن يتمكن من رؤية منشوراتك أو التعليق عليها',
  'reports.done_button': 'تم',

  // Aliases (الأسماء المستعارة)
  'aliases.created': 'تم إنشاء الاسم المستعار بنجاح',
  'aliases.updated': 'تم تعديل الاسم المستعار بنجاح',
  'aliases.nickname_already_taken': 'هذا الاسم المستعار مستخدم بالفعل، يرجى اختيار اسم آخر',
  'aliases.nickname_available': 'الاسم المستعار متاح',
  'aliases.nickname_required': 'الاسم المستعار مطلوب',
  'aliases.not_found': 'الاسم المستعار غير موجود',
  'aliases.max_limit_reached': 'يمكنك إنشاء 5 أسماء مستعارة بحد أقصى',
  'aliases.deleted_alias': 'اسم مستعار محذوف',
  'aliases.avatar_invalid': 'رابط الصورة الرمزية غير صالح',
  'aliases.already_has_alias':
    'لديك بالفعل اسم مستعار مفعّل. لا يمكنك إنشاء أكثر من اسم مستعار واحد، ولكن يمكنك تعديل اسمك المستعار الحالي.',
  'aliases.not_owned': 'ليس لديك صلاحية لتعديل هذا الاسم المستعار',
  'aliases.cooldown_active':
    'لا يمكنك تعديل الاسم المستعار أو الصورة إلا بعد مرور 30 يوماً من آخر تعديل. يمكنك التعديل مجدداً بعد {days} يوم (بتاريخ {date}).',

  // Excerpts (المقتطفات والتمييزات)
  'excerpts.created': 'تم حفظ المقتطف بنجاح',
  'excerpts.updated': 'تم تعديل المقتطف بنجاح',
  'excerpts.deleted': 'تم حذف المقتطف بنجاح',
  'excerpts.not_found': 'المقتطف غير موجود',
  'excerpts.content_required': 'نص المقتطف مطلوب ولا يمكن أن يكون فارغاً',
  'snippets.published': 'تم نشر المقتطف في ملفك الشخصي بنجاح',
  'snippets.quote_required': 'نص المقتطف إلزامي للنشر',
  'snippets.deleted': 'تم حذف المقتطف المنشور بنجاح',

  // Visuals & Reels (المرئيات والريلز)
  'visuals.published': 'تم نشر الريلز بنجاح',
  'visuals.video_required': 'يجب إرفاق مقطع فيديو لنشر الريلز',
  'visuals.single_video_only': 'يمكن رفع فيديو واحد فقط للريلز',
  'visuals.no_images_allowed': 'لا يمكن إرفاق صور مع الريلز، الريلز يتطلب فيديو فقط',
  'visuals.invalid_aspect_ratio': 'أبعاد الفيديو يجب أن تكون 9:16 (فيديو عمودي للريلز)',
  'visuals.single_book_only': 'في حالة الإشارة إلى كتاب، يسمح بكتاب واحد فقط',
  'visuals.video_size_exceeded': 'حجم الفيديو يجب ألا يتجاوز 500 ميجابايت',
};
