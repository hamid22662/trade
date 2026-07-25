import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en, fa } from './resources';

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  resources: { fa, en },
  lng: 'fa',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
});

export default i18n;
