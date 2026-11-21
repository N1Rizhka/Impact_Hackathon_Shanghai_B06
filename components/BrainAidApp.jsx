'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Logo from './Logo';
import AuthScreen from './AuthScreen';
import PassageCite, { PassageTutorial } from './PassageCite';
import { SponsorStrip, TeamTimeline } from './RoomTeamPanels';
import {
  getDeviceId,
  loadPassageTipSeen,
  loadPremium,
  loadUser,
  savePassageTipSeen,
  savePremium,
  saveUser,
} from '@/lib/device';
import { extractTextFromFiles } from '@/lib/extractMaterial';
import { attachPassagesToTopic } from '@/lib/passages';
import { isPremiumMethod, PREMIUM_PRICE_USD } from '@/lib/premium';
import { memberPoints } from '@/lib/scoring';

const METHODS = [
  { id: 'flashcards', label: 'Flashcards', blurb: 'Free · spaced recall', premium: false },
  { id: 'errorHunt', label: 'Error hunt', blurb: 'Free · catch planted mistakes', premium: false },
  { id: 'quiz', label: 'Checkpoint quiz', blurb: 'Free · on the team timeline', premium: false },
  { id: 'aiChat', label: 'AI chat', blurb: 'Premium · ask only about your materials', premium: true },
  { id: 'videoExplain', label: 'Video explanation', blurb: 'Premium · narrated scenes from your PDF', premium: true },
  { id: 'photoSchemes', label: 'Photo schemes', blurb: 'Premium · diagram from your notes', premium: true },
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
    visibility: 'private',
  });
  const [authMode, setAuthMode] = useState('register');
  const [registerForm, setRegisterForm] = useState({
    name: '',
    username: '',
    password: '',
    country: '',
    age: '',
    sex: '',
  });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [publicRooms, setPublicRooms] = useState([]);
  const [topicForm, setTopicForm] = useState({ title: '', material: '' });
  const [busy, setBusy] = useState(false);
  const [extractStatus, setExtractStatus] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [toastNudge, setToastNudge] = useState(null);
  const seenNudgeIds = useMemo(() => new Set(), []);
  const [premium, setPremium] = useState(false);
  const [premiumModal, setPremiumModal] = useState(false);
  const [pendingPremiumMethod, setPendingPremiumMethod] = useState(null);

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
    setPremium(loadPremium());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const existing = loadUser();
        if (existing?.id) {
          let u = existing;
          try {
            const synced = await api(`/api/users?id=${encodeURIComponent(existing.id)}`);
            if (synced.user) {
              u = { ...existing, ...synced.user };
              saveUser(u);
            }
          } catch {
            // Keep local profile if server is cold.
          }
          setUser(u);
          setNameDraft(u.name);
          await refreshTopics();
          await refreshRooms(u.id);
          await refreshFriends(u.id);
          try {
            await refreshPublicRooms();
          } catch {
            /* ignore */
          }
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

  // Global nudge notifications — fire even outside the room view
  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await api(`/api/notifications?userId=${user.id}`);
        if (cancelled) return;
        const list = data.notifications || [];
        setNotifications(list);
        const fresh = list.find((n) => !seenNudgeIds.has(n.id));
        if (fresh) {
          seenNudgeIds.add(fresh.id);
          setToastNudge(fresh);
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(`Nudge from ${fresh.fromName}`, {
                body: `${fresh.roomName}: ${fresh.note}`,
              });
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore transient poll errors */
      }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user?.id, seenNudgeIds]);

  useEffect(() => {
    if (!toastNudge) return undefined;
    const t = setTimeout(() => setToastNudge(null), 8000);
    return () => clearTimeout(t);
  }, [toastNudge]);

  useEffect(() => {
    if (!dmFriend || !user) return undefined;
    const load = () =>
      api(`/api/dm?a=${user.id}&b=${dmFriend.id}`).then((d) => setDmChat(d.chat || []));
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 2000);
    return () => clearInterval(t);
  }, [dmFriend, user]);

  async function refreshPublicRooms() {
    const data = await api('/api/rooms?scope=public');
    setPublicRooms(data.rooms || []);
  }

  async function afterAuth(u) {
    saveUser(u);
    setUser(u);
    setNameDraft(u.name || '');
    await refreshTopics();
    await refreshRooms(u.id);
    await refreshFriends(u.id);
    await refreshPublicRooms();
    setView(initialInvite ? 'join' : 'home');
  }

  async function register() {
    setError('');
    setBusy(true);
    try {
      const deviceId = getDeviceId();
      const { user: u } = await api('/api/users', {
        method: 'POST',
        body: JSON.stringify({ ...registerForm, age: Number(registerForm.age), deviceId }),
      });
      await afterAuth(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    setError('');
    setBusy(true);
    try {
      const deviceId = getDeviceId();
      const { user: u } = await api('/api/users/login', {
        method: 'POST',
        body: JSON.stringify({ ...loginForm, deviceId }),
      });
      await afterAuth(u);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinPublicRoom(roomId) {
    setBusy(true);
    setError('');
    try {
      const { room } = await api('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({
          roomId,
          userId: user.id,
          userName: user.name,
          deviceId: user.deviceId || getDeviceId(),
          userColor: user.color,
        }),
      });
      await refreshRooms(user.id);
      await refreshPublicRooms();
      await loadRoom(room.id);
      setView('room');
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
      setError('');
      // Soft confirm for sender
      setToastNudge({
        id: `local_${Date.now()}`,
        fromName: 'Sent',
        roomName: roomDetail?.room?.teamName || 'Room',
        note: 'Your teammate will see a notification in Brain Aid.',
        local: true,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function dismissNotifications(opts = {}) {
    if (!user?.id) return;
    try {
      await api('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, ...opts }),
      });
      setNotifications((prev) => {
        if (opts.nudgeIds?.length) {
          return prev.filter((n) => !opts.nudgeIds.includes(n.id));
        }
        if (opts.roomId) return prev.filter((n) => n.roomId !== opts.roomId);
        return [];
      });
      setToastNudge(null);
    } catch {
      /* ignore */
    }
  }

  function openNudge(n) {
    dismissNotifications({ nudgeIds: [n.id] });
    if (n.roomId) {
      loadRoom(n.roomId)
        .then(() => setView('room'))
        .catch((e) => setError(e.message));
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

  function beginSession(mode, topic) {
    const withPassages = attachPassagesToTopic(topic);
    setSession({
      mode,
      topic: withPassages,
      cardIdx: 0,
      flipped: false,
      found: [],
      toast: '',
      quizIdx: 0,
      quizPick: null,
      quizScore: 0,
      explainText: '',
      explainDone: false,
      openIdx: 0,
      openText: '',
      openAnswers: [],
      showPassageTutorial: !loadPassageTipSeen() && hasAnyPassage(withPassages),
      chatMessages: [
        {
          role: 'assistant',
          content:
            'Ask me anything about your uploaded materials for this topic. I only answer from that PDF/notes text.',
        },
      ],
      chatInput: '',
      chatBusy: false,
      media: null,
      mediaLoading: false,
      mediaError: '',
      videoIdx: 0,
      videoPlaying: false,
    });
    setView('session');
  }

  function startSession(mode) {
    const topic = topicById(roomDetail.room.topicId) || roomDetail?.topic;
    if (!topic) {
      setError('Topic pack missing — recreate the room or pick a built-in topic.');
      return;
    }
    if (mode === 'quiz' && !(topic.quiz || []).length) {
      setError('This topic has no checkpoint quiz yet.');
      return;
    }
    if (isPremiumMethod(mode) && !premium) {
      setPendingPremiumMethod(mode);
      setPremiumModal(true);
      return;
    }
    beginSession(mode, topic);
  }

  function unlockPremium() {
    savePremium(true);
    setPremium(true);
    setPremiumModal(false);
    const mode = pendingPremiumMethod;
    setPendingPremiumMethod(null);
    if (mode && roomDetail) {
      const topic = topicById(roomDetail.room.topicId) || roomDetail?.topic;
      if (topic) beginSession(mode, topic);
    }
  }

  async function finishSession() {
    const payload = {
      action: 'completeSession',
      userId: user.id,
      mode: session.mode,
    };
    if (session.mode === 'quiz') {
      payload.score = session.quizScore;
      payload.total = session.topic.quiz?.length || 0;
    }
    if (session.mode === 'openQ') {
      payload.meta = { answers: session.openAnswers || [] };
    }
    if (session.mode === 'aiChat') {
      payload.meta = {
        turns: (session.chatMessages || []).filter((m) => m.role === 'user').length,
      };
    }
    await api(`/api/rooms/${activeRoomId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setSession(null);
    await loadRoom(activeRoomId);
    await refreshFriends(user.id);
    setView('room');
  }

  const myNudges = useMemo(() => {
    if (!roomDetail || !user) return [];
    return (roomDetail.nudges || [])
      .filter((n) => n.toUserId === user.id && !n.read)
      .slice(-5)
      .reverse();
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
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        registerForm={registerForm}
        setRegisterForm={setRegisterForm}
        loginForm={loginForm}
        setLoginForm={setLoginForm}
        busy={busy}
        error={error}
        onRegister={register}
        onLogin={login}
      />
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
            <span>
              @{user.username || user.id.slice(0, 10)}
              {user.country ? ` · ${user.country}` : ''}
            </span>
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
              {id === 'rooms' && notifications.length > 0 ? (
                <span className="nav-badge">{notifications.length}</span>
              ) : null}
            </button>
          ))}
        </nav>
        {notifications.length > 0 && (
          <div className="nudge-inbox">
            <p className="eyebrow">Nudges</p>
            {notifications.slice(0, 4).map((n) => (
              <button key={n.id} type="button" className="nudge-inbox-item" onClick={() => openNudge(n)}>
                <strong>{n.fromName}</strong>
                <span>
                  {n.roomName}: {n.note}
                </span>
              </button>
            ))}
            <button type="button" className="btn sm ghost" onClick={() => dismissNotifications({})}>
              Clear all
            </button>
          </div>
        )}
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

        {toastNudge && !toastNudge.local && (
          <div className="nudge-toast" role="status">
            <div>
              <strong>Nudge from {toastNudge.fromName}</strong>
              <p>
                {toastNudge.roomName}: {toastNudge.note}
              </p>
            </div>
            <div className="actions" style={{ marginTop: 0 }}>
              <button type="button" className="btn sm primary" onClick={() => openNudge(toastNudge)}>
                Open room
              </button>
              <button
                type="button"
                className="btn sm"
                onClick={() => dismissNotifications({ nudgeIds: [toastNudge.id] })}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {toastNudge?.local && (
          <div className="nudge-toast sent" role="status">
            <div>
              <strong>{toastNudge.fromName}</strong>
              <p>{toastNudge.note}</p>
            </div>
            <button type="button" className="btn sm" onClick={() => setToastNudge(null)}>
              OK
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
                      {r.visibility === 'public' ? ' · public' : ' · private'}
                    </p>
                    {r.audience?.blurb ? <p className="muted-line">{r.audience.blurb}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty" style={{ marginBottom: 18 }}>
                No rooms yet.
              </div>
            )}

            <div style={{ margin: '22px 0 12px' }}>
              <p className="eyebrow">Discover</p>
              <h3 style={{ margin: '0 0 10px' }}>Public rooms</h3>
              {publicRooms.length ? (
                publicRooms.map((r) => (
                  <div key={r.id} className="card" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <span className="pill">public</span>
                        <h3 style={{ marginTop: 8 }}>{r.teamName}</h3>
                        <p>{topicById(r.topicId)?.title || r.topicId}</p>
                        <p className="muted-line">{r.audience?.blurb || 'Open to everyone'}</p>
                      </div>
                      <button
                        type="button"
                        className="btn primary sm"
                        disabled={busy || (user && r.memberIds?.includes(user.id))}
                        onClick={() => {
                          if (r.memberIds?.includes(user.id)) {
                            loadRoom(r.id).then(() => setView('room'));
                          } else {
                            joinPublicRoom(r.id);
                          }
                        }}
                      >
                        {r.memberIds?.includes(user.id) ? 'Open' : 'Join'}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">No public rooms yet.</div>
              )}
            </div>

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
                <label>Room type</label>
                <div className="chips">
                  {[
                    ['private', 'Private'],
                    ['public', 'Public'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`chip ${createForm.visibility === id ? 'on' : ''}`}
                      onClick={() => setCreateForm({ ...createForm, visibility: id })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="muted-line" style={{ marginTop: 8 }}>
                  Public rooms appear in Discover and anyone can join. Private needs an invite code.
                </p>
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
                      {m.premium ? ' · $5' : ''}
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
            topic={topicById(roomDetail.room.topicId) || roomDetail.topic}
            myNudges={myNudges}
            chatText={chatText}
            setChatText={setChatText}
            onSendChat={sendRoomChat}
            onNudge={sendNudge}
            onStart={startSession}
            onOpenChat={() => setView('chat')}
            onClearNudges={() => dismissNotifications({ roomId: roomDetail.room.id })}
            premium={premium}
            onUnlockPremium={() => {
              setPendingPremiumMethod(null);
              setPremiumModal(true);
            }}
          />
        )}

        {premiumModal && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal-card">
              <p className="eyebrow">Premium</p>
              <h2 style={{ marginTop: 0 }}>Premium practice — ${PREMIUM_PRICE_USD}</h2>
              <p>
                Free keeps flashcards, error hunt, and checkpoint quizzes. Premium adds AI tools
                grounded in your uploaded PDF/notes.
              </p>
              <ul className="premium-list">
                <li>AI chat about your materials</li>
                <li>Video explanation scenes from your PDF</li>
                <li>Photo schemes / diagrams from your notes</li>
              </ul>
              <div className="actions">
                <button type="button" className="btn ghost" onClick={() => setPremiumModal(false)}>
                  Stay on free
                </button>
                <button type="button" className="btn primary" onClick={unlockPremium}>
                  Unlock for ${PREMIUM_PRICE_USD}
                </button>
              </div>
              <p className="muted-line" style={{ marginTop: 10 }}>
                Demo checkout — no real payment in this hackathon build.
              </p>
            </div>
          </div>
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
  onClearNudges,
  premium,
  onUnlockPremium,
}) {
  const { room, members } = detail;
  const publicOrigin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  ).replace(/\/$/, '');
  const inviteUrl = `${publicOrigin}/join/${room.inviteCode}`;

  const methodIds = [...new Set([...(room.methods || []), 'quiz', 'flashcards', 'errorHunt', 'aiChat', 'videoExplain', 'photoSchemes'])];
  const freeMethods = methodIds.filter((id) => {
    const m = METHODS.find((x) => x.id === id);
    return m && !m.premium;
  });
  const premiumMethods = methodIds.filter((id) => METHODS.find((x) => x.id === id)?.premium);

  return (
    <>
      <div className="topbar">
        <div>
          <p className="eyebrow">{room.teamName}</p>
          <h1>{topic?.title || 'Room'}</h1>
          <p>
            {room.period} days · {members.length} people
            {premium ? ' · Premium' : ' · Free'}
          </p>
        </div>
        <button type="button" className="btn blue" onClick={onOpenChat}>
          Chat
        </button>
      </div>

      <div className="invite-box" style={{ marginBottom: 14 }}>
        <span>{room.visibility === 'public' ? 'Public' : 'Invite'}:</span>
        <code>{room.inviteCode}</code>
        <button
          type="button"
          className="btn sm"
          onClick={() => navigator.clipboard?.writeText(inviteUrl)}
        >
          Copy link
        </button>
      </div>
      {(detail.audience || room.audience) && (
        <div className="audience-card">
          <p className="eyebrow">Who&apos;s learning here</p>
          <p>{(detail.audience || room.audience).blurb}</p>
        </div>
      )}

      {myNudges.length > 0 && (
        <div className="banner nudge-banner">
          <div>
            <strong>New nudges</strong>
            <p style={{ margin: '4px 0 0' }}>
              {myNudges.map((n) => `${n.fromName}: ${n.note}`).join(' · ')}
            </p>
          </div>
          <button type="button" className="btn sm" onClick={onClearNudges}>
            Mark read
          </button>
        </div>
      )}

      <TeamTimeline room={room} members={members} onStartQuiz={() => onStart('quiz')} />
      <SponsorStrip room={room} members={members} />

      <div className="split room-simple">
        <div>
          <div className="card" style={{ marginBottom: 12 }}>
            <p className="eyebrow">Practice</p>
            <div className="mode-grid">
              {freeMethods.map((id) => {
                const m = METHODS.find((x) => x.id === id);
                if (!m) return null;
                return (
                  <button key={id} type="button" className="mode-btn" onClick={() => onStart(id)}>
                    <strong>{m.label}</strong>
                    <span>{m.blurb}</span>
                  </button>
                );
              })}
            </div>
            <div className="premium-row">
              <p className="eyebrow">Premium · ${PREMIUM_PRICE_USD}</p>
              {!premium && (
                <button type="button" className="btn sm" onClick={onUnlockPremium}>
                  Unlock
                </button>
              )}
            </div>
            <div className="mode-grid">
              {premiumMethods.map((id) => {
                const m = METHODS.find((x) => x.id === id);
                if (!m) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`mode-btn premium ${premium ? '' : 'locked'}`}
                    onClick={() => onStart(id)}
                  >
                    <strong>{m.label}</strong>
                    <span>{premium ? m.blurb : `Locked · $${PREMIUM_PRICE_USD}`}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Room chat</p>
            <div className="chat" style={{ maxHeight: 160 }}>
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
          <div className="card">
            <p className="eyebrow">Team</p>
            {members.map((m) => {
              const sessions = room.sessionsByUser?.[m.id] || [];
              const pts = memberPoints(sessions);
              return (
                <div key={m.id} className="member-row">
                  {avatar(m.name, m.color, 34)}
                  <div className="meta">
                    <strong>
                      {m.name}
                      {m.id === user.id ? ' (you)' : ''}
                    </strong>
                    <span>
                      {pts} pts · {sessions.length} sessions
                    </span>
                  </div>
                  {m.id !== user.id && (
                    <button type="button" className="btn sm pink" onClick={() => onNudge(m.id)}>
                      Nudge
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

function hasAnyPassage(topic) {
  if (!topic) return false;
  if (topic.explainSourcePassage) return true;
  return (
    (topic.flashcards || []).some((c) => c.sourcePassage) ||
    (topic.quiz || []).some((q) => q.sourcePassage) ||
    (topic.openQuestions || []).some((q) => q.sourcePassage)
  );
}

function QuestionWithCite({ children, passage }) {
  return (
    <div className="question-with-cite">
      <div className="question-with-cite-text">{children}</div>
      <PassageCite passage={passage} />
    </div>
  );
}

function SessionView({ session, setSession, onExit, onFinish }) {
  const { mode, topic } = session;

  function dismissPassageTutorial() {
    savePassageTipSeen();
    setSession({ ...session, showPassageTutorial: false });
  }

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
        {mode === 'aiChat' && (
          <AiChatSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
        {mode === 'videoExplain' && (
          <VideoExplainSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
        {mode === 'photoSchemes' && (
          <PhotoSchemesSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
        {mode === 'openQ' && (
          <OpenQuestionSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
        {mode === 'explain' && (
          <ExplainSession session={session} setSession={setSession} onFinish={onFinish} />
        )}
      </div>
      {session.showPassageTutorial && <PassageTutorial onDismiss={dismissPassageTutorial} />}
    </>
  );
}

function FlashSession({ session, setSession, onFinish }) {
  const card = session.topic.flashcards[session.cardIdx];
  const last = session.cardIdx >= session.topic.flashcards.length - 1;
  return (
    <>
      <div className="flash-cite-row">
        <span className="muted-line">
          Card {session.cardIdx + 1}/{session.topic.flashcards.length}
        </span>
        <PassageCite passage={card.sourcePassage} />
      </div>
      <button
        type="button"
        className={`flash ${session.flipped ? 'is-flipped' : ''}`}
        onClick={() => setSession({ ...session, flipped: !session.flipped })}
      >
        <div className="flash-face front">
          <span>Prompt</span>
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
  const quiz = topic.quiz || [];
  if (quizIdx >= quiz.length) {
    const pct = quiz.length ? Math.round((quizScore / quiz.length) * 100) : 0;
    return (
      <>
        <p className="eyebrow">Checkpoint complete</p>
        <h3>
          You scored {quizScore}/{quiz.length} ({pct}%)
        </h3>
        <p className="muted-line">
          Submit to post this run on the team leaderboard — teammates will see who did better.
        </p>
        <button type="button" className="btn primary" onClick={onFinish}>
          Post to team board
        </button>
      </>
    );
  }
  const item = quiz[quizIdx];
  return (
    <>
      <p className="eyebrow">
        Checkpoint · Q{quizIdx + 1}/{quiz.length}
      </p>
      <QuestionWithCite passage={item.sourcePassage}>
        <h3 style={{ marginBottom: 0, marginTop: 0 }}>{item.q}</h3>
      </QuestionWithCite>
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



function VideoExplainSession({ session, setSession, onFinish }) {
  const { topic, media, mediaLoading, mediaError, videoIdx, videoPlaying } = session;

  async function load() {
    if (mediaLoading) return;
    setSession({ ...session, mediaLoading: true, mediaError: '' });
    try {
      const data = await api('/api/topics/media', {
        method: 'POST',
        body: JSON.stringify({ kind: 'videoExplain', topicId: topic.id, topic }),
      });
      setSession((prev) => ({
        ...prev,
        media: data,
        mediaLoading: false,
        videoIdx: 0,
        videoPlaying: false,
      }));
    } catch (e) {
      setSession((prev) => ({
        ...prev,
        mediaLoading: false,
        mediaError: e.message || 'Could not build video',
      }));
    }
  }

  if (!media && !mediaLoading) {
    return (
      <>
        <p className="eyebrow">Premium · Video explanation</p>
        <h3>Narrated scenes from your materials</h3>
        <p className="muted-line">Built only from this topic&apos;s PDF/notes — not the open web.</p>
        {mediaError && <p className="toast bad">{mediaError}</p>}
        <button type="button" className="btn primary" onClick={load}>
          Generate video scenes
        </button>
      </>
    );
  }
  if (mediaLoading) {
    return (
      <>
        <p className="eyebrow">Premium · Video explanation</p>
        <h3>Generating scenes…</h3>
      </>
    );
  }

  const scenes = media.scenes || [];
  const scene = scenes[videoIdx] || scenes[0];
  const last = videoIdx >= scenes.length - 1;

  return (
    <>
      <p className="eyebrow">Premium · Video explanation</p>
      <h3 style={{ marginTop: 0 }}>{media.title}</h3>
      <div className="video-stage">
        <div className="video-screen">
          <span className="video-badge">
            Scene {videoIdx + 1}/{scenes.length}
          </span>
          <strong>{scene.title}</strong>
          <p className="video-onscreen">{scene.onScreen}</p>
        </div>
        <p className="video-narration">{scene.narration}</p>
      </div>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <button
          type="button"
          className="btn sm"
          disabled={videoIdx === 0}
          onClick={() => setSession({ ...session, videoIdx: videoIdx - 1, videoPlaying: false })}
        >
          Prev
        </button>
        {!last ? (
          <button
            type="button"
            className="btn primary sm"
            onClick={() => setSession({ ...session, videoIdx: videoIdx + 1 })}
          >
            Next scene
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={onFinish}>
            Finish
          </button>
        )}
      </div>
    </>
  );
}

function PhotoSchemesSession({ session, setSession, onFinish }) {
  const { topic, media, mediaLoading, mediaError } = session;

  async function load() {
    if (mediaLoading) return;
    setSession({ ...session, mediaLoading: true, mediaError: '', media: null });
    try {
      const data = await api('/api/topics/media', {
        method: 'POST',
        body: JSON.stringify({ kind: 'photoSchemes', topicId: topic.id, topic }),
      });
      setSession((prev) => ({ ...prev, media: data, mediaLoading: false }));
    } catch (e) {
      setSession((prev) => ({
        ...prev,
        mediaLoading: false,
        mediaError: e.message || 'Could not build scheme',
      }));
    }
  }

  if (!media && !mediaLoading) {
    return (
      <>
        <p className="eyebrow">Premium · Photo schemes</p>
        <h3>Diagram from your notes</h3>
        <p className="muted-line">A labeled scheme grounded only in your uploaded materials.</p>
        {mediaError && <p className="toast bad">{mediaError}</p>}
        <button type="button" className="btn primary" onClick={load}>
          Generate scheme
        </button>
      </>
    );
  }
  if (mediaLoading) {
    return (
      <>
        <p className="eyebrow">Premium · Photo schemes</p>
        <h3>Drawing scheme…</h3>
      </>
    );
  }

  const nodes = media.nodes || [];
  const edges = media.edges || [];

  return (
    <>
      <p className="eyebrow">Premium · Photo schemes</p>
      <h3 style={{ marginTop: 0 }}>{media.title}</h3>
      {media.caption && <p className="muted-line">{media.caption}</p>}
      <div className="scheme-board">
        {nodes.map((n, i) => (
          <div key={n.id} className="scheme-node" style={{ '--i': i }}>
            <strong>{n.label}</strong>
            {n.detail ? <span>{n.detail}</span> : null}
          </div>
        ))}
      </div>
      {edges.length > 0 && (
        <ul className="scheme-edges">
          {edges.map((e, i) => {
            const from = nodes.find((n) => n.id === e.from)?.label || e.from;
            const to = nodes.find((n) => n.id === e.to)?.label || e.to;
            return (
              <li key={i}>
                {from} → {to}
                {e.label ? ` (${e.label})` : ''}
              </li>
            );
          })}
        </ul>
      )}
      <div className="actions">
        <button type="button" className="btn sm" onClick={load}>
          Regenerate
        </button>
        <button type="button" className="btn primary" onClick={onFinish}>
          Finish
        </button>
      </div>
    </>
  );
}

function AiChatSession({ session, setSession, onFinish }) {
  const { topic, chatMessages, chatInput, chatBusy } = session;

  async function send() {
    const text = (chatInput || '').trim();
    if (!text || chatBusy) return;
    const nextMessages = [...(chatMessages || []), { role: 'user', content: text }];
    setSession({ ...session, chatMessages: nextMessages, chatInput: '', chatBusy: true });
    try {
      const data = await api('/api/topics/chat', {
        method: 'POST',
        body: JSON.stringify({
          topicId: topic.id,
          topic,
          messages: nextMessages.filter((m) => m.role === 'user' || m.role === 'assistant'),
        }),
      });
      setSession((prev) => ({
        ...prev,
        chatMessages: [...nextMessages, { role: 'assistant', content: data.reply }],
        chatBusy: false,
      }));
    } catch (e) {
      setSession((prev) => ({
        ...prev,
        chatMessages: [
          ...nextMessages,
          { role: 'assistant', content: `Sorry — ${e.message || 'chat failed'}.` },
        ],
        chatBusy: false,
      }));
    }
  }

  return (
    <>
      <p className="eyebrow">Premium AI tutor</p>
      <h3 style={{ marginTop: 0 }}>Ask about your materials</h3>
      <p className="muted-line" style={{ marginBottom: 10 }}>
        Grounded only in this topic&apos;s uploaded PDF/notes — not the open web.
      </p>
      <div className="ai-chat">
        {(chatMessages || []).map((m, i) => (
          <div key={i} className={`ai-bubble ${m.role}`}>
            <strong>{m.role === 'user' ? 'You' : 'Tutor'}</strong>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          style={{ flex: 1 }}
          value={chatInput}
          disabled={chatBusy}
          onChange={(e) => setSession({ ...session, chatInput: e.target.value })}
          placeholder="e.g. What does the PDF say about…?"
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button type="button" className="btn primary sm" disabled={chatBusy || !chatInput?.trim()} onClick={send}>
          {chatBusy ? '…' : 'Ask'}
        </button>
      </div>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onFinish}>
          Finish chat session
        </button>
      </div>
    </>
  );
}

function OpenQuestionSession({ session, setSession, onFinish }) {
  const { topic, openIdx, openText, openAnswers } = session;
  const questions = topic.openQuestions || [];
  if (!questions.length) {
    return (
      <>
        <h3>No open questions on this topic</h3>
        <button type="button" className="btn primary" onClick={onFinish}>
          Back
        </button>
      </>
    );
  }
  if (openIdx >= questions.length) {
    return (
      <>
        <p className="eyebrow">AI learning evidence</p>
        <h3>Open questions complete</h3>
        <p className="muted-line">
          Your written answers are saved with this session as proof of reflective learning.
        </p>
        <ul className="open-recap">
          {openAnswers.map((a, i) => (
            <li key={i}>
              <strong>{a.q}</strong>
              <span>{a.text}</span>
              <em>Keywords hit: {a.hits?.join(', ') || 'none'}</em>
            </li>
          ))}
        </ul>
        <button type="button" className="btn primary" onClick={onFinish}>
          Save session
        </button>
      </>
    );
  }
  const item = questions[openIdx];
  return (
    <>
      <p className="eyebrow">
        Open question · {openIdx + 1}/{questions.length}
      </p>
      <QuestionWithCite passage={item.sourcePassage}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>{item.q}</h3>
      </QuestionWithCite>
      <p className="muted-line">{item.guidance}</p>
      <div className="field">
        <textarea
          value={openText}
          onChange={(e) => setSession({ ...session, openText: e.target.value })}
          placeholder="Write your answer…"
          rows={5}
        />
      </div>
      <button
        type="button"
        className="btn primary"
        disabled={openText.trim().length < 12}
        onClick={() => {
          const lower = openText.toLowerCase();
          const hits = (item.keywords || []).filter((k) => lower.includes(String(k).toLowerCase()));
          setSession({
            ...session,
            openAnswers: [
              ...openAnswers,
              { q: item.q, text: openText.trim(), hits, at: Date.now() },
            ],
            openIdx: openIdx + 1,
            openText: '',
          });
        }}
      >
        Submit answer
      </button>
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
      <QuestionWithCite passage={topic.explainSourcePassage}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>{topic.explainPrompt}</h3>
      </QuestionWithCite>
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
