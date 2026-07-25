import { DEFAULT_SYMBOLS } from '@/constants/defaults';
import { Direction, ImportedTradeInput, Market } from '@/types';

export type MetaTraderPlatform = 'MT4' | 'MT5' | 'MetaTrader';
export type MetaTraderReportFormat = 'csv' | 'html' | 'text';

export interface ParsedMetaTraderReport {
  platform: MetaTraderPlatform;
  format: MetaTraderReportFormat;
  trades: ImportedTradeInput[];
  warnings: string[];
  rejectedRows: number;
}

type Table = string[][];
type RowMap = Record<string, number[]>;

type DealRow = {
  position: string;
  symbol: string;
  type: Direction;
  direction: string;
  time: string;
  volume: number;
  price: number;
  commission: number;
  swap: number;
  profit: number;
  comment: string;
};

const normalizeSpace = (value: unknown) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const normalizeHeader = (value: unknown) => normalizeSpace(value)
  .toLowerCase()
  .replace(/[\/\\_-]+/g, ' ')
  .replace(/[^a-z0-9\u0600-\u06ff ]+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const headerAliases: Record<string, string[]> = {
  ticket: ['ticket', 'order', 'deal', 'position', 'شماره', 'تیکت'],
  position: ['position', 'position id', 'پوزیشن'],
  time: ['time', 'open time', 'close time', 'date', 'زمان', 'تاریخ'],
  openTime: ['open time', 'time open', 'زمان باز شدن', 'زمان ورود'],
  closeTime: ['close time', 'time close', 'زمان بسته شدن', 'زمان خروج'],
  type: ['type', 'side', 'action', 'نوع'],
  direction: ['direction', 'entry', 'entry type', 'جهت ورود'],
  volume: ['volume', 'size', 'lots', 'lot', 'حجم'],
  symbol: ['symbol', 'item', 'instrument', 'market', 'نماد'],
  price: ['price', 'open price', 'close price', 'قیمت'],
  openPrice: ['open price', 'price open', 'قیمت ورود'],
  closePrice: ['close price', 'price close', 'قیمت خروج'],
  sl: ['s l', 'sl', 'stop loss', 'stoploss', 'حد ضرر'],
  tp: ['t p', 'tp', 'take profit', 'takeprofit', 'حد سود'],
  commission: ['commission', 'comm', 'کمیسیون'],
  fee: ['fee', 'fees', 'کارمزد'],
  swap: ['swap', 'swap fee', 'سواپ'],
  profit: ['profit', 'p l', 'pnl', 'net profit', 'سود'],
  comment: ['comment', 'strategy', 'magic', 'نظر', 'استراتژی'],
};

function matchesAlias(header: string, aliases: string[]) {
  return aliases.some((alias) => header === alias || header.startsWith(`${alias} `) || header.endsWith(` ${alias}`));
}

function indexHeaders(headers: string[]): RowMap {
  const result: RowMap = {};
  const normalized = headers.map(normalizeHeader);
  for (const [key, aliases] of Object.entries(headerAliases)) {
    result[key] = [];
    normalized.forEach((header, index) => {
      if (matchesAlias(header, aliases)) result[key].push(index);
    });
  }
  return result;
}

function cell(row: string[], index: number | undefined) {
  return index == null || index < 0 ? '' : normalizeSpace(row[index]);
}

function firstIndex(map: RowMap, key: string) {
  return map[key]?.[0];
}

function parseNumber(value: unknown): number {
  let text = normalizeSpace(value)
    .replace(/[−–—]/g, '-')
    .replace(/[\u200e\u200f]/g, '')
    .replace(/[^0-9,.'()\-+]/g, '');
  if (!text) return 0;
  let negative = false;
  if (text.startsWith('(') && text.endsWith(')')) {
    negative = true;
    text = text.slice(1, -1);
  }
  text = text.replace(/'/g, '');
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    const thousands = decimal === ',' ? /\./g : /,/g;
    text = text.replace(thousands, '').replace(decimal, '.');
  } else if (comma >= 0) {
    const decimals = text.length - comma - 1;
    text = decimals > 0 && decimals <= 6 ? text.replace(',', '.') : text.replace(/,/g, '');
  } else if ((text.match(/\./g) ?? []).length > 1) {
    const last = text.lastIndexOf('.');
    text = `${text.slice(0, last).replace(/\./g, '')}${text.slice(last)}`;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? (negative ? -Math.abs(parsed) : parsed) : 0;
}

function parseMetaTraderDate(value: unknown): string | null {
  const raw = normalizeSpace(value);
  if (!raw || raw === '0' || raw === '-') return null;
  const match = raw.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})(?:\s+|T)(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const [, y, m, d, hh, mm, ss = '00'] = match;
    const local = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
    return Number.isNaN(local.getTime()) ? null : local.toISOString();
  }
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function normalizeDirection(value: unknown): Direction | null {
  const type = normalizeHeader(value);
  if (/limit|stop|cancel|balance|credit|deposit|withdraw/.test(type)) return null;
  if (/\bbuy\b|خرید/.test(type)) return 'BUY';
  if (/\bsell\b|فروش/.test(type)) return 'SELL';
  return null;
}

function canonicalSymbolKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function resolveSymbol(rawValue: string, referencePrice: number) {
  const raw = normalizeSpace(rawValue).toUpperCase();
  const rawKey = canonicalSymbolKey(raw);
  const defaultMatch = DEFAULT_SYMBOLS.find((symbol) => {
    const key = canonicalSymbolKey(symbol.symbol);
    return rawKey === key || rawKey.startsWith(key) || rawKey.endsWith(key);
  });
  if (defaultMatch) return { ...defaultMatch, symbol: defaultMatch.symbol };

  const cryptoBase = ['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'BNB', 'LTC', 'AVAX', 'DOT', 'TRX', 'LINK'];
  const isCrypto = cryptoBase.some((token) => rawKey.startsWith(token)) && /(USDT|USDC|BTC|ETH|USD)$/.test(rawKey);
  const market: Market = isCrypto ? 'crypto' : 'forex';
  const symbol = raw.replace(/[^A-Z0-9/._-]/g, '') || rawKey;
  const quoteCurrency = rawKey.endsWith('USDT') ? 'USDT'
    : rawKey.endsWith('USDC') ? 'USDC'
      : rawKey.endsWith('JPY') ? 'JPY'
        : rawKey.slice(-3) || 'USD';

  let pipSize = 0.0001;
  let contractSize = 100000;
  if (market === 'crypto') {
    contractSize = 1;
    pipSize = rawKey.startsWith('BTC') ? 1 : rawKey.startsWith('XRP') ? 0.0001 : 0.01;
  } else if (rawKey.includes('XAU') || rawKey.includes('XAG')) {
    pipSize = 0.01;
    contractSize = rawKey.includes('XAU') ? 100 : 5000;
  } else if (rawKey.endsWith('JPY')) {
    pipSize = 0.01;
  } else if (/NAS|US30|DJ|SPX|GER|DAX|UK100|USTEC/.test(rawKey)) {
    pipSize = 1;
    contractSize = 1;
  } else if (referencePrice >= 1000) {
    pipSize = 1;
    contractSize = 1;
  }

  return { market, symbol, pip_size: pipSize, contract_size: contractSize, quote_currency: quoteCurrency, active: 1 };
}

function calculatePips(direction: Direction, entry: number, exit: number | null, pipSize: number) {
  if (!exit || !pipSize) return null;
  return (direction === 'BUY' ? exit - entry : entry - exit) / pipSize;
}

function parseCsv(text: string): Table {
  const source = text.replace(/^\uFEFF/, '');
  const sampleLines = source.split(/\r?\n/).filter((line) => line.trim()).slice(0, 12);
  const candidates = [',', ';', '\t'];
  const delimiter = candidates
    .map((candidate) => ({ candidate, score: sampleLines.reduce((sum, line) => sum + countDelimiter(line, candidate), 0) }))
    .sort((a, b) => b.score - a.score)[0]?.candidate ?? ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(value);
      if (row.some((item) => normalizeSpace(item))) rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  row.push(value);
  if (row.some((item) => normalizeSpace(item))) rows.push(row);
  return rows;
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === delimiter && !quoted) count += 1;
  }
  return count;
}

function decodeHtml(value: string) {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
      if (entity.startsWith('#x')) return String.fromCodePoint(parseInt(entity.slice(2), 16));
      if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(1), 10));
      return entities[entity.toLowerCase()] ?? `&${entity};`;
    });
}

