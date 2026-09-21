/**
 * Utility functions for date calculations in the Gym Management System.
 * Requirement: 1 month is calculated as exactly 30 days (30 * 24 * 60 * 60 * 1000 ms).
 */

const MILLISECONDS_IN_A_DAY = 24 * 60 * 60 * 1000;
const DAYS_PER_MONTH = 30;

/**
 * Adds months to a date by calculating duration as months * 30 days.
 * @param {Date|string|number} baseDate - The starting date
 * @param {number} months - Number of months to add
 * @returns {Date} - New Date instance offset by (months * 30) days
 */
function addMonthsAsDays(baseDate = new Date(), months = 1) {
  const parsedDate = new Date(baseDate);
  if (isNaN(parsedDate.getTime())) {
    throw new Error('Invalid base date provided to addMonthsAsDays');
  }
  const additionalDays = Number(months) * DAYS_PER_MONTH;
  return new Date(parsedDate.getTime() + additionalDays * MILLISECONDS_IN_A_DAY);
}

/**
 * Calculates whole remaining days between now and the expiry date.
 * @param {Date|string|number} expiryDate - Expiry date
 * @returns {number} - Non-negative integer of remaining whole days
 */
function calculateRemainingDays(expiryDate) {
  if (!expiryDate) return 0;
  const targetTime = new Date(expiryDate).getTime();
  const now = Date.now();
  if (isNaN(targetTime) || targetTime <= now) return 0;
  return Math.ceil((targetTime - now) / MILLISECONDS_IN_A_DAY);
}

/**
 * Checks if a given date is in the past.
 * @param {Date|string|number} date 
 * @returns {boolean}
 */
function isPastDate(date) {
  if (!date) return true;
  return new Date(date).getTime() < Date.now();
}

/**
 * Escapes regex special characters for safe MongoDB regex queries.
 * @param {string} string 
 * @returns {string}
 */
function escapeRegex(string = '') {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  DAYS_PER_MONTH,
  MILLISECONDS_IN_A_DAY,
  addMonthsAsDays,
  calculateRemainingDays,
  isPastDate,
  escapeRegex
};
