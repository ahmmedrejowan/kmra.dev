# Translations

Every site is in English and Bangla. English lives at the root (`/compress`), other languages
under a prefix (`/bn/compress`).

## Where the words are

| What                                            | File                                                       |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Interface text shared by every site             | `packages/ui/src/i18n/bn.ts`                               |
| Site-specific interface text                    | `packages/ui/src/i18n/bn-<site>.ts` (where a site has one) |
| Tool and task names, steps, intros, group names | `packages/registry/src/locales/bn.ts` and `bn-<site>.ts`   |

Interface files are keyed by the English text itself, with `{name}` placeholders:

```ts
"Removing {n} of {t} fields": "{t}টির মধ্যে {n}টি তথ্য সরানো হচ্ছে",
```

A missing key falls back to English, so a page never breaks for lack of a translation. Numbers
in placeholders are written in the language's digits automatically.

## In code

- Astro components: `const T = (s, v) => t(locale, s, v)` with `locale = pageLocale(Astro)`.
- React islands: `const T = useT()`. Each island wraps itself in `LangProvider` and takes a
  `lang` prop.
- New interface text always goes through `T()`, and gets its translation in the same change.

## Fixing a translation

Find the English text in the files above and change the translation next to it. Open a pull
request, or an issue with the "Translation" form if you'd rather describe it.

## Adding a language

1. Add it to `LOCALES` in `packages/ui/src/lib/i18n.ts`.
2. Write `packages/ui/src/i18n/<code>.ts` and the registry's content file in
   `packages/registry/src/locales/`.
3. List it in each site's `locales` in the registry and in its Astro config's `i18n.locales`,
   and add `src/pages/<code>/` (copy `src/pages/bn/`).

The language menu (globe button) and the footer's language list appear only on sites with more
than one language.
