# شرح الـ plugin ومزاياها

`@qemam/eslint-plugin-automated-code`

plugin لـ ESLint بتطبّق معيار **Automated Code Documentation** على مشاريع Angular. أي كلاس public لازم يكون عليه تعليق توثيق كامل، ولو ناقص بيظهر **warning** في الـ lint وفي VS Code وقت الكتابة.

التفاصيل الكاملة في [Implementation Guide](implementation-guide.md).

## بتفحص إيه بالظبط

أي كلاس عليه `@Component` أو `@Injectable` أو `@Directive` أو `@Pipe` لازم يكون فيه:

| المطلوب | الـ rule اللي بتفحصه |
| --- | --- |
| تعليق `/** */` فوق الكلاس، وفوق كل `@Input`/`@Output` أو `input()`/`output()`/`model()` | `jsdoc/require-jsdoc` |
| سطر summary يشرح الكلاس بيعمل إيه | `jsdoc/require-description` |
| تاج `@example` فيه مثال استخدام | `jsdoc/require-example` |
| تاج `@accessibility` (أو `N/A - السبب` لو الكلاس مالوش واجهة) | `automated-code-docs/require-accessibility-tag`، وده الـ rule الخاص بالـ plugin |

الـ rules الأربعة دي بترجع من دالة واحدة اسمها `buildRules()`، وكلها على `warn` كـ default.

## مزايا الـ rules (الفحص نفسه)

1. **بتدعم الـ signals من غير أي إعداد.** بتفحص `input()` و`input.required()` و`output()` و`model()` و`model.required()`، زيها زي `@Input()` و`@Output()` بالظبط.
2. **مابتمسكش أي function اسمها `input()` بالغلط.** الـ signals بتتفحص بس لو كانت property مباشرة جوه كلاس عليه decorator من الأربعة ([lib/index.js](../lib/index.js)).
3. **مابتلمسش الكود اللي خارج المعيار.** الـ functions العادية والـ functional guards والـ models مابيطلعش عليها warnings (`require: { FunctionDeclaration: false }`). الـ class-based guard عليه `@Injectable`، فبيتفحص زي أي service.
4. **مافيش warning مكرر على نفس الـ member.**
5. **rule مخصوصة لـ `@accessibility`.** `eslint-plugin-jsdoc` مافيهوش rule يجبر على تاج custom، فالـ plugin كتبتها بنفسها ([require-accessibility-tag.js](../lib/require-accessibility-tag.js)).
6. **`--fix` مش بيخبّي المشكلة.** الـ fixers اتقفلت (`enableFixer: false`)، فلا `eslint --fix` ولا fix-on-save هيحطوا `/** */` فاضي أو `@example` فاضي. الـ warning بيفضل لحد ما حد يكتب التوثيق فعلاً، والـ fixes التانية زي Prettier شغالة عادي.
7. **قابلة للتخصيص.** `buildRules()` بتاخد `decorators` و`memberDecorators` و`signalMembers` و`severity`.
8. **`warn` كـ default.** مناسبة للمشاريع القديمة عشان الـ build مايقعش، والمشاريع الجديدة ممكن تبدأ على `error`.

## التسطيب ومزايا الـ `ng add`

أمر واحد بس:

```bash
ng add @qemam/eslint-plugin-automated-code
```

1. **بتتأكد من نسخة الـ Node قبل أي حاجة.** لو أقدم من 18.18 بتقف ومابتغيّرش ولا ملف ([schematics/ng-add/index.js](../schematics/ng-add/index.js)).
2. **بتختار نسخة `eslint-plugin-jsdoc` المناسبة للـ Node اللي على الجهاز:**

   | Node | eslint-plugin-jsdoc |
   | --- | --- |
   | 22.22.2+ | `^64` |
   | 22.13+ | `^63` |
   | 20.19+ | `^62` |
   | 20.11+ | `^61` |
   | 18.18+ | `^50` |

   ولو `eslint-plugin-jsdoc` متسطّب أصلاً، بتسيبه زي ما هو.
