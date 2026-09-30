/**
 * Opt-in monthly email reminding a company to log last month's activity.
 *
 * Runs in the API process (see server/index.js). From REMINDER_DAY of each
 * month, users who opted in, have a company profile, and have nothing logged
 * for the previous month get one email; `lastReminderMonth` makes sure each
 * month is reminded at most once, even across restarts.
 */
import { activitiesRepo, profilesRepo, usersRepo } from '../db/repos.js';

export const REMINDER_DAY = 5;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 60 * 1000;

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** YYYY-MM of the month before `date` (UTC). */
export function previousMonthOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}

export const isEmailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && (process.env.REMINDER_FROM_EMAIL || process.env.RESET_FROM_EMAIL));

export async function sendReminderEmail({ to, name, month }) {
  const monthLabel = MONTH_LABEL.format(new Date(`${month}-01T00:00:00Z`));
  const appUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.REMINDER_FROM_EMAIL || process.env.RESET_FROM_EMAIL,
      to: [to],
      subject: `Log ${monthLabel} in CarbonCTRL`,
      text: [
        `Hi${name ? ` ${name}` : ''},`,
        '',
        `${monthLabel}'s bills should be in by now. Logging them takes a couple of minutes and keeps your footprint, grade and recommendations up to date:`,
        '',
        `${appUrl}/dashboard`,
        '',
        `You're receiving this because monthly reminders are on. Turn them off any time in Settings: ${appUrl}/settings`,
      ].join('\n'),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`);
  }
}

/** Send any reminders due at `now`. Returns the ids of users emailed. */
export async function runMonthlyReminders({ now = new Date(), send = sendReminderEmail } = {}) {
  if (now.getUTCDate() < REMINDER_DAY || !isEmailConfigured()) return [];

  const month = previousMonthOf(now);
  const sent = [];
  for (const user of usersRepo.findDueForReminder(month)) {
    if (!profilesRepo.findByUserId(user.id)) continue;
    const logged = activitiesRepo.findByUserId(user.id).some((a) => a.activityDate?.startsWith(month));
    if (logged) continue;

    try {
      await send({ to: user.email, name: user.name, month });
      usersRepo.update(user.id, { lastReminderMonth: month });
      sent.push(user.id);
    } catch (error) {
      // Leave lastReminderMonth unset so the next check tries again
      console.error(`Monthly reminder to user ${user.id} failed:`, error.message);
    }
  }
  return sent;
}

/** Start the periodic check; returns a function that stops it. */
export function startMonthlyReminders() {
  const check = () => runMonthlyReminders().catch((error) => console.error('Monthly reminder check failed:', error));
  const first = setTimeout(check, FIRST_CHECK_DELAY_MS);
  const interval = setInterval(check, CHECK_INTERVAL_MS);
  first.unref?.();
  interval.unref?.();
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}
