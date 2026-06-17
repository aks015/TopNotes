/**
 * Shared display helpers for notes — single source of truth for subject colours,
 * exam labels, initials and currency formatting (previously duplicated across components).
 */

/** Subject → [from, to] gradient stops for note thumbnails. */
export const SUBJECT_COLORS: Record<string, [string, string]> = {
  Physics: ['#5B4BE0', '#3B2F8F'],
  Chemistry: ['#16A34A', '#0E7A38'],
  Biology: ['#0EA5A4', '#0A7572'],
  Mathematics: ['#F5A524', '#D97706'],
  Maths: ['#F5A524', '#D97706'],
  English: ['#DC2626', '#9F1D1D'],
};

export const EXAM_LABELS: Record<string, string> = {
  JEE_MAIN: 'JEE Main',
  JEE_ADVANCED: 'JEE Adv.',
  NEET: 'NEET',
  BOARD: 'Board',
};

function colors(subject?: string): [string, string] {
  return SUBJECT_COLORS[subject ?? ''] ?? ['#5B4BE0', '#3B2F8F'];
}

/** Textured thumbnail background (ruled-paper look) — used on note cards / detail preview. */
export function subjectGradient(subject?: string): string {
  const [a, b] = colors(subject);
  return `repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 1px, transparent 1px 22px), linear-gradient(150deg, ${a}, ${b})`;
}

/** Flat thumbnail background — used on small list/table thumbnails. */
export function subjectGradientFlat(subject?: string): string {
  const [a, b] = colors(subject);
  return `linear-gradient(150deg, ${a}, ${b})`;
}

/** Subject → "ruled-paper" palette for the redesigned note card cover. */
export interface SubjectPaper {
  accent: string; // tag background / chip text / hover accents
  ink: string; // handwritten title colour
  paper: string; // page colour
  line: string; // ruled line colour
  chip: string; // soft chip background
}

const SUBJECT_PAPER: Record<string, SubjectPaper> = {
  Physics: { accent: '#5840E0', ink: '#23304A', paper: '#F4F6FB', line: '#E5EAF5', chip: '#EFEBFF' },
  Biology: { accent: '#0E8A4D', ink: '#23403A', paper: '#F3FAF5', line: '#E2F0E7', chip: '#E9FBF0' },
  Mathematics: { accent: '#C2410C', ink: '#4A3523', paper: '#FBF6F0', line: '#F2E8DB', chip: '#FDEEE4' },
  Maths: { accent: '#C2410C', ink: '#4A3523', paper: '#FBF6F0', line: '#F2E8DB', chip: '#FDEEE4' },
  Chemistry: { accent: '#16141E', ink: '#2E2347', paper: '#F6F4FB', line: '#EAE5F5', chip: '#EEECF4' },
  English: { accent: '#DC2626', ink: '#4A2323', paper: '#FBF4F4', line: '#F2E0E0', chip: '#FDE9E9' },
};

export function subjectPaper(subject?: string): SubjectPaper {
  return SUBJECT_PAPER[subject ?? ''] ?? SUBJECT_PAPER['Physics'];
}

/** Ruled-paper cover background for the redesigned note card. */
export function subjectLinedPaper(subject?: string): string {
  const p = subjectPaper(subject);
  return `repeating-linear-gradient(to bottom, ${p.paper} 0px, ${p.paper} 21px, ${p.line} 22px)`;
}

export function examLabel(examType?: string): string {
  return EXAM_LABELS[examType ?? ''] ?? examType ?? '';
}

/**
 * Title-cases user input for consistent listings: capitalises the first letter
 * of each word and collapses runs of whitespace. Existing capitals are left
 * untouched so acronyms (JEE, NCERT, UPSC) typed in caps survive.
 */
export function toTitleCase(value?: string): string {
  return (value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/(^|\s)(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase())
    .trim();
}

export function initials(name?: string): string {
  const parts = (name ?? '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** Full rupee amount, e.g. ₹1,299. */
export function rupee(value?: number): string {
  return '₹' + (value ?? 0).toLocaleString('en-IN');
}

/** Compact rupee for charts, e.g. ₹1.4k. */
export function rupeeShort(value: number): string {
  return '₹' + (value / 1000).toFixed(1) + 'k';
}
