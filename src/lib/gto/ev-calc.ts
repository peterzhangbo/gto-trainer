// ---------------------------------------------------------------------------
// EV Calculation Utilities
// ---------------------------------------------------------------------------
// Pure math functions for pot odds, expected value, and call profitability.
// All monetary values use the same unit (bb or chips – consistent per call).

/**
 * Calculate the expected value of a call.
 *
 *   EV = (winPercentage * (potSize + betToCall)) - ((1 - winPercentage) * betToCall)
 *
 * Simplifies to:  EV = winPercentage * potSize + (2 * winPercentage - 1) * betToCall
 *
 * @param potSize       - Total pot before the call (including opponent's bet)
 * @param betToCall     - Amount the player must put in
 * @param winPercentage - Probability of winning (0 to 1)
 * @returns Expected value in the same currency unit
 */
export function calculateEV(
  potSize: number,
  betToCall: number,
  winPercentage: number,
): number {
  if (betToCall <= 0) return 0;
  const ev =
    winPercentage * (potSize + betToCall) - (1 - winPercentage) * betToCall;
  return Math.round(ev * 100) / 100;
}

/**
 * Calculate pot odds as a percentage.
 *
 *   potOdds = betToCall / (potSize + betToCall) * 100
 *
 * This is the minimum equity needed to profitably call.
 *
 * @param potSize   - Total pot before the call (including opponent's bet)
 * @param betToCall - Amount the player must put in
 * @returns Pot odds as a percentage (0-100)
 */
export function calculatePotOdds(
  potSize: number,
  betToCall: number,
): number {
  if (betToCall <= 0) return 0;
  const odds = (betToCall / (potSize + betToCall)) * 100;
  return Math.round(odds * 100) / 100;
}

/**
 * Determine whether a call is profitable given the player's equity.
 *
 * A call is profitable when:
 *   winPercentage >= betToCall / (potSize + betToCall)
 *
 * @param winPercentage - Probability of winning (0 to 1)
 * @param potSize       - Total pot before the call
 * @param betToCall     - Amount the player must put in
 * @returns true if calling has positive expected value
 */
export function isProfitableCall(
  winPercentage: number,
  potSize: number,
  betToCall: number,
): boolean {
  if (betToCall <= 0) return true;
  const requiredEquity = betToCall / (potSize + betToCall);
  return winPercentage >= requiredEquity;
}

/**
 * Calculate the break-even equity for a given pot and bet size.
 *
 * @param potSize   - Total pot before the call
 * @param betToCall - Amount the player must put in
 * @returns Break-even equity as a decimal (0 to 1)
 */
export function calculateBreakEvenEquity(
  potSize: number,
  betToCall: number,
): number {
  if (betToCall <= 0) return 0;
  return betToCall / (potSize + betToCall);
}

/**
 * Calculate the pot size after a bet is called.
 *
 * @param currentPot - Pot before the bet
 * @param betSize    - Size of the bet
 * @returns Pot size after call: currentPot + 2 * betSize
 */
export function potAfterCall(currentPot: number, betSize: number): number {
  return currentPot + 2 * betSize;
}

/**
 * Calculate the bet size as a fraction of the pot.
 *
 * @param betSize - Absolute bet size
 * @param potSize - Current pot
 * @returns Bet as a fraction of pot (e.g. 0.75 for a 3/4 pot bet)
 */
export function betAsFractionOfPot(betSize: number, potSize: number): number {
  if (potSize <= 0) return 0;
  return Math.round((betSize / potSize) * 10000) / 10000;
}

/**
 * Calculate the absolute bet size from a fraction of the pot.
 *
 * @param potSize       - Current pot
 * @param fractionOfPot - Desired fraction (e.g. 0.75 for 75% pot)
 * @returns Absolute bet size rounded to 2 decimal places
 */
export function betFromFraction(
  potSize: number,
  fractionOfPot: number,
): number {
  return Math.round(potSize * fractionOfPot * 100) / 100;
}
