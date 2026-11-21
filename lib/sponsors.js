/** Demo sponsor perks unlocked by team points (any member can unlock for the room). */
export const SPONSORS = [
  {
    id: 'luckin',
    name: 'Luckin Coffee',
    city: 'Shanghai',
    blurb: 'Fuel your next study sprint.',
    perk: '¥15 off any handcrafted drink',
    threshold: 40,
    voucher: 'LUCKIN-BRAIN-26',
    accent: '#E60012',
  },
  {
    id: 'shanghai-art',
    name: 'Shanghai Art Museum',
    city: 'Shanghai',
    blurb: 'Stretch your mind between sessions.',
    perk: 'Free weekend entry pass',
    threshold: 80,
    voucher: 'SAM-LEARN-88',
    accent: '#1A237E',
  },
];

export function unlockedSponsors(teamPoints) {
  return SPONSORS.map((s) => ({
    ...s,
    unlocked: teamPoints >= s.threshold,
    remaining: Math.max(0, s.threshold - teamPoints),
  }));
}