3. **بتشخّص المشروع وتقول المطلوب:**
   - لو مافيش `eslint.config.js`، بتقرا نسخة Angular وتدّي الأمر المظبوط، زي `ng add angular-eslint@19`.
   - لو المشروع لسه على `.eslintrc`، بتطلب migrate الأول.
4. **مابتبوّظش الـ config الموجود.** بتضيف block منفصل في الآخر من غير ما تعدّل في الموجود. وبتشتغل مع CommonJS وESM و`defineConfig([...])`، ولو `jsdoc` متعمله import باسم تاني بتستخدم نفس الاسم.
5. **ممكن تتشغّل أكتر من مرة عادي.**
6. **بتكتشف المشاكل القديمة وتنبّه عليها:** الأسماء القديمة `@qemam/eslint-plugin-doc-dod` و`@qemam/eslint-plugin-automated-code-docs`، والـ workaround القديم بتاع الـ signals اللي بيطلّع كل warning مرتين.
7. **بتظبط VS Code:**
   - بتضيف ESLint extension للـ recommendations.
   - بتشيل الإعدادات اللي بتوقّف الـ warnings الحية من غير ما حد يحس: `overrideConfigFile` اللي بيشاور على ملف مش موجود، و`workingDirectories` اللي خارج الـ repo، و`useFlatConfig: false`.
   - مابتعملش `settings.json` لو مش موجود.
8. **فيها options:** `--skip-vscode` و`--skip-install`.
9. **بتطبع كل تغيير عملته**، وفي الآخر بتقول الخطوة الجاية: تسجيل الـ baseline.

## الجودة والـ tests

- فيه tests للـ rule لوحدها، ولـ `buildRules()` كاملة (ومعاها regression tests لـ bugs حصلت قبل كده)، وللـ `ng add` على كل الحالات اللي فوق.
- فيه test بيولّد `eslint.config.js` حقيقي ويعمل lint بيه على component، فلو الـ config اللي بيطلع بايظ، الـ test بيقع.

## حاجات مابتمسكهاش

- **مش بتكتب التوثيق.** هي بتتأكد إن التعليق والتاجات موجودين وبس.
- الـ inputs المتعرّفة جوه `@Component({ inputs: [...] })`، والـ `host: {...}`.
- الـ base classes اللي مالهاش decorator.
- الـ public methods في الـ services.
- جودة الكلام: `/** The data. */` بيعدّي عادي.

## فايدتها

1. **IntelliSense أحسن:** التعليقات بتظهر tooltips في الـ IDE، فالمطوّر يفهم الـ component بيستقبل إيه وبيطلّع إيه من غير ما يفتح السورس.
2. **Onboarding أسرع** لأي حد جديد في الفريق.
3. **Accessibility بتبقى جزء من التوثيق:** كل component لازم يوضّح سلوكه مع الكيبورد والـ screen reader.
4. **مابتكسرش حاجة:** شغّالة كـ `warn`، ومعاها CI ratchet (`ng lint --max-warnings=<baseline>`) بيمنع إن عدد الـ warnings يزيد.
5. **package واحدة لكل الـ repos:** أي إصلاح بيتعمل مرة واحدة وبيوصل للكل.

## ملحوظات

- **.NET:** الموضوع هناك مالوش علاقة بالـ plugin. بيتعمل بـ `GenerateDocumentationFile` في `Directory.Build.props`، والكومبايلر نفسه بيطلّع warning `CS1591` على أي عنصر public مالوش `<summary>`. وده مابيفحصش accessibility خالص.
- **أهم Open item:** الـ package لسه مش منشورة على npm feed. المشاريع بتسطّبها من path محلي، وعشان كده `npm install` بيفشل في الـ CI وعلى أي جهاز تاني غير جهاز صاحب الـ package.
