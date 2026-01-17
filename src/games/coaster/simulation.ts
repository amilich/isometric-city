import { CoasterGameState } from './types';

const HOURS_PER_SECOND = 0.04;
const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;

export function simulateCoasterTick(
  state: CoasterGameState,
  deltaSeconds: number
): CoasterGameState {
  if (state.speed === 0) {
    return state;
  }

  let hour = state.hour + deltaSeconds * HOURS_PER_SECOND;
  let day = state.day;
  let month = state.month;
  let year = state.year;

  while (hour >= 24) {
    hour -= 24;
    day += 1;
  }

  while (day > DAYS_PER_MONTH) {
    day -= DAYS_PER_MONTH;
    month += 1;
  }

  while (month > MONTHS_PER_YEAR) {
    month -= MONTHS_PER_YEAR;
    year += 1;
  }

  return {
    ...state,
    hour,
    day,
    month,
    year,
    tick: state.tick + 1,
  };
}
