function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Fixed-date (solar calendar) Korean public holidays.
export const FIXED_HOLIDAYS_MM_DD = new Set([
  '01-01', // 신정
  '03-01', // 삼일절
  '05-05', // 어린이날
  '06-06', // 현충일
  '08-15', // 광복절
  '10-03', // 개천절
  '10-09', // 한글날
  '12-25', // 크리스마스
]);

// 설날/추석 fall on the lunar calendar, so their solar-calendar dates shift every
// year — each entry is that year's official holiday period (includes 대체공휴일).
export const LUNAR_HOLIDAY_RANGES: Record<number, Array<[string, string]>> = {
  2024: [
    ['02-09', '02-12'], // 설날
    ['09-16', '09-18'], // 추석
  ],
  2025: [
    ['01-27', '01-30'],
    ['10-05', '10-08'],
  ],
  2026: [
    ['02-16', '02-18'],
    ['09-24', '09-27'],
  ],
  2027: [
    ['02-06', '02-09'],
    ['09-14', '09-16'],
  ],
  2028: [
    ['01-26', '01-28'],
    ['10-02', '10-04'],
  ],
  2029: [
    ['02-12', '02-14'],
    ['09-21', '09-24'],
  ],
  2030: [
    ['02-02', '02-04'],
    ['09-11', '09-13'],
  ],
};

export function isLunarHoliday(year: number, mmdd: string): boolean {
  const ranges = LUNAR_HOLIDAY_RANGES[year];
  if (!ranges) return false;
  return ranges.some(([start, end]) => mmdd >= start && mmdd <= end);
}

/** True for Sundays-agnostic fixed holidays and 설날/추석 (2024-2030). Does not check weekday. */
export function isKoreanHoliday(year: number, month: number, day: number): boolean {
  const mmdd = `${pad(month)}-${pad(day)}`;
  return FIXED_HOLIDAYS_MM_DD.has(mmdd) || isLunarHoliday(year, mmdd);
}
