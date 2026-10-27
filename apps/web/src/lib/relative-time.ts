const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_SECOND = 1000;

export const relativeTime = (at: Date, now = new Date()): string => {
  const minutes = Math.floor(
    (now.getTime() - at.getTime()) / MS_PER_SECOND / SECONDS_PER_MINUTE
  );
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / HOURS_PER_DAY)}d ago`;
};
