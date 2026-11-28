const TOKYO_DATE_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
});

/** 業務タイムゾーン（Asia/Tokyo）における日付文字列（YYYY-MM-DD）を返す。 */
export function formatBusinessDateInTokyo(date: Date = new Date()): string {
  return TOKYO_DATE_FORMATTER.format(date);
}
