export type TimezoneOption = {
  id: string;
  label: string;
  offset: string;
};

import { getCalendars } from "expo-localization";

// Curated list of common IANA timezone identifiers. The offset label is
// static/approximate (DST zones show their standard offset) and is only a
// hint for the settings picker; actual boundary math uses the IANA id.
const ZONES: [string, string][] = [
  ["Pacific/Kiritimati", "+14:00"],
  ["Pacific/Auckland", "+12:00"],
  ["Asia/Tokyo", "+09:00"],
  ["Asia/Seoul", "+09:00"],
  ["Asia/Shanghai", "+08:00"],
  ["Asia/Hong_Kong", "+08:00"],
  ["Asia/Singapore", "+08:00"],
  ["Asia/Manila", "+08:00"],
  ["Asia/Jakarta", "+07:00"],
  ["Asia/Bangkok", "+07:00"],
  ["Asia/Ho_Chi_Minh", "+07:00"],
  ["Asia/Kolkata", "+05:30"],
  ["Asia/Karachi", "+05:00"],
  ["Asia/Dubai", "+04:00"],
  ["Asia/Riyadh", "+03:00"],
  ["Europe/Moscow", "+03:00"],
  ["Europe/Athens", "+02:00"],
  ["Europe/Bucharest", "+02:00"],
  ["Europe/Istanbul", "+03:00"],
  ["Europe/Berlin", "+01:00"],
  ["Europe/Paris", "+01:00"],
  ["Europe/Amsterdam", "+01:00"],
  ["Europe/Madrid", "+01:00"],
  ["Europe/Rome", "+01:00"],
  ["Europe/London", "+00:00"],
  ["Europe/Lisbon", "+00:00"],
  ["UTC", "+00:00"],
  ["America/Sao_Paulo", "-03:00"],
  ["America/Buenos_Aires", "-03:00"],
  ["America/Santiago", "-03:00"],
  ["America/Bogota", "-05:00"],
  ["America/Lima", "-05:00"],
  ["America/Panama", "-05:00"],
  ["America/New_York", "-05:00"],
  ["America/Toronto", "-05:00"],
  ["America/Mexico_City", "-06:00"],
  ["America/Chicago", "-06:00"],
  ["America/Denver", "-07:00"],
  ["America/Phoenix", "-07:00"],
  ["America/Los_Angeles", "-08:00"],
  ["America/Vancouver", "-08:00"],
  ["America/Anchorage", "-09:00"],
  ["Pacific/Honolulu", "-10:00"],
];

function labelFor(id: string): string {
  return id.replace(/_/g, " ");
}

// Sentinal option id representing "follow the device timezone".
export const DEVICE_TIMEZONE_ID = "__device__";

export const TIMEZONE_OPTIONS: TimezoneOption[] = ZONES.map(([id, offset]) => ({
  id,
  label: `${labelFor(id)} (UTC${offset})`,
  offset,
}));

// Options list for the settings picker: "match device" first, then manual zones.
export function timezonePickerOptions(): { id: string; label: string }[] {
  const device = getCalendars()[0]?.timeZone;
  return [
    {
      id: DEVICE_TIMEZONE_ID,
      label: device
        ? `Match device (${device.replace(/_/g, " ")})`
        : "Match device (UTC)",
    },
    ...TIMEZONE_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
  ];
}

// The effective stored value to show as selected in the picker.
export function timezonePickerValue(stored: string | undefined): string {
  const device = getCalendars()[0]?.timeZone ?? "UTC";
  if (!stored || stored === device) return DEVICE_TIMEZONE_ID;
  return stored;
}

export function formatTimezoneLabel(id: string | undefined): string {
  const match = TIMEZONE_OPTIONS.find((o) => o.id === id);
  if (match) return match.label;
  if (!id) return "UTC (UTC+00:00)";
  return `${labelFor(id)} (UTC)`;
}

export function isKnownTimezone(id: string): boolean {
  return TIMEZONE_OPTIONS.some((o) => o.id === id);
}

// Resolves the effective household timezone. A stored value wins; when the
// household has none (legacy households, or "match device" default), it falls
// back to the device's IANA timezone.
export function resolveTimezone(stored: string | undefined): string {
  if (stored) return stored;
  return getCalendars()[0]?.timeZone ?? "UTC";
}