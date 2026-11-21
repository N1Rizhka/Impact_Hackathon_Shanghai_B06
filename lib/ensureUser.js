const COLORS = ['#00C853', '#FF2D55', '#2D6CFF', '#FFB800', '#9C27FF', '#FF6D00', '#00B8D4'];

/**
 * Upsert a user into the in-memory/Redis DB.
 * Critical on Vercel without Redis: each serverless instance may start empty,
 * so mutating routes must re-hydrate the acting user from the client payload.
 */
export function ensureUser(db, { id, name, deviceId, color, country, age, sex, username } = {}) {
  if (!id && !deviceId) {
    throw new Error('user id or deviceId required');
  }

  const patch = (u) => {
    if (name) u.name = String(name).trim().slice(0, 32) || u.name;
    if (country) u.country = String(country).trim().slice(0, 56);
    if (age != null && Number.isFinite(Number(age))) u.age = Number(age);
    if (sex) u.sex = String(sex).trim().slice(0, 24);
    if (username) u.username = String(username).trim().toLowerCase().slice(0, 24);
    u.lastSeen = Date.now();
    return u;
  };

  if (id && db.users[id]) {
    return patch(db.users[id]);
  }

  if (deviceId) {
    const byDevice = Object.values(db.users).find((u) => u.deviceId === deviceId);
    if (byDevice) return patch(byDevice);
  }

  const resolvedId = id || `u_${String(deviceId).slice(0, 12)}`;
  const user = {
    id: resolvedId,
    name: String(name || 'Learner').trim().slice(0, 32) || 'Learner',
    username: username || undefined,
    deviceId: deviceId || resolvedId,
    color: color || COLORS[Object.keys(db.users).length % COLORS.length],
    country: country || undefined,
    age: age != null ? Number(age) : undefined,
    sex: sex || undefined,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    friends: [],
  };
  db.users[resolvedId] = user;
  return user;
}

export function ensureTopic(db, topic) {
  if (!topic?.id) return null;
  const existing = db.topics[topic.id];
  const next = {
    ...(existing || {}),
    ...topic,
    id: topic.id,
    builtin: Boolean(topic.builtin),
  };
  db.topics[topic.id] = next;
  return next;
}
