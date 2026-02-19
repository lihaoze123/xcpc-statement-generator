import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files - Vite supports JSON imports natively
import enCommon from './locales/en/common.json';
import enEditor from './locales/en/editor.json';
import enMessages from './locales/en/messages.json';
import enOnline from './locales/en/online.json';
import zhCommon from './locales/zh/common.json';
import zhEditor from './locales/zh/editor.json';
import zhMessages from './locales/zh/messages.json';
import zhOnline from './locales/zh/online.json';

const resources = {
  en: {
    common: enCommon,
    editor: enEditor,
    messages: enMessages,
    online: enOnline,
  },
  zh: {
    common: zhCommon,
    editor: zhEditor,
    messages: zhMessages,
    online: zhOnline,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'zh', // default language
    fallbackLng: 'zh',
    defaultNS: 'common',
    ns: ['common', 'editor', 'messages', 'online'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
