import 'fake-indexeddb/auto';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Verifies the multi-account data isolation layer on the web platform:
 * - the very first (default) account keeps using the ORIGINAL unsuffixed database, so
 *   upgrading single-account installs never lose data;
 * - trading data (settings/balance, trades) is fully isolated between accounts;
 * - global preferences (language/theme/experience mode) are shared across all accounts;
 * - deleting an account removes its database and its roster entry without touching others.
 */
async function run() {
  const accountsModule = await import('@/services/accounts.web');
  const { closeWebDatabase, deleteAccountDatabase, resetDatabase } = await import('@/db/database.web');
  const repositories = await import('@/db/repositories.web');

  try {
    await resetDatabase();

    const initialRoster = await accountsModule.listAccounts();
    assert(initialRoster.length === 1, 'A fresh install should start with exactly one account.');
    assert(initialRoster[0].id === accountsModule.DEFAULT_ACCOUNT_ID, 'The first account must be the reserved default account id.');
    assert((await accountsModule.getActiveAccountId()) === accountsModule.DEFAULT_ACCOUNT_ID, 'The default account should be active on a fresh install.');

    // Put some data on the default account.
    await repositories.setSetting('account_balance', '1000');
    const defaultTradeId = await repositories.createTrade({
      market: 'forex',
      symbol: 'EURUSD',
      direction: 'BUY',
      entry_price: 1.1,
      stop_loss: 1.09,
      take_profit: 1.12,
      lot_size: 0.1,
      risk_percent: 1,
      account_balance: 1000,
      risk_amount: 10,
      pip_size: 0.0001,
      contract_size: 100000,
      pip_value_at_entry: 10,
      open_time: '2026-07-24T09:00:00.000Z',
      strategy: 'Default account trade',
      checklist: {},
      images: [],
    });

    // Shared/global preference, set while the default account is active.
    await accountsModule.setGlobalSetting('language', 'en');

    // Create and switch to a second, independent account.
    const secondAccount = await accountsModule.createAccount('Second Account');
    await accountsModule.setActiveAccountId(secondAccount.id);
    assert((await accountsModule.listAccounts()).length === 2, 'Creating an account should add it to the roster.');

    const secondSettings = await repositories.getSettings();
    assert(secondSettings.account_balance === '0', 'A brand-new account must not see the previous account\'s balance.');
    const secondTrades = await repositories.listTrades();
    assert(secondTrades.length === 0, 'A brand-new account must not see the previous account\'s trades.');
    assert((await accountsModule.getGlobalSetting('language')) === 'en', 'Language must stay shared/global across accounts.');

    // Give the second account its own data, then switch back to the default account.
    await repositories.setSetting('account_balance', '5000');
    await accountsModule.setActiveAccountId(accountsModule.DEFAULT_ACCOUNT_ID);

    const defaultSettingsAgain = await repositories.getSettings();
    assert(defaultSettingsAgain.account_balance === '1000', 'Switching back to the default account must restore its own balance.');
    const defaultTradeAgain = await repositories.getTrade(defaultTradeId);
    assert(defaultTradeAgain?.symbol === 'EURUSD', 'Switching back to the default account must restore its own trades.');

    // Delete the second account and confirm it disappears cleanly without touching the default account.
    await deleteAccountDatabase(secondAccount.id);
    const rosterAfterDelete = await accountsModule.removeAccountFromRoster(secondAccount.id);
    assert(rosterAfterDelete.length === 1, 'Deleting the second account should leave exactly the default account.');
    assert(rosterAfterDelete[0].id === accountsModule.DEFAULT_ACCOUNT_ID, 'The remaining account after deletion must be the default account.');

    const defaultSettingsFinal = await repositories.getSettings();
    assert(defaultSettingsFinal.account_balance === '1000', 'Deleting the second account must not affect the default account\'s data.');

    console.log('accounts-web-smoke: PASS');
  } finally {
    await closeWebDatabase();
  }
}

run().catch((error) => {
  console.error('accounts-web-smoke: FAIL');
  console.error(error);
  process.exitCode = 1;
});
