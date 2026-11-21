/** Summarize registered users for room/public “who’s here” infographics. */
export function summarizeAudience(users = []) {
  const list = (users || []).filter(Boolean);
  if (!list.length) {
    return {
      count: 0,
      avgAge: null,
      countries: [],
      sexes: [],
      blurb: 'No members yet — be the first to join.',
    };
  }

  const ages = list.map((u) => Number(u.age)).filter((n) => Number.isFinite(n) && n > 0 && n < 120);
  const avgAge = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length) : null;

  const countryCounts = countField(list, 'country');
  const sexCounts = countField(list, 'sex');

  const countries = topPct(countryCounts, list.length);
  const sexes = topPct(sexCounts, list.length);

  const countryBit = countries[0] ? `often from ${countries[0].name}` : 'from many places';
  const ageBit = avgAge ? `around age ${avgAge}` : 'mixed ages';
  const sexBit = sexes.length
    ? sexes.map((s) => `${s.pct}% ${labelSex(s.name)}`).join(' · ')
    : 'mixed profiles';

  return {
    count: list.length,
    avgAge,
    countries,
    sexes,
    blurb: `${list.length} learner${list.length === 1 ? '' : 's'} · ${ageBit} · ${countryBit} · ${sexBit}`,
  };
}

function countField(list, key) {
  const map = new Map();
  for (const u of list) {
    const v = String(u[key] || '').trim();
    if (!v) continue;
    map.set(v, (map.get(v) || 0) + 1);
  }
  return map;
}

function topPct(map, total) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, n]) => ({ name, count: n, pct: Math.round((n / total) * 100) }));
}

function labelSex(raw) {
  const v = String(raw).toLowerCase();
  if (v === 'female' || v === 'f') return 'female';
  if (v === 'male' || v === 'm') return 'male';
  if (v === 'nonbinary' || v === 'non-binary') return 'non-binary';
  if (v === 'prefer_not' || v === 'prefer not to say') return 'unspecified';
  return raw;
}
