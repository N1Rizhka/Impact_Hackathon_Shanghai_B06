/** Freemium: basic practice free; AI media + tutor chat is Premium ($5). */
export const PREMIUM_PRICE_USD = 5;

export const FREE_METHODS = new Set(['flashcards', 'errorHunt', 'quiz']);
export const PREMIUM_METHODS = new Set(['aiChat', 'videoExplain', 'photoSchemes']);

export function isPremiumMethod(methodId) {
  return PREMIUM_METHODS.has(methodId);
}

export function isMethodFree(methodId) {
  return FREE_METHODS.has(methodId);
}
