import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '@/i18n';
import { getSettings, setSetting } from '@/db/repositories';
import { deleteAccountDatabase } from '@/db/database';
import {
  Account,
  createAccount as createAccountRecord,
  DEFAULT_ACCOUNT_ID,
  getActiveAccountId,
  getGlobalSetting,
  listAccounts,
  removeAccountFromRoster,
  renameAccount as renameAccountRecord,
  setActiveAccountId,
  setGlobalSetting,
} from '@/services/accounts';
import { Language, ThemeMode } from '@/types';
import { AppTheme, makeTheme } from '@/theme';

type ExperienceMode = 'simple' | 'pro';

// Preferences that must be identical no matter which trading account is active.
type GlobalPrefs = { language: Language; themeMode: ThemeMode; experienceMode: ExperienceMode };

const GLOBAL_DEFAULTS: GlobalPrefs = { language: 'fa', themeMode: 'dark', experienceMode: 'simple' };
const GLOBAL_MIGRATION_FLAG = 'migratedFromAccountSettings';

async function readGlobalPrefs(): Promise<GlobalPrefs> {
  const [language, themeMode, experienceMode] = await Promise.all([
    getGlobalSetting('language'),
    getGlobalSetting('theme'),
    getGlobalSetting('experienceMode'),
  ]);
  return {
    language: language === 'en' ? 'en' : GLOBAL_DEFAULTS.language,
    themeMode: themeMode === 'light' ? 'light' : GLOBAL_DEFAULTS.themeMode,
    experienceMode: experienceMode === 'pro' ? 'pro' : GLOBAL_DEFAULTS.experienceMode,
  };
}

/**
 * One-time upgrade path: installs that existed before multi-account support kept
 * language/theme/experience mode inside the (now per-account) settings table. The very
 * first time the app runs after upgrading, copy those values into the new global store so
 * returning users do not see their language/theme silently reset to the defaults.
 */
async function migrateGlobalPrefsIfNeeded(accountSettings: Record<string, string>) {
  const migrated = await getGlobalSetting(GLOBAL_MIGRATION_FLAG);
  if (migrated) return;

  await Promise.all([
    accountSettings.language ? setGlobalSetting('language', accountSettings.language === 'en' ? 'en' : 'fa') : Promise.resolve(),
    accountSettings.theme ? setGlobalSetting('theme', accountSettings.theme === 'light' ? 'light' : 'dark') : Promise.resolve(),
    accountSettings.experience_mode ? setGlobalSetting('experienceMode', accountSettings.experience_mode === 'pro' ? 'pro' : 'simple') : Promise.resolve(),
    setGlobalSetting(GLOBAL_MIGRATION_FLAG, '1'),
  ]);
}

