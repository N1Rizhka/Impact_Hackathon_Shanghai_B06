const COLORS = ['#00C853', '#FF2D55', '#2D6CFF', '#FFB800', '#9C27FF', '#FF6D00', '#00B8D4'];

/**
 * Upsert a user into the in-memory/Redis DB.
 * Critical on Vercel without Redis: each serverless instance may start empty,
 * so mutating routes must re-hydrate the acting user from the client payload.
 */
export function ensureUser(db, { id, name, deviceId, color } = {}) {
  if (!id && !deviceId) {
    throw new Error('user id or deviceId required');
  }

  if (id && db.users[id]) {
    const u = db.users[id];
    if (name) u.name = String(name).trim().slice(0, 32) || u.name;
    u.lastSeen = Date.now();
    return u;
  }

  if (deviceId) {
    const byDevice = Object.values(db.users).find((u) => u.deviceId === deviceId);
    if (byDevice) {
      if (name) byDevice.name = String(name).trim().slice(0, 32) || byDevice.name;
      byDevice.lastSeen = Date.now();
      return byDevice;
    }
  }

  const resolvedId = id || `u_${String(deviceId).slice(0, 12)}`;
  const user = {
    id: resolvedId,
    name: String(name || 'Learner').trim().slice(0, 32) || 'Learner',
    deviceId: deviceId || resolvedId,
    color: color || COLORS[Object.keys(db.users).length % COLORS.length],
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
