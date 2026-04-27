export const COMMON_TIMEZONES: { label: string; value: string }[] = [
  { label: 'Hawaii (UTC−10)', value: 'Pacific/Honolulu' },
  { label: 'Alaska (UTC−9)', value: 'America/Anchorage' },
  { label: 'US Pacific (UTC−8)', value: 'America/Los_Angeles' },
  { label: 'US Mountain (UTC−7)', value: 'America/Denver' },
  { label: 'US Central (UTC−6)', value: 'America/Chicago' },
  { label: 'US Eastern (UTC−5)', value: 'America/New_York' },
  { label: 'Atlantic (UTC−4)', value: 'America/Halifax' },
  { label: 'São Paulo (UTC−3)', value: 'America/Sao_Paulo' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London (UTC+0/+1)', value: 'Europe/London' },
  { label: 'Paris / Berlin (UTC+1/+2)', value: 'Europe/Paris' },
  { label: 'Helsinki / Kyiv (UTC+2/+3)', value: 'Europe/Helsinki' },
  { label: 'Moscow (UTC+3)', value: 'Europe/Moscow' },
  { label: 'Dubai (UTC+4)', value: 'Asia/Dubai' },
  { label: 'Karachi (UTC+5)', value: 'Asia/Karachi' },
  { label: 'India (UTC+5:30)', value: 'Asia/Kolkata' },
  { label: 'Bangladesh (UTC+6)', value: 'Asia/Dhaka' },
  { label: 'Bangkok (UTC+7)', value: 'Asia/Bangkok' },
  { label: 'Singapore / KL (UTC+8)', value: 'Asia/Singapore' },
  { label: 'Tokyo / Seoul (UTC+9)', value: 'Asia/Tokyo' },
  { label: 'Sydney (UTC+10/+11)', value: 'Australia/Sydney' },
  { label: 'Auckland (UTC+12/+13)', value: 'Pacific/Auckland' },
];

/**
 * Returns the detected device timezone if it's in our supported list,
 * otherwise falls back to UTC.
 */
export function getDefaultTimezone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (COMMON_TIMEZONES.some(tz => tz.value === detected)) return detected;
  } catch {
    // Intl not available
  }
  return 'UTC';
}
