# HayahBook Backend Agent Guidelines & Rules

## 1. Apidog Synchronization Rule (إلزامي وتلقائي دائماً)
- **كل تعديل أو إضافة أو حذف لأي Endpoint في الباك إند يجب أن ينعكس فوراً وتلقائياً على ملف `hayahbook_apidog_updated_endpoints.json`.**
- الملف مبني بصيغة Apidog Native Project (`apidogProject: "1.0.0"`, `$schema: { app: "apidog", type: "project", version: "1.2.0" }`).
- يجب الحفاظ على ترتيب وتصنيف الـ Endpoints داخل المجلدات الـ 10 المنظمة (Auth, Posts & Articles, Aliases, Home Feed & Reactions, Comments, Books, Bookmarks, Users, Authors & Creators, Interests & Settings).
- يجب تضمين المسار الكامل، الطريقة (HTTP Method)، معاملات الرأس والـ Query والـ Path، جسم الطلب (Body) بنماذج حية، وأمثلة استجابات واقعية باللغتين العربية والإنجليزية، وتحديد نوع المصادقة (Bearer Token أو Public).
- يتم عمل commit و push لملف Apidog مع كل تحديث يخص الـ API.

## 2. Code Quality & Testing Rules
- قبل رفع أي تعديلات على GitHub:
  - تشغيل الاختبارات (`npm run test`) والتأكد من نجاح جميع الـ test suites.
  - تشغيل الفحص المصدري (`npm run lint`).
  - تشغيل البناء (`npm run build`).
- الحفاظ على سلامة التوثيق والـ Migrations الخاصة بقاعدة البيانات.

