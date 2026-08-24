import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ar from './locales/ar.json';
import en from './locales/en.json';

export const LANGUAGES = {
  ar: { code: 'ar', label: 'العربية', dir: 'rtl' },
  en: { code: 'en', label: 'English', dir: 'ltr' },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

/** Language-aware document title */
const TITLES: Record<LanguageCode, string> = {
  ar: 'ولاد حلال | لحوم وفراخ ومجمدات',
  en: 'Wlad Halal | Meat, Chicken & Frozen Foods',
};

/** Language-aware meta description */
const META_DESCRIPTIONS: Record<LanguageCode, string> = {
  ar: 'ولاد حلال — متجر إلكتروني للحوم والفراخ والمصنعات والمجمدات.',
  en: 'Wlad Halal — Your online store for meat, chicken, processed foods and frozen products.',
};

const applyDocumentDirection = (lng: string): void => {
  const lang = (Object.keys(LANGUAGES).includes(lng) ? lng : 'ar') as LanguageCode;
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGES[lang].dir;

  // Update document title
  document.title = TITLES[lang];

  // Update meta description
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', META_DESCRIPTIONS[lang]);
};

const initialLanguage = (() => {
  try {
    const stored = localStorage.getItem('ph_lang');
    return stored === 'en' || stored === 'ar' ? stored : 'ar';
  } catch {
    return 'ar';
  }
})();

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: initialLanguage,
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'ph_lang',
    },
  });

i18next.on('languageChanged', applyDocumentDirection);
applyDocumentDirection(i18next.language);

export const changeLanguage = (lng: LanguageCode): void => {
  void i18next.changeLanguage(lng);
};

export default i18next;
