const ENABLED_KEY = 'tradelog:web-notifications-enabled';
const HOUR_KEY = 'tradelog:web-notification-hour';
const MINUTE_KEY = 'tradelog:web-notification-minute';
const INACTIVITY_KEY = 'tradelog:web-inactivity-last-shown';

let reminderTimer: ReturnType<typeof setTimeout> | null = null;

function supported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function clearReminderTimer() {
  if (reminderTimer) clearTimeout(reminderTimer);
  reminderTimer = null;
}

function show(title: string, body: string) {
  if (!supported() || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, { body, icon: '/favicon.ico', tag: 'tradelog-reminder' });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.warn('Could not display web notification:', error);
  }
}

function millisecondsUntil(hour: number, minute: number) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return Math.max(1000, next.getTime() - now.getTime());
}

function scheduleNext(hour: number, minute: number) {
  clearReminderTimer();
  reminderTimer = setTimeout(() => {
    show('TradeLog', 'وقت ثبت و مرور ژورنال معاملاتی امروز است.');
    scheduleNext(hour, minute);
  }, millisecondsUntil(hour, minute));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!supported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  if (!supported()) return;
  localStorage.setItem(ENABLED_KEY, '1');
  localStorage.setItem(HOUR_KEY, String(hour));
  localStorage.setItem(MINUTE_KEY, String(minute));
  scheduleNext(hour, minute);
}

export async function checkInactivityAndNotify(lastTradeDateISO: string | null): Promise<void> {
  if (!supported() || Notification.permission !== 'granted' || !lastTradeDateISO) return;
  const age = Date.now() - new Date(lastTradeDateISO).getTime();
  if (!Number.isFinite(age) || age < 3 * 86400000) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(INACTIVITY_KEY) === today) return;
  show('TradeLog', 'چند روز است تریدی در ژورنال ثبت نشده؛ مرور کوتاه امروز را فراموش نکن.');
  localStorage.setItem(INACTIVITY_KEY, today);
}

export async function scheduleWeeklySummary(winRate: number, pnl: number, currency: string, lang: string): Promise<void> {
  if (!supported() || Notification.permission !== 'granted') return;
  const body = lang === 'fa'
    ? `خلاصه هفته: نرخ برد ${Math.round(winRate)}٪ و نتیجه ${Math.round(pnl).toLocaleString('fa-IR')} ${currency}`
    : `Weekly summary: ${Math.round(winRate)}% win rate and ${Math.round(pnl).toLocaleString()} ${currency}`;
  show('TradeLog', body);
}

export async function cancelAllNotifications(): Promise<void> {
  clearReminderTimer();
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(ENABLED_KEY);
    localStorage.removeItem(HOUR_KEY);
    localStorage.removeItem(MINUTE_KEY);
  }
}
