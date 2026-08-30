const TRIGGER_RE = /טיסה|flight/i;
const CANCEL_RE = /ביטול|בטל|עצור|cancel|stop/i;
const ONE_WAY_RE = /הלוך|חד.?כיוונ|one.?way|בלי חזרה|לבד/i;

export function isTrigger(text: string): boolean {
  return TRIGGER_RE.test(text);
}

export function isCancel(text: string): boolean {
  return CANCEL_RE.test(text.trim());
}

export function isOneWayAnswer(text: string): boolean {
  return ONE_WAY_RE.test(text.trim());
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, or DD/MM (rolls to next year if the date already passed). */
export function parseDateHe(rawText: string): string | null {
  const text = rawText.trim();

  if (/^(היום|today)$/i.test(text)) return isoDate(new Date());
  if (/^(מחר|tomorrow)$/i.test(text)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }

  const match = text.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;

  const now = new Date();
  let year = match[3]
    ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
    : now.getFullYear();

  let candidate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(candidate.getTime())) return null;

  if (!match[3] && candidate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    year += 1;
    candidate = new Date(Date.UTC(year, month - 1, day));
  }

  return isoDate(candidate);
}

export function formatDateHe(isoDateStr: string): string {
  const [year, month, day] = isoDateStr.split("-");
  return `${day}/${month}/${year}`;
}