type AppContextValue = {
  ready: boolean;
  language: Language;
  themeMode: ThemeMode;
  theme: AppTheme;
  isRTL: boolean;
  accountBalance: number;
  defaultRisk: number;
  currency: string;
  experienceMode: ExperienceMode;
  setLanguage: (language: Language) => Promise<void>;
  setThemeMode: (theme: ThemeMode) => Promise<void>;
  saveAccount: (settings: { accountBalance: number; defaultRisk: number; currency: string }) => Promise<void>;
  setExperienceMode: (mode: ExperienceMode) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  onboarded: boolean;
  refreshKey: number;
  refresh: () => void;
  // Multi-account trading profiles. Language/theme/experienceMode above stay global/shared;
  // everything below this line is about switching which trading profile is active.
  accounts: Account[];
  activeAccountId: string;
  switchAccount: (id: string) => Promise<void>;
  createAccount: (name: string) => Promise<Account>;
  renameAccount: (id: string, name: string) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [language, setLanguageState] = useState<Language>(GLOBAL_DEFAULTS.language);
  const [themeMode, setThemeModeState] = useState<ThemeMode>(GLOBAL_DEFAULTS.themeMode);
  const [accountBalance, setAccountBalance] = useState(0);
  const [defaultRisk, setDefaultRisk] = useState(1);
  const [currency, setCurrency] = useState('USD');
  const [experienceMode, setExperienceModeState] = useState<ExperienceMode>(GLOBAL_DEFAULTS.experienceMode);
  const [onboarded, setOnboarded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([{ id: DEFAULT_ACCOUNT_ID, name: 'حساب من', createdAt: new Date().toISOString() }]);
  const [activeAccountId, setActiveAccountIdState] = useState<string>(DEFAULT_ACCOUNT_ID);
  // Bumped whenever the active account changes, to re-run the load effect below.
  const [accountToken, setAccountToken] = useState(0);

  useEffect(() => {
    let active = true;
    setReady(false);

    (async () => {
      const [accountId, roster] = await Promise.all([getActiveAccountId(), listAccounts()]);
      // getSettings()/setSetting() below resolve against whichever account getActiveAccountId()
      // just reported, since the underlying getDb() self-resolves the same way.
      const accountSettings = await getSettings();
      await migrateGlobalPrefsIfNeeded(accountSettings);
      const globalPrefs = await readGlobalPrefs();

      if (!active) return;
      setAccounts(roster);
      setActiveAccountIdState(accountId);
      setLanguageState(globalPrefs.language);
      setThemeModeState(globalPrefs.themeMode);
      setExperienceModeState(globalPrefs.experienceMode);
      setAccountBalance(Number(accountSettings.account_balance ?? 0));
      setDefaultRisk(Number(accountSettings.default_risk_percent ?? 1));
      setCurrency(accountSettings.default_currency ?? 'USD');
      setOnboarded(accountSettings.onboarding_complete === '1');
      void i18n.changeLanguage(globalPrefs.language);
    })().catch((error) => {
      console.warn('Could not load app settings:', error);
    }).finally(() => {
      if (active) setReady(true);
    });

    return () => { active = false; };
  }, [accountToken]);

  const setLanguage = useCallback(async (lang: Language) => {
    await setGlobalSetting('language', lang);
    await i18n.changeLanguage(lang);
    setLanguageState(lang);
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    await setGlobalSetting('theme', mode);
    setThemeModeState(mode);
  }, []);

  const saveAccount = useCallback(async (settings: { accountBalance: number; defaultRisk: number; currency: string }) => {
    await Promise.all([
      setSetting('account_balance', String(settings.accountBalance)),
      setSetting('default_risk_percent', String(settings.defaultRisk)),
      setSetting('default_currency', settings.currency),
    ]);
    setAccountBalance(settings.accountBalance);
    setDefaultRisk(settings.defaultRisk);
    setCurrency(settings.currency);
  }, []);

  const setExperienceMode = useCallback(async (mode: ExperienceMode) => {
    await setGlobalSetting('experienceMode', mode);
    setExperienceModeState(mode);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await setSetting('onboarding_complete', '1');
    setOnboarded(true);
  }, []);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const switchAccount = useCallback(async (id: string) => {
    await setActiveAccountId(id);
    setActiveAccountIdState(id);
    // Reload per-account settings (balance/risk/currency/onboarded) for the new account...
    setAccountToken((token) => token + 1);
    // ...and let every trades/dashboard/analytics screen refetch through the existing hook.
    setRefreshKey((key) => key + 1);
  }, []);

  const createAccount = useCallback(async (name: string) => {
    const account = await createAccountRecord(name);
    setAccounts((prev) => [...prev, account]);
    await switchAccount(account.id);
    return account;
  }, [switchAccount]);

  const renameAccount = useCallback(async (id: string, name: string) => {
    await renameAccountRecord(id, name);
    setAccounts((prev) => prev.map((account) => (account.id === id ? { ...account, name: name.trim() } : account)));
  }, []);

  const deleteAccount = useCallback(async (id: string) => {
    await deleteAccountDatabase(id);
    const remaining = await removeAccountFromRoster(id);
    setAccounts(remaining);
    const nextActive = await getActiveAccountId();
    setActiveAccountIdState(nextActive);
    setAccountToken((token) => token + 1);
    setRefreshKey((key) => key + 1);
  }, []);

  const theme = useMemo(() => makeTheme(themeMode), [themeMode]);

  return <AppContext.Provider value={{
    ready,
    language,
    themeMode,
    theme,
    isRTL: language === 'fa',
    accountBalance,
    defaultRisk,
    currency,
    experienceMode,
    setLanguage,
    setThemeMode,
    saveAccount,
    setExperienceMode,
    completeOnboarding,
    onboarded,
    refreshKey,
    refresh,
    accounts,
    activeAccountId,
    switchAccount,
    createAccount,
    renameAccount,
    deleteAccount,
  }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
