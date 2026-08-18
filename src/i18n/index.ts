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

const applyDocumentDirection = (lng: string): void => {
  const lang = (Object.keys(LANGUAGES).includes(lng) ? lng : 'ar') as LanguageCode;
  document.documentElement.lang = lang;
  document.documentElement.dir = LANGUAGES[lang].dir;
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
