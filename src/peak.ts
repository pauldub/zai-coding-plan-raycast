export interface PeakStatus {
  isPeak: boolean;
  label: string;
}

// GLM Coding Plan peak hours: 14:00-18:00 UTC+8 (Beijing) == 06:00-10:00 UTC.
const PEAK_START_UTC = 6; // 14:00 Beijing
const PEAK_END_UTC = 10; // 18:00 Beijing

export function getPeakStatus(now: Date = new Date()): PeakStatus {
  const utcFraction = now.getUTCHours() + now.getUTCMinutes() / 60;
  const isPeak = utcFraction >= PEAK_START_UTC && utcFraction < PEAK_END_UTC;

  if (isPeak) {
    const hoursToEnd = PEAK_END_UTC - utcFraction;
    return {
      isPeak: true,
      label: `Peak hours (3x quota cost) - ends in ${Math.ceil(hoursToEnd)}h`,
    };
  }

  const hoursToStart = (((PEAK_START_UTC - utcFraction) % 24) + 24) % 24;
  return {
    isPeak: false,
    label: `Off-peak (lower cost) - peak in ${Math.round(hoursToStart)}h`,
  };
}
