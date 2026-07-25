import 'fake-indexeddb/auto';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run() {
  let networkCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    networkCalls += 1;
    throw new Error('NETWORK_REQUEST_FORBIDDEN_IN_WEB_DB_TEST');
  }) as typeof fetch;

  const { closeWebDatabase, resetDatabase } = await import('@/db/database.web');
  const repositories = await import('@/db/repositories.web');

  try {
    await resetDatabase();

    const initialSettings = await repositories.getSettings();
    assert(initialSettings.language === 'fa', 'Default settings were not seeded.');
    assert((await repositories.getSymbols()).length > 0, 'Default symbols were not seeded.');
    assert((await repositories.getStrategies()).length > 0, 'Default strategies were not seeded.');
    assert((await repositories.getChecklist()).length > 0, 'Default checklist was not seeded.');

    await repositories.setSetting('account_balance', '12500');
    const symbolId = await repositories.createSymbol({
      market: 'forex',
      symbol: 'AUDNZD',
      pip_size: 0.0001,
      contract_size: 100000,
      quote_currency: 'NZD',
    });
    const strategyId = await repositories.createStrategy('Smoke Test');

    const tradeId = await repositories.createTrade({
      market: 'forex',
      symbol: 'AUDNZD',
      direction: 'BUY',
      entry_price: 1.08,
      stop_loss: 1.07,
      take_profit: 1.1,
      lot_size: 0.1,
      risk_percent: 1,
      account_balance: 12500,
      risk_amount: 125,
      pip_size: 0.0001,
      contract_size: 100000,
      pip_value_at_entry: 9.26,
      open_time: '2026-07-23T10:00:00.000Z',
      strategy: 'Smoke Test',
      checklist: { '1': 1 },
      images: [{ uri: 'data:image/png;base64,dHJhZGVsb2c=', type: 'entry' }],
    });

    const openTrade = await repositories.getTrade(tradeId);
    assert(openTrade?.status === 'OPEN', 'Created trade was not readable.');

    await repositories.closeTrade(openTrade, {
      exit_price: 1.09,
      close_time: '2026-07-23T11:00:00.000Z',
      commission: 2,
      swap_fee: 0,
      funding_fee: 0,
      lesson_learned: 'Persistence smoke test',
    });

    await closeWebDatabase();

    const persistedSettings = await repositories.getSettings();
    const persistedTrade = await repositories.getTrade(tradeId);
    const persistedImages = await repositories.getTradeImages(tradeId);
    assert(persistedSettings.account_balance === '12500', 'Settings did not survive reopening IndexedDB.');
    assert(persistedTrade?.status === 'CLOSED', 'Trade did not survive reopening IndexedDB.');
    assert(persistedImages.length === 1, 'Image metadata did not survive reopening IndexedDB.');

    const summary = await repositories.getDashboardSummary();
    assert(summary.trades === 1, 'Dashboard summary did not include the closed trade.');

    await repositories.deleteTradeImage(persistedImages[0].id);
    await repositories.deleteTrade(tradeId);
    await repositories.deleteStrategy(strategyId);
    await repositories.deleteCustomSymbol(symbolId);
    assert((await repositories.listTrades()).length === 0, 'Trade delete did not complete.');

    await repositories.setSetting('language', 'en');
    await resetDatabase();

    const resetSettings = await repositories.getSettings();
    assert(resetSettings.language === 'fa', 'Reset did not restore default settings.');
    assert((await repositories.listTrades()).length === 0, 'Reset did not clear trades.');
    assert(
      !(await repositories.getManagedSymbols()).some((symbol) => symbol.symbol === 'AUDNZD'),
      'Reset did not clear custom symbols.',
    );
    assert(networkCalls === 0, 'The local database layer attempted a network request.');

    console.log('web-db-smoke: PASS');
  } finally {
    globalThis.fetch = originalFetch;
    await closeWebDatabase();
  }
}

run().catch((error) => {
  console.error('web-db-smoke: FAIL');
  console.error(error);
  process.exitCode = 1;
});
