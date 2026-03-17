const { DateTime } = require('luxon');

/**
 * Returns an array of up to 8 full-hour DateTime objects starting from
 * the next full hour after now (in UTC).
 */
function getUpcomingHours() {
  const now = DateTime.utc();
  const nextHour = now.startOf('hour').plus({ hours: 1 });
  const hours = [];
  for (let i = 0; i < 8; i++) {
    hours.push(nextHour.plus({ hours: i }));
  }
  return hours;
}

/**
 * Formats a UTC ISO string to HH:mm in the given IANA timezone.
 */
function formatInZone(isoString, timezone) {
  return DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm');
}

/**
 * Formats a UTC ISO string to "HH:mm (zona)" e.g. "18:00 (Europe/Madrid)"
 */
function formatWithZoneLabel(isoString, timezone) {
  const dt = DateTime.fromISO(isoString, { zone: 'utc' }).setZone(timezone);
  return `${dt.toFormat('HH:mm')} (${dt.toFormat('ZZZZ')})`;
}

/**
 * Returns true if the given UTC ISO string is in the past.
 */
function isExpired(isoString) {
  return DateTime.fromISO(isoString, { zone: 'utc' }) <= DateTime.utc();
}

/**
 * Converts a UTC full-hour ISO string to a short label like "18:00"
 * using the given timezone, for button labels.
 */
function hourLabel(utcIso, timezone) {
  return DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(timezone).toFormat('HH:mm');
}

module.exports = { getUpcomingHours, formatInZone, formatWithZoneLabel, isExpired, hourLabel };
