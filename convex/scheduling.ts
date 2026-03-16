export const SLOT_INTERVAL_MINUTES = 15;
const MINUTES_PER_DAY = 24 * 60;

const weekdayMap: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

const zonedDateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getZonedFormatter(timezone: string) {
  const existing = zonedDateFormatterCache.get(timezone);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  zonedDateFormatterCache.set(timezone, formatter);
  return formatter;
}

export function parseTimeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getZonedDateParts(timestamp: number, timezone: string): ZonedDateParts {
  const parts = getZonedFormatter(timezone).formatToParts(new Date(timestamp));
  const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(valueByType.year),
    month: Number(valueByType.month),
    day: Number(valueByType.day),
    hour: Number(valueByType.hour),
    minute: Number(valueByType.minute),
    weekday: weekdayMap[valueByType.weekday] ?? 0,
  };
}

export function localDateTimeToUtcTimestamp(
  timezone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getZonedDateParts(guess, timezone);
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0,
      0,
    );
    const delta = desiredAsUtc - actualAsUtc;
    if (delta === 0) {
      return guess;
    }
    guess += delta;
  }

  return guess;
}

export function addDaysToLocalDate(
  year: number,
  month: number,
  day: number,
  daysToAdd: number,
) {
  const date = new Date(Date.UTC(year, month - 1, day + daysToAdd));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function getStartOfLocalDayTimestamp(timestamp: number, timezone: string) {
  const local = getZonedDateParts(timestamp, timezone);
  return localDateTimeToUtcTimestamp(
    timezone,
    local.year,
    local.month,
    local.day,
    0,
    0,
  );
}

export function getEndOfLocalDayTimestamp(timestamp: number, timezone: string) {
  return getStartOfLocalDayTimestamp(timestamp, timezone) + MINUTES_PER_DAY * 60_000;
}

export function overlaps(
  rangeA: { startsAt: number; endsAt: number },
  rangeB: { startsAt: number; endsAt: number },
) {
  return rangeA.startsAt < rangeB.endsAt && rangeA.endsAt > rangeB.startsAt;
}

export function haversineDistanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(latitudeB - latitudeA);
  const lonDelta = toRadians(longitudeB - longitudeA);
  const lat1 = toRadians(latitudeA);
  const lat2 = toRadians(latitudeB);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
