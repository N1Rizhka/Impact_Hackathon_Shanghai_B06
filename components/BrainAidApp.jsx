'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Logo from './Logo';
import { getDeviceId, loadUser, saveUser } from '@/lib/device';
import { extractTextFromFiles } from '@/lib/extractMaterial';

const METHODS = [
  { id: 'flashcards', label: 'Flashcards', blurb: 'Spaced recall' },
  { id: 'errorHunt', label: 'Error hunt', blurb: 'Catch planted mistakes' },
  { id: 'quiz', label: 'Quiz', blurb: 'Multiple choice' },
  { id: 'explain', label: 'Explain-back', blurb: 'Teach it yourself' },
];

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || data?.error?.code === '401' || data?.protection) {
      throw new Error(
        'This Vercel deployment is password/SSO protected. Disable Deployment Protection for Production, then redeploy.',
      );
    }
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }
  return data;
}

function avatar(name, color, size = 36) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        background: color || '#00C853',
        fontSize: size * 0.36,
      }}
    >
      {letter}
    </div>
  );
}

export default function BrainAidApp({ initialInvite = '' }) {
  const [boot, setBoot] = useState(true);
  const [user, setUser] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [view, setView] = useState('home');
  const [topics, setTopics] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [roomDetail, setRoomDetail] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [inviteInput, setInviteInput] = useState(initialInvite || '');
  const [dmFriend, setDmFriend] = useState(null);
  const [dmChat, setDmChat] = useState([]);
  const [dmText, setDmText] = useState('');
  const [chatText, setChatText] = useState('');
  const [createForm, setCreateForm] = useState({
    teamName: '',
    topicId: 'photosynthesis',
    period: 14,
    methods: ['flashcards', 'errorHunt', 'quiz'],
    quizEvery: 2,
  });
  const [topicForm, setTopicForm] = useState({ title: '', material: '' });
  const [busy, setBusy] = useState(false);
  const [extractStatus, setExtractStatus] = useState('');

  const refreshTopics = useCallback(async () => {
    const data = await api('/api/topics');
    setTopics(data.topics || []);
  }, []);

  const refreshRooms = useCallback(async (userId) => {
    const data = await api(`/api/rooms?userId=${userId}`);
    setRooms(data.rooms || []);
  }, []);

  const refreshFriends = useCallback(async (userId) => {
    const data = await api(`/api/friends?userId=${userId}`);
    setFriends(data.friends || []);
  }, []);

  const loadRoom = useCallback(async (roomId) => {
    const data = await api(`/api/rooms/${roomId}`);
    setRoomDetail(data);
    setActiveRoomId(roomId);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const existing = loadUser();
        if (existing?.id) {
          // Re-hydrate server memory (Vercel serverless has no durable store without Redis).
          const deviceId = existing.deviceId || getDeviceId();
          let u = existing;
          try {
            const synced = await api('/api/users', {
              method: 'POST',
              body: JSON.stringify({ name: existing.name, deviceId }),
            });
            u = synced.user || existing;
            saveUser(u);
          } catch {
            // Keep local profile; create/join will upsert the host.
          }
          setUser(u);
          setNameDraft(u.name);
          await refreshTopics();
          await refreshRooms(u.id);
          await refreshFriends(u.id);
          if (initialInvite) {
            setView('join');
            setInviteInput(initialInvite);
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setBoot(false);
      }
    })();
  }, [initialInvite, refreshFriends, refreshRooms, refreshTopics]);

  // Poll room chat / nudges while in room view
  useEffect(() => {
    if (!activeRoomId || (view !== 'room' && view !== 'chat')) return undefined;
    const t = setInterval(() => {
      loadRoom(activeRoomId).catch(() => {});
    }, 2500);
    return () => clearInterval(t);
  }, [activeRoomId, view, loadRoom]);

  useEffect(() => {
    if (!dmFriend || !user) return undefined;
    const load = () =>
      api(`/api/dm?a=${user.id}&b=${dmFriend.id}`).then((d) => setDmChat(d.chat || []));
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [dmFriend, user]);

  async function register() {
    setError('');
    const name = nameDraft.trim();
    if (!name) return;
    setBusy(true);
    try {
      const deviceId = getDeviceId();
      const { user: u } = await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, deviceId }),
      });
      saveUser(u);
      setUser(u);
      await refreshTopics();
      await refreshRooms(u.id);
      await refreshFriends(u.id);
      setView(initialInvite ? 'join' : 'home');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createRoom() {
    setBusy(true);
    setError('');
    try {
      const topic = topics.find((t) => t.id === createForm.topicId) || null;
      const { room } = await api('/api/rooms', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          hostId: user.id,
          hostName: user.name,
          deviceId: user.deviceId || getDeviceId(),
          hostColor: user.color,
          topic,
        }),
      });
      setCreateForm((f) => ({ ...f, teamName: '' }));
      await refreshRooms(user.id);
      await loadRoom(room.id);
      setView('room');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    setBusy(true);
    setError('');
    try {
      const { room } = await api('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({
          inviteCode: inviteInput.trim(),
          userId: user.id,
          userName: user.name,
          deviceId: user.deviceId || getDeviceId(),
          userColor: user.color,
        }),
      });
      await refreshRooms(user.id);
      await loadRoom(room.id);
      setView('room');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function createTopic() {
    setBusy(true);
    setError('');
    try {
      const { topic } = await api('/api/topics', {
        method: 'POST',
        body: JSON.stringify({
          title: topicForm.title,
          material: topicForm.material,
          ownerId: user.id,
          ownerName: user.name,
          deviceId: user.deviceId || getDeviceId(),
          ownerColor: user.color,
        }),
      });
      await refreshTopics();
      setCreateForm((f) => ({ ...f, topicId: topic.id }));
      setTopicForm({ title: '', material: '' });
      setView('rooms');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function addFriend(query) {
    setBusy(true);
    setError('');
    try {
      await api('/api/friends', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, friendCodeOrName: query }),
      });
      await refreshFriends(user.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendNudge(toUserId) {
    if (!activeRoomId) return;
    setBusy(true);
    try {
      await api(`/api/rooms/${activeRoomId}/nudge`, {
        method: 'POST',
        body: JSON.stringify({
          fromUserId: user.id,
          toUserId,
          note: `Nudge from ${user.name}: jump into today’s session!`,
        }),
      });
      await loadRoom(activeRoomId);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendRoomChat() {
    if (!chatText.trim() || !activeRoomId) return;
    const text = chatText;
    setChatText('');
    await api(`/api/rooms/${activeRoomId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ userId: user.id, text }),
    });
    await loadRoom(activeRoomId);
  }

  async function sendDm() {
    if (!dmText.trim() || !dmFriend) return;
    const text = dmText;
    setDmText('');
    await api('/api/dm', {
      method: 'POST',
      body: JSON.stringify({ fromUserId: user.id, toUserId: dmFriend.id, text }),
    });
    const d = await api(`/api/dm?a=${user.id}&b=${dmFriend.id}`);
    setDmChat(d.chat || []);
  }

  function topicById(id) {
    return topics.find((t) => t.id === id) || (roomDetail?.topic?.id === id ? roomDetail.topic : null);
  }

  function startSession(mode) {
    const topic = topicById(roomDetail.room.topicId) || roomDetail?.topic;
    if (!topic) {
      setError('Topic pack missing — recreate the room or pick a built-in topic.');
      return;
    }
    setSession({
      mode,
      topic,
      cardIdx: 0,
      flipped: false,
      found: [],
      toast: '',
      quizIdx: 0,
      quizPick: null,
      quizScore: 0,
      explainText: '',
      explainDone: false,
    });
    setView('session');
  }

  async function finishSession() {
    await api(`/api/rooms/${activeRoomId}`, {
      method: 'POST',
      body: JSON.stringify({
        action: 'completeSession',
        userId: user.id,
        mode: session.mode,
      }),
    });
    setSession(null);
    await loadRoom(activeRoomId);
    await refreshFriends(user.id);
    setView('room');
  }

  const myNudges = useMemo(() => {
    if (!roomDetail || !user) return [];
    return (roomDetail.nudges || []).filter((n) => n.toUserId === user.id).slice(-5).reverse();
  }, [roomDetail, user]);

  if (boot) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <Logo size={40} />
          <h1>Brain Aid</h1>
          <p className="lede">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <Logo size={48} />
          <h1>Brain Aid</h1>
          <p className="lede">Learn together. Create a room, invite friends, and keep each other going.</p>
          <div className="field">
            <label>Your name</label>
            <input
              value={nameDraft}
              maxLength={32}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="e.g. Alex"
            />
          </div>
          {error && <p className="toast bad">{error}</p>}
          <button type="button" className="btn primary" disabled={busy} onClick={register}>
            Get started
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <button type="button" className="brand" onClick={() => setView('home')}>
          <Logo /> Brain Aid
        </button>
        <div className="user-chip">
          {avatar(user.name, user.color, 34)}
          <div>
            <strong>{user.name}</strong>
            <span>ID · {user.id.slice(0, 10)}</span>
          </div>
        </div>
        <nav className="nav">
          {[
            ['home', 'Home'],
            ['rooms', 'Rooms'],
            ['join', 'Join invite'],
            ['topics', 'Topics'],
            ['friends', 'Friends'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={
                view === id || (id === 'rooms' && (view === 'room' || view === 'create'))
                  ? 'active'
                  : ''
              }
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main">
        {error && (
          <div className="banner" role="alert">
            {error}{' '}
            <button type="button" className="btn sm" onClick={() => setError('')}>
              Dismiss
            </button>
          </div>
        )}

        {view === 'home' && (
          <>
            <div className="topbar">
              <div>
                <h1>Hey, {user.name}</h1>
                <p>Rooms, friends, custom topics — pick a path and go.</p>
              </div>
              <button type="button" className="btn primary" onClick={() => setView('rooms')}>
                Rooms
              </button>
            </div>
            <div className="grid cols-3" style={{ marginBottom: 14 }}>
              <div className="card">
                <p className="eyebrow">Rooms</p>
                <h3>{rooms.length}</h3>
              </div>
              <div className="card">
                <p className="eyebrow">Friends</p>
                <h3>{friends.length}</h3>
              </div>
              <div className="card">
                <p className="eyebrow">Topics</p>
                <h3>{topics.length}</h3>
              </div>
            </div>
            <div className="split">
              <div>
                <p className="eyebrow">Your rooms</p>
                {rooms.length ? (
                  rooms.map((r) => (
                    <div
                      key={r.id}
                      className="card clickable"
                      style={{ marginBottom: 10 }}
                      onClick={() => {
                        loadRoom(r.id).then(() => setView('room'));
                      }}
                    >
                      <h3>{r.teamName}</h3>
                      <p>
                        {topicById(r.topicId)?.title || r.topicId} · code{' '}
                        <strong>{r.inviteCode}</strong>
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="empty">No rooms yet — create one or join an invite.</div>
                )}
              </div>
              <div>
                <p className="eyebrow">Quick actions</p>
                <div className="card" style={{ marginBottom: 10 }}>
                  <h3>Join a friend</h3>
                  <p style={{ marginBottom: 10 }}>Paste their room invite code.</p>
                  <button type="button" className="btn blue sm" onClick={() => setView('join')}>
                    Join invite
                  </button>
                </div>
                <div className="card">
                  <h3>Build a topic</h3>
                  <p style={{ marginBottom: 10 }}>Upload notes and turn them into practice.</p>
                  <button type="button" className="btn pink sm" onClick={() => setView('topics')}>
                    Create topic
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {(view === 'rooms' || view === 'create') && (
          <>
            <div className="topbar">
              <div>
                <h1>Rooms</h1>
                <p>Open a room or create a new one.</p>
              </div>
              <a className="btn primary" href="#create-room">
                Create a room
              </a>
            </div>

            {rooms.length ? (
              <div className="grid cols-2" style={{ marginBottom: 18 }}>
                {rooms.map((r) => (
                  <div
                    key={r.id}
                    className="card clickable"
                    onClick={() => loadRoom(r.id).then(() => setView('room'))}
                  >
                    <p className="eyebrow">{r.inviteCode}</p>
                    <h3>{r.teamName}</h3>
                    <p>
                      {topicById(r.topicId)?.title} · {r.memberIds.length} members
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ marginBottom: 18 }}>
                No rooms yet.
              </div>
            )}

            <div className="card" id="create-room" style={{ maxWidth: 560 }}>
              <p className="eyebrow">New room</p>
              <h3 style={{ marginBottom: 12 }}>Create a room</h3>
              <div className="field">
                <label>Team name</label>
                <input
                  value={createForm.teamName}
                  onChange={(e) => setCreateForm({ ...createForm, teamName: e.target.value })}
                  placeholder="Night owls"
                />
              </div>
              <div className="field">
                <label>Topic</label>
                <select
                  value={createForm.topicId}
                  onChange={(e) => setCreateForm({ ...createForm, topicId: e.target.value })}
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                      {t.builtin ? '' : ' (custom)'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Period</label>
                <div className="chips">
                  {[7, 14, 30].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`chip ${createForm.period === p ? 'on' : ''}`}
                      onClick={() => setCreateForm({ ...createForm, period: p })}
                    >
                      {p} days
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Methods</label>
                <div className="chips">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`chip ${createForm.methods.includes(m.id) ? 'on' : ''}`}
                      onClick={() => {
                        const has = createForm.methods.includes(m.id);
                        let methods = has
                          ? createForm.methods.filter((x) => x !== m.id)
                          : [...createForm.methods, m.id];
                        if (!methods.length) methods = [m.id];
                        setCreateForm({ ...createForm, methods });
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="btn primary" disabled={busy} onClick={createRoom}>
                Create & get invite code
              </button>
            </div>
          </>
        )}

        {view === 'join' && (
          <>
            <div className="topbar">
              <div>
                <h1>Join with invite</h1>
                <p>Enter a room code from a friend.</p>
              </div>
            </div>
            <div className="card" style={{ maxWidth: 480 }}>
              <div className="field">
                <label>Invite code</label>
                <input
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                />
              </div>
              <button type="button" className="btn primary" disabled={busy} onClick={joinRoom}>
                Join room
              </button>
            </div>
          </>
        )}

        {view === 'topics' && (
          <>
            <div className="topbar">
              <div>
                <h1>Topics</h1>
                <p>Built-in packs or your own materials.</p>
              </div>
            </div>
            <div className="split">
              <div className="card">
                <h3>Create from study materials</h3>
                <p style={{ marginBottom: 12 }}>
                  Paste notes, or upload PDFs, images, and text files.
                </p>
                <div className="field">
                  <label>Topic title</label>
                  <input
                    value={topicForm.title}
                    onChange={(e) => setTopicForm({ ...topicForm, title: e.target.value })}
                    placeholder="Cell membranes"
                  />
                </div>
                <div className="field">
                  <label>Study material</label>
                  <textarea
                    value={topicForm.material}
                    onChange={(e) => setTopicForm({ ...topicForm, material: e.target.value })}
                    placeholder="Paste lecture notes, or upload files below…"
                  />
                </div>
                <div className="field">
                  <label>Upload PDF, images, or text</label>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.markdown,image/*,.png,.jpg,.jpeg,.webp,.gif"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      setBusy(true);
                      setError('');
                      setExtractStatus('Starting…');
                      try {
                        const text = await extractTextFromFiles(files, setExtractStatus);
                        const firstName = files[0].name.replace(/\.\w+$/, '');
                        setTopicForm((f) => ({
                          title: f.title || firstName,
                          material: f.material ? `${f.material.trim()}\n\n${text}` : text,
                        }));
                        setExtractStatus(`Added text from ${files.length} file${files.length === 1 ? '' : 's'}.`);
                      } catch (err) {
                        setError(err.message || 'Could not read those files');
                        setExtractStatus('');
                      } finally {
                        setBusy(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                {extractStatus && <p className="toast ok">{extractStatus}</p>}
                <button type="button" className="btn pink" disabled={busy} onClick={createTopic}>
                  Generate learning tasks
                </button>
              </div>
              <div>
                <p className="eyebrow">Available packs</p>
                {topics.map((t) => (
                  <div key={t.id} className="card" style={{ marginBottom: 10 }}>
                    <span className={`pill ${t.builtin ? '' : 'pink'}`}>
                      {t.builtin ? 'built-in' : t.generatedBy === 'ai' || t.tags?.includes('ai') ? 'AI custom' : 'custom'}
                    </span>
                    <h3 style={{ marginTop: 8 }}>{t.title}</h3>
                    <p>{t.blurb}</p>
                    <div className="actions" style={{ justifyContent: 'flex-start' }}>
                      <button
                        type="button"
                        className="btn sm primary"
                        onClick={() => {
                          setCreateForm((f) => ({ ...f, topicId: t.id }));
                          setView('rooms');
                        }}
                      >
                        Use in a room
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {view === 'friends' && (
          <>
            <div className="topbar">
              <div>
                <h1>Friends</h1>
                <p>Chat and keep streaks together.</p>
              </div>
            </div>
            <div className="split">
              <div className="card">
                <FriendAdd onAdd={addFriend} busy={busy} />
                {friends.length ? (
                  friends.map((f) => (
                    <div key={f.id} className="member-row">
                      {avatar(f.name, f.color, 36)}
                      <div className="meta">
                        <strong>{f.name}</strong>
                        <span>
                          streak together · {f.streak?.count || 0} day
                          {(f.streak?.count || 0) === 1 ? '' : 's'}
                          {f.streak?.lastDay ? ` · last ${f.streak.lastDay}` : ''}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn sm blue"
                        onClick={() => {
                          setDmFriend(f);
                          setView('dm');
                        }}
                      >
                        Chat
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty">Add a friend after they create a Brain Aid profile.</div>
                )}
              </div>
              <div className="card">
                <h3>Your ID</h3>
                <div className="invite-box">
                  <code>{user.id}</code>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => navigator.clipboard?.writeText(user.id)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {view === 'dm' && dmFriend && (
          <>
            <div className="topbar">
              <div>
                <h1>Chat with {dmFriend.name}</h1>
                <p>
                  Pair streak: <strong>{dmFriend.streak?.count || 0}</strong> day
                  {(dmFriend.streak?.count || 0) === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" className="btn ghost" onClick={() => setView('friends')}>
                Back
              </button>
            </div>
            <div className="card" style={{ maxWidth: 560 }}>
              <div className="chat">
                {dmChat.map((m) => (
                  <div key={m.id} className={`bubble ${m.userId === user.id ? 'me' : ''}`}>
                    <strong>{m.name}</strong>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="add-row" style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1 }}
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                  placeholder="Say something…"
                  onKeyDown={(e) => e.key === 'Enter' && sendDm()}
                />
                <button type="button" className="btn primary" onClick={sendDm}>
                  Send
                </button>
              </div>
            </div>
          </>
        )}

        {view === 'room' && roomDetail && (
          <RoomView
            user={user}
            detail={roomDetail}
            topic={topicById(roomDetail.room.topicId)}
            myNudges={myNudges}
            chatText={chatText}
            setChatText={setChatText}
            onSendChat={sendRoomChat}
            onNudge={sendNudge}
            onStart={startSession}
            onOpenChat={() => setView('chat')}
          />
        )}

        {view === 'chat' && roomDetail && (
          <>
            <div className="topbar">
              <div>
                <h1>Room chat</h1>
                <p>{roomDetail.room.teamName}</p>
              </div>
              <button type="button" className="btn ghost" onClick={() => setView('room')}>
                Back to room
              </button>
            </div>
            <div className="card" style={{ maxWidth: 640 }}>
              <div className="chat">
                {(roomDetail.chat || []).map((m) => (
                  <div key={m.id} className={`bubble ${m.userId === user.id ? 'me' : ''}`}>
                    <strong>{m.name}</strong>
                    {m.text}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1 }}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message the room…"
                  onKeyDown={(e) => e.key === 'Enter' && sendRoomChat()}
                />
                <button type="button" className="btn primary" onClick={sendRoomChat}>
                  Send
                </button>
              </div>
            </div>
          </>
        )}

        {view === 'session' && session && (
          <SessionView
            session={session}
            setSession={setSession}
            onExit={() => {
              setSession(null);
              setView('room');
            }}
            onFinish={finishSession}
          />
        )}
      </main>
    </div>
  );
}

function FriendAdd({ onAdd, busy }) {
  const [q, setQ] = useState('');
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <input
        style={{ flex: 1, minWidth: 160 }}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Friend name or user ID"
      />
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => {
          onAdd(q.trim());
          setQ('');
        }}
      >
        Add friend
      </button>
    </div>
  );
}

function RoomView({
  user,
  detail,
  topic,
  myNudges,
  chatText,
  setChatText,
  onSendChat,
  onNudge,
  onStart,
  onOpenChat,
}) {
  const { room, members } = detail;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${origin}/join/${room.inviteCode}`;

  const rankings = members
    .map((m) => {
      const sessions = room.sessionsByUser?.[m.id]?.length || 0;
      return {
        ...m,
        score: 60 + sessions * 8 + (m.id === user.id ? 2 : 0),
        sessions,
        isYou: m.id === user.id,
      };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">{room.teamName}</p>
          <h1>{topic?.title || 'Room'}</h1>
          <p>
            {room.period} days · {members.length} people
          </p>
        </div>
        <button type="button" className="btn blue" onClick={onOpenChat}>
          Open chat
        </button>
      </div>

      <div className="invite-box" style={{ marginBottom: 14 }}>
        <span>Invite:</span>
        <code>{room.inviteCode}</code>
        <button
          type="button"
          className="btn sm"
          onClick={() => navigator.clipboard?.writeText(inviteUrl)}
        >
          Copy link
        </button>
      </div>

      {myNudges.length > 0 && (
        <div className="banner">
          Nudges:{' '}
          {myNudges.map((n) => `${n.fromName}: ${n.note}`).join(' · ')}
        </div>
      )}

      <div className="split">
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <p className="eyebrow">Learn</p>
            <div className="mode-grid">
              {room.methods.map((id) => {
                const m = METHODS.find((x) => x.id === id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="mode-btn"
                    onClick={() => onStart(id)}
                  >
                    <strong>{m.label}</strong>
                    <span>{m.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="card">
            <p className="eyebrow">Quick room chat</p>
            <div className="chat" style={{ maxHeight: 180 }}>
              {(detail.chat || []).slice(-8).map((m) => (
                <div key={m.id} className={`bubble ${m.userId === user.id ? 'me' : ''}`}>
                  <strong>{m.name}</strong>
                  {m.text}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ flex: 1 }}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Message…"
                onKeyDown={(e) => e.key === 'Enter' && onSendChat()}
              />
              <button type="button" className="btn primary sm" onClick={onSendChat}>
                Send
              </button>
            </div>
          </div>
        </div>
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <p className="eyebrow">Team</p>
            {members.map((m) => {
              const sessions = room.sessionsByUser?.[m.id]?.length || 0;
              const idle = sessions === 0;
              return (
                <div key={m.id} className="member-row">
                  {avatar(m.name, m.color, 34)}
                  <div className="meta">
                    <strong>
                      {m.name}
                      {m.id === user.id ? ' (you)' : ''}
                    </strong>
                    <span>
                      {sessions} session{sessions === 1 ? '' : 's'}
                      {idle ? " · hasn't started" : ''}
                    </span>
                  </div>
                  {m.id !== user.id && (
                    <button
                      type="button"
                      className="btn sm pink"
                      onClick={() => onNudge(m.id)}
                      title="Nudge them to study"
                    >
                      Nudge
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="card">
            <p className="eyebrow">Commitment board</p>
            <ol className="rank">
              {rankings.map((m, i) => (
                <li key={m.id} className={m.isYou ? 'you' : ''}>
                  <span>#{i + 1}</span>
                  {avatar(m.name, m.color, 32)}
                  <div>
                    <strong>{m.name}</strong>
                  </div>
                  <strong>{m.score}</strong>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}

function SessionView({ session, setSession, onExit, onFinish }) {
  const { mode, topic } = session;

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">Session · {METHODS.find((m) => m.id === mode)?.label}</p>
          <h1>{topic.title}</h1>
        </div>
        <button type="button" className="btn ghost" onClick={onExit}>
          Exit
        </button>
      </div>
      <div className="card">
        {mode === 'flashcards' && (
          <FlashSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
        {mode === 'errorHunt' && (
          <HuntSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
        {mode === 'quiz' && (
          <QuizSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
        {mode === 'explain' && (
          <ExplainSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
      </div>
    </>
  );
}

function FlashSession({ session, setSession, onFinish }) {
  const card = session.topic.flashcards[session.cardIdx];
  const last = session.cardIdx >= session.topic.flashcards.length - 1;
  return (
    <>
      <button
        type="button"
        className={`flash ${session.flipped ? 'is-flipped' : ''}`}
        onClick={() => setSession({ ...session, flipped: !session.flipped })}
      >
        <div className="flash-face front">
          <span>
            Card {session.cardIdx + 1}/{session.topic.flashcards.length}
          </span>
          <p>{card.front}</p>
          <em>Tap to flip</em>
        </div>
        <div className="flash-face back">
          <span>Answer</span>
          <p>{card.back}</p>
        </div>
      </button>
      <div className="actions" style={{ justifyContent: 'center' }}>
        <button
          type="button"
          className="btn ghost"
          disabled={session.cardIdx === 0}
          onClick={() => setSession({ ...session, cardIdx: session.cardIdx - 1, flipped: false })}
        >
          Prev
        </button>
        {last ? (
          <button type="button" className="btn primary" onClick={onFinish}>
            Finish
          </button>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={() => setSession({ ...session, cardIdx: session.cardIdx + 1, flipped: false })}
          >
            Next
          </button>
        )}
      </div>
    </>
  );
}

function HuntSession({ session, setSession, onFinish }) {
  const { topic, found, toast } = session;
  const caught = found.length;
  const done = caught >= topic.errorCount;

  return (
    <>
      <p style={{ marginTop: 0, color: 'var(--muted)' }}>
        Tap words you think are wrong. Nothing is highlighted until you catch a mistake.
      </p>
      <div className="passage">
        {topic.errorPassage.map((tok, i) => {
          if (tok.ok) {
            return (
              <button
                key={i}
                type="button"
                className="word"
                onClick={() =>
                  setSession({ ...session, toast: 'That part looks fine — keep hunting.' })
                }
              >
                {tok.t}
              </button>
            );
          }
          if (found.includes(tok.id)) {
            return (
              <button key={i} type="button" className="word caught">
                <s>{tok.t}</s> <b>{tok.fix}</b>
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              className="word"
              onClick={() =>
                setSession({
                  ...session,
                  found: [...found, tok.id],
                  toast: `Caught it → ${tok.fix}`,
                })
              }
            >
              {tok.t}
            </button>
          );
        })}
      </div>
      <div className={`toast ${toast?.startsWith('Caught') ? 'ok' : 'bad'}`}>{toast}</div>
      <div className="hunt-status">
        <div className="meter">
          <div style={{ width: `${(caught / topic.errorCount) * 100}%` }} />
        </div>
        <span>
          {caught}/{topic.errorCount} caught
        </span>
      </div>
      {done && (
        <div className="actions">
          <button type="button" className="btn primary" onClick={onFinish}>
            Finish session
          </button>
        </div>
      )}
    </>
  );
}

function QuizSession({ session, setSession, onFinish }) {
  const { topic, quizIdx, quizPick, quizScore } = session;
  if (quizIdx >= topic.quiz.length) {
    return (
      <>
        <h3>
          Score {quizScore}/{topic.quiz.length}
        </h3>
        <button type="button" className="btn primary" onClick={onFinish}>
          Finish
        </button>
      </>
    );
  }
  const item = topic.quiz[quizIdx];
  return (
    <>
      <p className="eyebrow">
        Q{quizIdx + 1}/{topic.quiz.length}
      </p>
      <h3 style={{ marginBottom: 12 }}>{item.q}</h3>
      {item.options.map((opt, i) => {
        let cls = 'quiz-opt';
        if (quizPick !== null) {
          if (i === item.answer) cls += ' on';
          else if (i === quizPick) cls += ' bad';
        }
        return (
          <button
            key={opt}
            type="button"
            className={cls}
            disabled={quizPick !== null}
            onClick={() =>
              setSession({
                ...session,
                quizPick: i,
                quizScore: quizScore + (i === item.answer ? 1 : 0),
              })
            }
          >
            {opt}
          </button>
        );
      })}
      {quizPick !== null && (
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={() => setSession({ ...session, quizIdx: quizIdx + 1, quizPick: null })}
          >
            Continue
          </button>
        </div>
      )}
    </>
  );
}

function ExplainSession({ session, setSession, onFinish }) {
  const { topic, explainText, explainDone, toast } = session;
  if (explainDone) {
    return (
      <>
        <h3>Reviewed</h3>
        <p>{toast}</p>
        <button type="button" className="btn primary" onClick={onFinish}>
          Finish
        </button>
      </>
    );
  }
  return (
    <>
      <h3>{topic.explainPrompt}</h3>
      <div className="field">
        <textarea
          value={explainText}
          onChange={(e) => setSession({ ...session, explainText: e.target.value })}
        />
      </div>
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          const lower = explainText.toLowerCase();
          const hits = (topic.explainKeywords || []).filter((k) =>
            lower.includes(String(k).toLowerCase()),
          );
          setSession({
            ...session,
            explainDone: true,
            toast:
              hits.length >= 2
                ? `Nice — hit ${hits.length} key ideas (${hits.join(', ')}).`
                : `Add more of: ${(topic.explainKeywords || []).join(', ')}.`,
          });
        }}
      >
        Check understanding
      </button>
    </>
  );
}
