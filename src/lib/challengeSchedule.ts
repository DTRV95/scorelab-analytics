export type ScheduleState = "before" | "running" | "finished" | "undated";

export interface PlanSchedule {
  state: ScheduleState;
  /** Which day of the challenge today is, by the calendar. Null until it starts. */
  calendarDay: number | null;
  /** Days until the first day, when it has not started. */
  daysUntilStart: number;
  /** The date the last day falls on. */
  endsOn: Date | null;
  /** Calendar days ahead of (positive) or behind (negative) the bets placed. */
  behindBy: number;
}

function atMidnight(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (atMidnight(to).getTime() - atMidnight(from).getTime()) / 86_400_000
  );
}

/**
 * Where today sits in a challenge that has a start date.
 *
 * The ladder day and the calendar day are not the same thing and should not be
 * forced together: the ladder moves when a bet is placed, the calendar moves
 * on its own. Keeping both is what lets the page say "day 5, and you have made
 * three bets" instead of quietly pretending nobody missed a day.
 */
export function planSchedule(
  startDate: string | null,
  betsPlaced: number,
  days: number,
  today = new Date()
): PlanSchedule {
  if (!startDate) {
    return {
      state: "undated",
      calendarDay: null,
      daysUntilStart: 0,
      endsOn: null,
      behindBy: 0,
    };
  }

  // A date column comes back as YYYY-MM-DD; parsing it as local midnight keeps
  // "day 1" on the day the person picked, whatever their timezone.
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new Date(year, (month ?? 1) - 1, day ?? 1);
  const elapsed = daysBetween(start, today);
  const endsOn = new Date(start);
  endsOn.setDate(endsOn.getDate() + days - 1);

  if (elapsed < 0) {
    return {
      state: "before",
      calendarDay: null,
      daysUntilStart: -elapsed,
      endsOn,
      behindBy: 0,
    };
  }

  const calendarDay = elapsed + 1;

  if (calendarDay > days) {
    return {
      state: "finished",
      calendarDay: days,
      daysUntilStart: 0,
      endsOn,
      behindBy: Math.max(0, days - betsPlaced),
    };
  }

  return {
    state: "running",
    calendarDay,
    daysUntilStart: 0,
    endsOn,
    behindBy: calendarDay - 1 - betsPlaced,
  };
}
