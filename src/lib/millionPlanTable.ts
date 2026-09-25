import type { Rung } from "@/lib/challengeRules";

/**
 * The Plano Milhão exactly as the document writes it.
 *
 * These 38 rows are transcribed from the PDF rather than generated from the
 * rules beside it. Generating them lands within a few cents at first and ends
 * €432 above the document's own total, because the table was built in a
 * spreadsheet that carried unrounded values between rows. The brothers bet
 * against the numbers on their sheet, so the numbers on their sheet are what
 * the app has to show.
 *
 * Columns, in the document's order: Dia, Banca, Aposta, Odd, Lucro, Total.
 */
export const MILLION_PLAN_TABLE: Rung[] = [
  { day: 1, bankrollStart: 10, stake: 5, odds: 2, profit: 5, bankrollEnd: 15, stakePct: 0.5 },
  { day: 2, bankrollStart: 15, stake: 7.50, odds: 1.85, profit: 6.38, bankrollEnd: 21.38, stakePct: 0.5 },
  { day: 3, bankrollStart: 21.38, stake: 10.69, odds: 1.9, profit: 9.62, bankrollEnd: 30.99, stakePct: 0.5 },
  { day: 4, bankrollStart: 30.99, stake: 15.50, odds: 1.95, profit: 14.72, bankrollEnd: 45.72, stakePct: 0.5 },
  { day: 5, bankrollStart: 45.72, stake: 22.86, odds: 1.75, profit: 17.14, bankrollEnd: 62.86, stakePct: 0.5 },
  { day: 6, bankrollStart: 62.86, stake: 31.43, odds: 1.8, profit: 25.14, bankrollEnd: 88, stakePct: 0.5 },
  { day: 7, bankrollStart: 88, stake: 44, odds: 1.85, profit: 37.40, bankrollEnd: 125.40, stakePct: 0.5 },
  { day: 8, bankrollStart: 125.40, stake: 62.70, odds: 1.9, profit: 56.43, bankrollEnd: 181.84, stakePct: 0.5 },
  { day: 9, bankrollStart: 181.84, stake: 90.92, odds: 1.95, profit: 86.37, bankrollEnd: 268.21, stakePct: 0.5 },
  { day: 10, bankrollStart: 268.21, stake: 134.10, odds: 1.75, profit: 100.58, bankrollEnd: 368.79, stakePct: 0.5 },
  { day: 11, bankrollStart: 368.79, stake: 184.39, odds: 1.8, profit: 147.51, bankrollEnd: 516.30, stakePct: 0.5 },
  { day: 12, bankrollStart: 516.30, stake: 258.15, odds: 1.85, profit: 219.43, bankrollEnd: 735.73, stakePct: 0.5 },
  { day: 13, bankrollStart: 735.73, stake: 367.86, odds: 1.9, profit: 331.08, bankrollEnd: 1066.81, stakePct: 0.5 },
  { day: 14, bankrollStart: 1066.81, stake: 533.40, odds: 1.95, profit: 506.73, bankrollEnd: 1573.54, stakePct: 0.5 },
  { day: 15, bankrollStart: 1573.54, stake: 786.77, odds: 1.75, profit: 590.08, bankrollEnd: 2163.62, stakePct: 0.5 },
  { day: 16, bankrollStart: 2163.62, stake: 865.45, odds: 1.8, profit: 692.36, bankrollEnd: 2855.97, stakePct: 0.4 },
  { day: 17, bankrollStart: 2855.97, stake: 1142.39, odds: 1.85, profit: 971.03, bankrollEnd: 3827, stakePct: 0.4 },
  { day: 18, bankrollStart: 3827, stake: 1530.80, odds: 1.9, profit: 1377.72, bankrollEnd: 5204.72, stakePct: 0.4 },
  { day: 19, bankrollStart: 5204.72, stake: 2081.89, odds: 1.95, profit: 1977.80, bankrollEnd: 7182.52, stakePct: 0.4 },
  { day: 20, bankrollStart: 7182.52, stake: 2873.01, odds: 1.75, profit: 2154.76, bankrollEnd: 9337.28, stakePct: 0.4 },
  { day: 21, bankrollStart: 9337.28, stake: 3734.91, odds: 1.8, profit: 2987.93, bankrollEnd: 12325.20, stakePct: 0.4 },
  { day: 22, bankrollStart: 12325.20, stake: 4930.08, odds: 1.85, profit: 4190.57, bankrollEnd: 16515.77, stakePct: 0.4 },
  { day: 23, bankrollStart: 16515.77, stake: 6606.31, odds: 1.9, profit: 5945.68, bankrollEnd: 22461.45, stakePct: 0.4 },
  { day: 24, bankrollStart: 22461.45, stake: 8984.58, odds: 1.95, profit: 8535.35, bankrollEnd: 30996.80, stakePct: 0.4 },
  { day: 25, bankrollStart: 30996.80, stake: 12398.72, odds: 1.75, profit: 9299.04, bankrollEnd: 40295.84, stakePct: 0.4 },
  { day: 26, bankrollStart: 40295.84, stake: 16118.34, odds: 1.8, profit: 12894.67, bankrollEnd: 53190.51, stakePct: 0.4 },
  { day: 27, bankrollStart: 53190.51, stake: 21276.20, odds: 1.85, profit: 18084.77, bankrollEnd: 71275.29, stakePct: 0.4 },
  { day: 28, bankrollStart: 71275.29, stake: 28510.11, odds: 1.9, profit: 25659.10, bankrollEnd: 96934.39, stakePct: 0.4 },
  { day: 29, bankrollStart: 96934.39, stake: 38773.76, odds: 1.95, profit: 36835.07, bankrollEnd: 133769.46, stakePct: 0.4 },
  { day: 30, bankrollStart: 133769.46, stake: 40130.84, odds: 1.75, profit: 30098.13, bankrollEnd: 163867.58, stakePct: 0.3 },
  { day: 31, bankrollStart: 163867.58, stake: 49160.28, odds: 1.8, profit: 39328.22, bankrollEnd: 203195.80, stakePct: 0.3 },
  { day: 32, bankrollStart: 203195.80, stake: 60958.74, odds: 1.85, profit: 51814.93, bankrollEnd: 255010.73, stakePct: 0.3 },
  { day: 33, bankrollStart: 255010.73, stake: 76503.22, odds: 1.9, profit: 68852.90, bankrollEnd: 323863.63, stakePct: 0.3 },
  { day: 34, bankrollStart: 323863.63, stake: 97159.09, odds: 1.95, profit: 92301.14, bankrollEnd: 416164.77, stakePct: 0.3 },
  { day: 35, bankrollStart: 416164.77, stake: 124849.43, odds: 1.75, profit: 93637.07, bankrollEnd: 509801.84, stakePct: 0.3 },
  { day: 36, bankrollStart: 509801.84, stake: 152940.55, odds: 1.8, profit: 122352.44, bankrollEnd: 632154.28, stakePct: 0.3 },
  { day: 37, bankrollStart: 632154.28, stake: 189646.29, odds: 1.85, profit: 161199.34, bankrollEnd: 793353.63, stakePct: 0.3 },
  { day: 38, bankrollStart: 793353.63, stake: 238006.09, odds: 1.9, profit: 214205.48, bankrollEnd: 1007559.11, stakePct: 0.3 },
];

/** What the document's last row lands on. */
export const MILLION_PLAN_END = 1007559.11;