function parseHtml(text: string): Table {
  const rows: string[][] = [];
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(text))) {
    const cells: string[] = [];
    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRegex.exec(rowMatch[1]))) cells.push(normalizeSpace(decodeHtml(cellMatch[1])));
    if (cells.some(Boolean)) rows.push(cells);
  }
  return rows;
}

function headerScore(row: string[]) {
  const normalized = row.map(normalizeHeader);
  let score = 0;
  if (normalized.some((item) => matchesAlias(item, headerAliases.type))) score += 3;
  if (normalized.some((item) => matchesAlias(item, headerAliases.symbol))) score += 3;
  if (normalized.some((item) => matchesAlias(item, headerAliases.price))) score += 2;
  if (normalized.some((item) => matchesAlias(item, headerAliases.profit))) score += 2;
  if (normalized.some((item) => matchesAlias(item, headerAliases.volume))) score += 1;
  if (normalized.some((item) => matchesAlias(item, headerAliases.time))) score += 1;
  return score;
}

function findHeader(table: Table) {
  let bestIndex = -1;
  let bestScore = 0;
  table.slice(0, 50).forEach((row, index) => {
    const score = headerScore(row);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 7 ? bestIndex : -1;
}

function inferPlatform(text: string, headers: string[]): MetaTraderPlatform {
  const haystack = `${text.slice(0, 5000)} ${headers.join(' ')}`.toLowerCase();
  if (/metatrader\s*5|mt5|position|deal/.test(haystack)) return 'MT5';
  if (/metatrader\s*4|mt4|ticket|item/.test(haystack)) return 'MT4';
  return 'MetaTrader';
}

function parsePositionRows(table: Table, headerIndex: number, map: RowMap) {
  const trades: ImportedTradeInput[] = [];
  let rejectedRows = 0;
  const timeIndexes = map.time ?? [];
  const priceIndexes = map.price ?? [];
  const openTimeIndex = firstIndex(map, 'openTime') ?? timeIndexes[0];
  const closeTimeIndex = firstIndex(map, 'closeTime') ?? timeIndexes.find((index) => index !== openTimeIndex);
  const openPriceIndex = firstIndex(map, 'openPrice') ?? priceIndexes[0];
  const closePriceIndex = firstIndex(map, 'closePrice') ?? priceIndexes.find((index) => index !== openPriceIndex);
  const typeIndex = firstIndex(map, 'type');
  const symbolIndex = firstIndex(map, 'symbol');
  const volumeIndex = firstIndex(map, 'volume');
  const profitIndex = firstIndex(map, 'profit');
  const commissionIndex = firstIndex(map, 'commission');
  const feeIndex = firstIndex(map, 'fee');
  const swapIndex = firstIndex(map, 'swap');
  const slIndex = firstIndex(map, 'sl');
  const tpIndex = firstIndex(map, 'tp');
  const commentIndex = firstIndex(map, 'comment');
  const ticketIndex = firstIndex(map, 'ticket');

  for (const row of table.slice(headerIndex + 1)) {
    const direction = normalizeDirection(cell(row, typeIndex));
    const symbolCell = cell(row, symbolIndex);
    const entry = parseNumber(cell(row, openPriceIndex));
    const openTime = parseMetaTraderDate(cell(row, openTimeIndex));
    if (!direction || !symbolCell || !entry || !openTime) continue;

    const exit = parseNumber(cell(row, closePriceIndex)) || null;
    const closeTime = parseMetaTraderDate(cell(row, closeTimeIndex));
    const symbolSpec = resolveSymbol(symbolCell, entry);
    const volume = Math.abs(parseNumber(cell(row, volumeIndex)));
    const commission = parseNumber(cell(row, commissionIndex)) + parseNumber(cell(row, feeIndex));
    const swap = parseNumber(cell(row, swapIndex));
    const profit = parseNumber(cell(row, profitIndex));
    const status = closeTime && exit ? 'CLOSED' as const : 'OPEN' as const;
    const net = status === 'CLOSED' ? profit + commission + swap : null;
    const setupNotes = [
      cell(row, commentIndex),
      cell(row, ticketIndex) ? `MetaTrader #${cell(row, ticketIndex)}` : '',
    ].filter(Boolean).join(' · ');

    if (!Number.isFinite(entry) || entry <= 0) {
      rejectedRows += 1;
      continue;
    }

    trades.push({
      market: symbolSpec.market,
      symbol: symbolSpec.symbol,
      direction,
      status,
      entry_price: entry,
      exit_price: exit,
      stop_loss: parseNumber(cell(row, slIndex)) || null,
      take_profit: parseNumber(cell(row, tpIndex)) || null,
      lot_size: symbolSpec.market === 'forex' ? volume || null : null,
      quantity: symbolSpec.market === 'crypto' ? volume || null : null,
      risk_percent: null,
      account_balance: null,
      risk_amount: null,
      pip_size: symbolSpec.pip_size,
      contract_size: symbolSpec.contract_size,
      commission,
      swap_fee: swap,
      funding_fee: 0,
      pnl_gross: status === 'CLOSED' ? profit : null,
      pnl_net: net,
      pnl_pips: status === 'CLOSED' ? calculatePips(direction, entry, exit, symbolSpec.pip_size) : null,
      rr_ratio: null,
      open_time: openTime,
      close_time: closeTime,
      strategy: null,
      setup_notes: setupNotes || 'Imported from MetaTrader',
      checklist: {},
      source_id: cell(row, ticketIndex) || null,
    });
  }
  return { trades, rejectedRows };
}

function parseDealRows(table: Table, headerIndex: number, map: RowMap) {
  const rows: DealRow[] = [];
  const typeIndex = firstIndex(map, 'type');
  const directionIndex = firstIndex(map, 'direction');
  const positionIndex = firstIndex(map, 'position') ?? firstIndex(map, 'ticket');
  const symbolIndex = firstIndex(map, 'symbol');
  const volumeIndex = firstIndex(map, 'volume');
  const timeIndex = firstIndex(map, 'time');
  const priceIndex = firstIndex(map, 'price');
  const commissionIndex = firstIndex(map, 'commission');
  const feeIndex = firstIndex(map, 'fee');
  const swapIndex = firstIndex(map, 'swap');
  const profitIndex = firstIndex(map, 'profit');
  const commentIndex = firstIndex(map, 'comment');

  for (const row of table.slice(headerIndex + 1)) {
    const type = normalizeDirection(cell(row, typeIndex));
    const position = cell(row, positionIndex);
    const symbol = cell(row, symbolIndex);
    const time = parseMetaTraderDate(cell(row, timeIndex));
    const price = parseNumber(cell(row, priceIndex));
    if (!type || !position || !symbol || !time || !price) continue;
    rows.push({
      position,
      symbol,
      type,
      direction: normalizeHeader(cell(row, directionIndex)),
      time,
      volume: Math.abs(parseNumber(cell(row, volumeIndex))),
      price,
      commission: parseNumber(cell(row, commissionIndex)) + parseNumber(cell(row, feeIndex)),
      swap: parseNumber(cell(row, swapIndex)),
      profit: parseNumber(cell(row, profitIndex)),
      comment: cell(row, commentIndex),
    });
  }

  const groups = new Map<string, DealRow[]>();
  rows.forEach((row) => groups.set(row.position, [...(groups.get(row.position) ?? []), row]));
  const trades: ImportedTradeInput[] = [];
  let rejectedRows = 0;

  for (const [position, deals] of groups) {
    deals.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const entries = deals.filter((deal) => /(^| )in($| )/.test(deal.direction) && !/out/.test(deal.direction));
    const exits = deals.filter((deal) => /out/.test(deal.direction));
    const entryDeals = entries.length ? entries : deals.slice(0, 1);
    const exitDeals = exits.length ? exits : deals.slice(1);
    const totalEntryVolume = entryDeals.reduce((sum, deal) => sum + (deal.volume || 1), 0);
    const totalExitVolume = exitDeals.reduce((sum, deal) => sum + (deal.volume || 1), 0);
    const entry = entryDeals.reduce((sum, deal) => sum + deal.price * (deal.volume || 1), 0) / Math.max(totalEntryVolume, Number.EPSILON);
    const exit = exitDeals.length
      ? exitDeals.reduce((sum, deal) => sum + deal.price * (deal.volume || 1), 0) / Math.max(totalExitVolume, Number.EPSILON)
      : null;
    const direction = entryDeals[0]?.type;
    if (!direction || !entry || !entryDeals[0]) {
      rejectedRows += deals.length;
      continue;
    }
    const symbolSpec = resolveSymbol(entryDeals[0].symbol, entry);
    const status = exit ? 'CLOSED' as const : 'OPEN' as const;
    const commission = deals.reduce((sum, deal) => sum + deal.commission, 0);
    const swap = deals.reduce((sum, deal) => sum + deal.swap, 0);
    const gross = deals.reduce((sum, deal) => sum + deal.profit, 0);
    const comments = [...new Set(deals.map((deal) => deal.comment).filter(Boolean))];

    trades.push({
      market: symbolSpec.market,
      symbol: symbolSpec.symbol,
      direction,
      status,
      entry_price: entry,
      exit_price: exit,
      stop_loss: null,
      take_profit: null,
      lot_size: symbolSpec.market === 'forex' ? totalEntryVolume || null : null,
      quantity: symbolSpec.market === 'crypto' ? totalEntryVolume || null : null,
      risk_percent: null,
      account_balance: null,
      risk_amount: null,
      pip_size: symbolSpec.pip_size,
      contract_size: symbolSpec.contract_size,
      commission,
      swap_fee: swap,
      funding_fee: 0,
      pnl_gross: status === 'CLOSED' ? gross : null,
      pnl_net: status === 'CLOSED' ? gross + commission + swap : null,
      pnl_pips: status === 'CLOSED' ? calculatePips(direction, entry, exit, symbolSpec.pip_size) : null,
      rr_ratio: null,
      open_time: entryDeals[0].time,
      close_time: exitDeals.at(-1)?.time ?? null,
      strategy: null,
      setup_notes: [...comments, `MetaTrader position #${position}`].join(' · '),
      checklist: {},
      source_id: position,
    });
  }
  return { trades, rejectedRows };
}

export function parseMetaTraderReport(text: string, fileName = ''): ParsedMetaTraderReport {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('EMPTY_REPORT');
  const looksHtml = /<html|<table|<tr\b/i.test(trimmed) || /\.html?$/i.test(fileName);
  const format: MetaTraderReportFormat = looksHtml ? 'html' : /\.csv$/i.test(fileName) ? 'csv' : 'text';
  const table = looksHtml ? parseHtml(trimmed) : parseCsv(trimmed);
  if (!table.length) throw new Error('REPORT_HAS_NO_ROWS');
  const headerIndex = findHeader(table);
  if (headerIndex < 0) throw new Error('UNSUPPORTED_METATRADER_COLUMNS');
  const headers = table[headerIndex].map(normalizeSpace);
  const map = indexHeaders(headers);
  const hasDealDirection = (map.direction?.length ?? 0) > 0 && (map.position?.length ?? 0) > 0;
  const parsed = hasDealDirection ? parseDealRows(table, headerIndex, map) : parsePositionRows(table, headerIndex, map);
  if (!parsed.trades.length) throw new Error('NO_TRADES_DETECTED');

  const warnings: string[] = [];
  if (parsed.rejectedRows) warnings.push(`${parsed.rejectedRows} row(s) could not be converted.`);
  const openCount = parsed.trades.filter((trade) => trade.status === 'OPEN').length;
  if (openCount) warnings.push(`${openCount} open position(s) were detected without a closing price.`);
  const unknownRisk = parsed.trades.filter((trade) => trade.risk_percent == null).length;
  if (unknownRisk) warnings.push('MetaTrader reports do not include original account risk %, so imported risk fields are left empty.');

  return {
    platform: inferPlatform(trimmed, headers),
    format,
    trades: parsed.trades.sort((a, b) => new Date(b.open_time).getTime() - new Date(a.open_time).getTime()),
    warnings,
    rejectedRows: parsed.rejectedRows,
  };
}
