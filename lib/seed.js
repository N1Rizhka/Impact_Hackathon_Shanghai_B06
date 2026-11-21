/** Ensure a discoverable public room exists for new users. */
export function ensureMockPublicRoom(db) {
  if (!db.users.u_demo_guide) {
    db.users.u_demo_guide = {
      id: 'u_demo_guide',
      name: 'Guide Mei',
      username: 'guidemei',
      deviceId: 'demo_guide_device',
      color: '#2D6CFF',
      country: 'China',
      age: 27,
      sex: 'female',
      createdAt: Date.now() - 86400000 * 10,
      lastSeen: Date.now(),
      friends: [],
    };
  }

  // A few synthetic members so the audience infographic isn’t empty
  const extras = [
    { id: 'u_demo_a', name: 'Kenji', username: 'kenji_s', country: 'Japan', age: 22, sex: 'male', color: '#00C853' },
    { id: 'u_demo_b', name: 'Sofia', username: 'sofia_r', country: 'Spain', age: 25, sex: 'female', color: '#FF2D55' },
    { id: 'u_demo_c', name: 'Amir', username: 'amir_k', country: 'UAE', age: 29, sex: 'male', color: '#FFB800' },
  ];
  for (const e of extras) {
    if (!db.users[e.id]) {
      db.users[e.id] = {
        ...e,
        deviceId: `${e.id}_device`,
        createdAt: Date.now() - 86400000 * 5,
        lastSeen: Date.now(),
        friends: [],
      };
    }
  }

  const id = 'r_public_welcome';
  if (!db.rooms[id]) {
    db.rooms[id] = {
      id,
      teamName: 'Shanghai Open Study',
      topicId: 'photosynthesis',
      period: 14,
      methods: ['flashcards', 'errorHunt', 'quiz'],
      quizEvery: 2,
      hostId: 'u_demo_guide',
      memberIds: ['u_demo_guide', 'u_demo_a', 'u_demo_b', 'u_demo_c'],
      inviteCode: 'WELCOME',
      visibility: 'public',
      sessionsByUser: {
        u_demo_guide: [{ mode: 'flashcards', at: Date.now() - 86400000 }],
        u_demo_a: [{ mode: 'quiz', score: 2, total: 2, at: Date.now() - 3600000 }],
      },
      createdAt: Date.now() - 86400000 * 7,
      mock: true,
    };
    db.chats[id] = [
      {
        id: 'c_welcome',
        userId: 'u_demo_guide',
        name: 'Guide Mei',
        text: 'Welcome! This is a public room — jump into flashcards or the checkpoint when you’re ready.',
        at: Date.now() - 86400000,
      },
    ];
    db.nudges[id] = [];
  } else {
    db.rooms[id].visibility = 'public';
  }

  return db;
}
