import { AuthError } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useLocation, useNavigate } from "react-router-dom";
import {
  addComment,
  addProgress,
  createSession,
  joinSession,
  listComments,
  listMembers,
  listMyMembershipSessionIds,
  listProfiles,
  listProgress,
  listReactions,
  listSessions,
  removeProfileAvatarByUrl,
  toggleReaction,
  uploadProfileAvatar,
  upsertProfile,
} from "./lib/api";
import { hasSupabaseEnv, supabase } from "./lib/supabase";
import type {
  CommentReaction,
  DiscussionComment,
  Profile,
  ProgressUpdate,
  ReadingSession,
} from "./lib/types";
import {
  defaultLanguage,
  isLanguage,
  languageLabels,
  languages,
  translate,
} from "./i18n";

const emojiOptions = ["👍", "❤️", "🔥", "👏", "🤯", "📚"];

function getDefaultDisplayName(userLike: {
  email?: string | null;
  id: string;
}) {
  const prefix = userLike.email?.split("@")[0]?.trim();
  return prefix
    ? `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}`
    : `Member-${userLike.id.slice(0, 6)}`;
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [reactions, setReactions] = useState<CommentReaction[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [errorMessage, setErrorMessage] = useState("");
  const [language, setLanguage] = useState<"en" | "bo">(() => {
    const stored = localStorage.getItem("BOOKCLUB_LANGUAGE");
    return isLanguage(stored) ? stored : defaultLanguage;
  });
  const [isBusy, setIsBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalChapters, setTotalChapters] = useState(12);
  const [chapterInput, setChapterInput] = useState(1);
  const [commentInput, setCommentInput] = useState("");
  const [customEmojiByComment, setCustomEmojiByComment] = useState<
    Record<string, string>
  >({});
  const [joinedSessionIds, setJoinedSessionIds] = useState<string[]>([]);
  const [showProfile, setShowProfile] = useState(false);
  const [profileNameInput, setProfileNameInput] = useState("");
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarObjectUrl, setProfileAvatarObjectUrl] = useState<
    string | null
  >(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
  const detailMatch = normalizedPath.match(/^\/session\/([^/]+)$/);
  const detailSessionId = detailMatch?.[1] ?? null;
  const isSessionsRoute = normalizedPath === "/session";
  const isDetailRoute = Boolean(detailSessionId);

  useEffect(() => {
    localStorage.setItem("BOOKCLUB_LANGUAGE", language);
  }, [language]);

  const t = useMemo(
    () => (key: string, params?: Record<string, string | number>) =>
      translate(key, language, params),
    [language],
  );

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const latestProgressByUser = useMemo(() => {
    const map = new Map<string, ProgressUpdate>();
    progress.forEach((entry) => {
      if (!map.has(entry.user_id)) map.set(entry.user_id, entry);
    });
    return map;
  }, [progress]);

  const progressBoard = useMemo(() => {
    if (!activeSession) return [];
    return members.map((memberId) => {
      const current = latestProgressByUser.get(memberId)?.current_chapter ?? 0;
      const percent = Math.round(
        (current / activeSession.total_chapters) * 100,
      );
      return { memberId, current, percent };
    });
  }, [activeSession, members, latestProgressByUser]);

  const reactionCountByCommentEmoji = useMemo(() => {
    const counter = new Map<string, number>();
    reactions.forEach((reaction) => {
      const key = `${reaction.comment_id}__${reaction.emoji}`;
      counter.set(key, (counter.get(key) ?? 0) + 1);
    });
    return counter;
  }, [reactions]);

  const displayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(profiles).forEach((profile) => {
      map.set(
        profile.id,
        profile.display_name ?? `Member ${profile.id.slice(0, 6)}`,
      );
    });
    return map;
  }, [profiles]);

  function getDisplayName(userId: string) {
    if (userId === user?.id) return "You";
    return displayNameMap.get(userId) ?? `Member ${userId.slice(0, 6)}`;
  }

  const myDisplayName = user
    ? (displayNameMap.get(user.id) ?? getDefaultDisplayName(user))
    : "";
  const myAvatarUrl = user ? (profiles[user.id]?.avatar_url ?? null) : null;

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        await upsertProfile({
          userId: data.user.id,
          displayName: getDefaultDisplayName(data.user),
        });
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        await upsertProfile({
          userId: nextUser.id,
          displayName: getDefaultDisplayName(nextUser),
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshSessions().catch(handleError);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    listProfiles([user.id])
      .then((rows) => {
        if (rows.length === 0) return;
        setProfiles((previous) => ({
          ...previous,
          [rows[0].id]: rows[0],
        }));
      })
      .catch(() => {
        // Do not block core flows (sessions/progress/comments) if profile policy is not applied yet.
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (profileAvatarObjectUrl) {
      URL.revokeObjectURL(profileAvatarObjectUrl);
      setProfileAvatarObjectUrl(null);
    }
    setProfileNameInput(myDisplayName);
    setProfileAvatarPreview(myAvatarUrl ?? "");
    setProfileAvatarFile(null);
    setRemoveAvatar(false);
  }, [user, myDisplayName, myAvatarUrl]);

  useEffect(() => {
    return () => {
      if (profileAvatarObjectUrl) URL.revokeObjectURL(profileAvatarObjectUrl);
    };
  }, [profileAvatarObjectUrl]);

  useEffect(() => {
    if (!activeSessionId || !user) return;
    refreshSessionDetails(activeSessionId).catch(handleError);
  }, [activeSessionId, user]);

  useEffect(() => {
    if (!detailSessionId) return;
    setActiveSessionId(detailSessionId);
  }, [detailSessionId]);

  useEffect(() => {
    if (!hasSupabaseEnv) return;
    if (!user) {
      if (normalizedPath !== "/auth") navigate("/auth", { replace: true });
      return;
    }

    if (normalizedPath === "/" || normalizedPath === "/auth") {
      navigate("/session", { replace: true });
      return;
    }

    if (!isSessionsRoute && !isDetailRoute) {
      navigate("/session", { replace: true });
    }
  }, [user, normalizedPath, isSessionsRoute, isDetailRoute, navigate]);

  function handleError(error: unknown) {
    const message =
      error instanceof AuthError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Something went wrong.";
    setErrorMessage(message);
  }

  async function refreshSessions() {
    const loaded = await listSessions();
    setSessions(loaded);
    if (user) {
      try {
        const mine = await listMyMembershipSessionIds(user.id);
        setJoinedSessionIds(mine);
      } catch {
        setJoinedSessionIds([]);
      }
    }
    if (!activeSessionId && loaded.length > 0) setActiveSessionId(loaded[0].id);
  }

  async function refreshSessionDetails(sessionId: string) {
    const [memberRows, progressRows, commentRows] = await Promise.all([
      listMembers(sessionId),
      listProgress(sessionId),
      listComments(sessionId),
    ]);
    const memberIds = memberRows.map((row) => row.user_id);
    setMembers(memberIds);
    setProgress(progressRows);
    setComments(commentRows);

    const loadedReactions = await listReactions(
      commentRows.map((item) => item.id),
    );
    setReactions(loadedReactions);

    const profileIds = Array.from(
      new Set([
        ...memberIds,
        ...commentRows.map((item) => item.user_id),
        ...loadedReactions.map((item) => item.user_id),
      ]),
    );
    try {
      const profileRows = await listProfiles(profileIds);
      setProfiles((previous) => {
        const next = { ...previous };
        profileRows.forEach((profile) => {
          next[profile.id] = profile;
        });
        return next;
      });
    } catch {
      // Keep session detail usable even if profile read policy is missing.
    }
  }

  async function handleAuthSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage("");
    setIsBusy(true);
    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user) {
          await upsertProfile({
            userId: data.user.id,
            displayName: getDefaultDisplayName(data.user),
          });
        }
        navigate("/session");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data.user) {
          await upsertProfile({
            userId: data.user.id,
            displayName: getDefaultDisplayName(data.user),
          });
        }
        navigate("/session");
      }
    } catch (error) {
      handleError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (!title.trim() || !author.trim()) {
      setErrorMessage(t("book_fields_required"));
      return;
    }
    if (!Number.isInteger(totalChapters) || totalChapters < 1) {
      setErrorMessage(t("total_chapters_required"));
    }

    setErrorMessage("");
    setIsBusy(true);
    try {
      const created = await createSession({
        hostUserId: user.id,
        title: title.trim(),
        author: author.trim(),
        totalChapters,
      });
      setSessions((previous) => [created, ...previous]);
      setActiveSessionId(created.id);
      await joinSession(created.id, user.id);
      setJoinedSessionIds((previous) =>
        previous.includes(created.id) ? previous : [...previous, created.id],
      );
      setTitle("");
      setAuthor("");
      setTotalChapters(12);
      await refreshSessions().catch(() => {
        // Keep newly created session visible even if refresh request fails.
      });
      await refreshSessionDetails(created.id).catch(() => {
        // Session creation should still complete even if details fail to load.
      });
      navigate(`/session/${created.id}`);
    } catch (error) {
      handleError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleJoinSession() {
    if (!user || !activeSession) return;
    setErrorMessage("");
    setIsBusy(true);
    try {
      await joinSession(activeSession.id, user.id);
      setJoinedSessionIds((previous) =>
        previous.includes(activeSession.id)
          ? previous
          : [...previous, activeSession.id],
      );
      await refreshSessionDetails(activeSession.id);
    } catch (error) {
      handleError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleProgressSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !activeSession) return;
    setErrorMessage("");
    setIsBusy(true);
    try {
      const chapter = Math.max(
        0,
        Math.min(activeSession.total_chapters, chapterInput),
      );
      await addProgress(activeSession.id, user.id, chapter);
      await refreshSessionDetails(activeSession.id);
    } catch (error) {
      handleError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCommentSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || !activeSession || !commentInput.trim()) return;
    setErrorMessage("");
    setIsBusy(true);
    try {
      await addComment(activeSession.id, user.id, commentInput.trim());
      setCommentInput("");
      await refreshSessionDetails(activeSession.id);
    } catch (error) {
      handleError(error);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReaction(commentId: string, emoji: string) {
    if (!user || !activeSession) return;
    setErrorMessage("");
    try {
      await toggleReaction(commentId, user.id, emoji);
      await refreshSessionDetails(activeSession.id);
    } catch (error) {
      handleError(error);
    }
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) handleError(error);
    setActiveSessionId(null);
    setComments([]);
    setMembers([]);
    setProgress([]);
    setReactions([]);
    setProfiles({});
    navigate("/auth");
  }

  async function handleProfileSave(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    const nextName = profileNameInput.trim();
    if (!nextName) {
      setErrorMessage("Display name cannot be empty.");
      return;
    }
    setErrorMessage("");
    setIsBusy(true);
    try {
      const currentAvatarUrl = profiles[user.id]?.avatar_url ?? null;
      let nextAvatarUrl = currentAvatarUrl;
      if (profileAvatarFile) {
        nextAvatarUrl = await uploadProfileAvatar({
          userId: user.id,
          file: profileAvatarFile,
        });
        if (currentAvatarUrl && currentAvatarUrl !== nextAvatarUrl) {
          await removeProfileAvatarByUrl(currentAvatarUrl).catch(() => {
            // Upload succeeded; keep profile save resilient if old avatar cleanup fails.
          });
        }
      } else if (removeAvatar) {
        nextAvatarUrl = null;
        if (currentAvatarUrl) {
          await removeProfileAvatarByUrl(currentAvatarUrl).catch(() => {
            // Keep profile save resilient if storage cleanup fails.
          });
        }
      }

      await upsertProfile({
        userId: user.id,
        displayName: nextName,
        avatarUrl: nextAvatarUrl,
      });
      setProfiles((previous) => ({
        ...previous,
        [user.id]: {
          id: user.id,
          display_name: nextName,
          avatar_url: nextAvatarUrl,
        },
      }));
      setProfileAvatarFile(null);
      if (profileAvatarObjectUrl) {
        URL.revokeObjectURL(profileAvatarObjectUrl);
        setProfileAvatarObjectUrl(null);
      }
      setRemoveAvatar(false);
      setShowProfile(false);
    } catch (error) {
      handleError(error);
    } finally {
      setIsBusy(false);
    }
  }

  const isMember = user ? members.includes(user.id) : false;
  const myProgress = user
    ? (latestProgressByUser.get(user.id)?.current_chapter ?? 0)
    : 0;
  const progressPercent =
    activeSession && activeSession.total_chapters > 0
      ? Math.round((myProgress / activeSession.total_chapters) * 100)
      : 0;

  function renderAvatar(
    userId: string,
    displayName: string,
    className = "avatar",
  ) {
    const avatarUrl = profiles[userId]?.avatar_url;
    if (avatarUrl) {
      return (
        <img
          className={className}
          src={avatarUrl}
          alt={`${displayName} avatar`}
        />
      );
    }
    return (
      <span className={`${className} avatar-fallback`}>
        {getInitials(displayName)}
      </span>
    );
  }

  function closeProfileModal() {
    if (profileAvatarObjectUrl) {
      URL.revokeObjectURL(profileAvatarObjectUrl);
      setProfileAvatarObjectUrl(null);
    }
    setProfileAvatarFile(null);
    setProfileAvatarPreview(myAvatarUrl ?? "");
    setRemoveAvatar(false);
    setShowProfile(false);
  }

  if (!hasSupabaseEnv) {
    return (
      <main className="shell">
        <section className="card">
          <h1>{t("app_title")}</h1>
          <p>{t("env_setup")}</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <section className="card auth-card">
          <h1>{t("app_title")}</h1>
          <p>{t("tagline")}</p>
          <form onSubmit={handleAuthSubmit} className="form">
            <label>
              {t("email")}
              <input
                id="auth-email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
              />
            </label>
            <label>
              {t("password")}
              <input
                id="auth-password"
                name="password"
                autoComplete={
                  authMode === "signin" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                minLength={6}
                required
              />
            </label>
            <button type="submit" disabled={isBusy}>
              {isBusy
                ? t("please_wait")
                : authMode === "signin"
                  ? t("sign_in")
                  : t("create_account")}
            </button>
          </form>
          <button
            className="secondary-btn"
            onClick={() =>
              setAuthMode(authMode === "signin" ? "signup" : "signin")
            }
          >
            {authMode === "signin"
              ? t("need_account")
              : t("already_registered")}
          </button>
          {errorMessage && <p className="error">{errorMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        {isSessionsRoute ? (
          <div>
            <h1>{t("reading_sessions")}</h1>
            <p className="muted">{t("join_or_start")}</p>
          </div>
        ) : (
          <div>
            <h1>{activeSession?.book_title ?? t("session_details")}</h1>
            <p className="muted">
              {activeSession?.book_author ?? t("track_progress_discuss")}
            </p>
          </div>
        )}
        <div className="topbar-actions">
          <select
            className="language-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value as "en" | "bo")}
          >
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {languageLabels[lang]}
              </option>
            ))}
          </select>
          {isDetailRoute && (
            <button
              className="secondary-btn"
              type="button"
              onClick={() => navigate("/session")}
            >
              {t("back_to_sessions")}
            </button>
          )}
          <button
            className="secondary-btn profile-btn"
            type="button"
            onClick={() => setShowProfile(true)}
          >
            {renderAvatar(user.id, myDisplayName, "avatar avatar-sm")}
            <span>{t("my_profile")}</span>
          </button>
        </div>
      </header>

      {errorMessage && <p className="error sticky-error">{errorMessage}</p>}

      {isSessionsRoute ? (
        <section className="dashboard-grid">
          <aside className="card panel">
            <h2>{t("create_session")}</h2>
            <form onSubmit={handleCreateSession} className="form compact">
              <label>
                {t("book_title")}
                <input
                  id="book-title"
                  name="bookTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </label>
              <label>
                {t("author")}
                <input
                  id="book-author"
                  name="bookAuthor"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  required
                />
              </label>
              <label>
                {t("total_chapters")}
                <input
                  id="total-chapters"
                  name="totalChapters"
                  type="number"
                  min={1}
                  value={totalChapters}
                  onChange={(e) => setTotalChapters(Number(e.target.value))}
                  required
                />
              </label>
              <button type="submit" disabled={isBusy}>
                {t("create_session")}
              </button>
            </form>
          </aside>

          <section className="card panel">
            <div className="panel-header">
              <h2>{t("active_sessions")}</h2>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => refreshSessions().catch(handleError)}
              >
                {t("refresh")}
              </button>
            </div>
            <div className="session-list">
              {sessions.map((session) => {
                const joined = joinedSessionIds.includes(session.id);
                return (
                  <article key={session.id} className="session-row">
                    <div>
                      <strong>{session.book_title}</strong>
                      <p>
                        {session.book_author} · {session.total_chapters}{" "}
                        {t("chapters")}
                      </p>
                      <small>{t("session_active")}</small>
                    </div>
                    <div className="session-row-actions">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setActiveSessionId(session.id);
                          navigate(`/session/${session.id}`);
                        }}
                      >
                        {t("view")}
                      </button>
                      {joined && (
                        <span className="pill joined-pill">
                          {t("joined_pill")}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
              {sessions.length === 0 && (
                <p className="muted">{t("no_sessions")}</p>
              )}
            </div>
          </section>
        </section>
      ) : (
        <section className="detail-shell">
          {!activeSession ? (
            <section className="card">
              <p>{t("select_session")}</p>
            </section>
          ) : (
            <>
              <section className="card detail-column">
                <div className="session-header">
                  <div>
                    <h2>{t("progress")}</h2>
                    <p>
                      {activeSession.book_title} ·{" "}
                      {activeSession.total_chapters} {t("chapters")}
                    </p>
                  </div>
                  {!isMember ? (
                    <button
                      type="button"
                      onClick={handleJoinSession}
                      disabled={isBusy}
                    >
                      {t("join_session")}
                    </button>
                  ) : (
                    <span className="pill joined-pill">{t("joined_pill")}</span>
                  )}
                </div>

                <section className="card inset">
                  <h3>{t("share_progress")}</h3>
                  {!isMember ? (
                    <p>{t("join_to_track")}</p>
                  ) : (
                    <>
                      <form onSubmit={handleProgressSubmit} className="form">
                        <label>
                          {t("current_chapter")}
                          <input
                            id="current-chapter"
                            name="currentChapter"
                            type="number"
                            min={0}
                            max={activeSession.total_chapters}
                            value={chapterInput}
                            onChange={(e) =>
                              setChapterInput(Number(e.target.value))
                            }
                            required
                          />
                        </label>
                        <button type="submit" disabled={isBusy}>
                          {t("share_progress")}
                        </button>
                      </form>
                      <div className="progress-meta">
                        <span>
                          {t("chapter_count", {
                            current: String(myProgress),
                            total: String(activeSession.total_chapters),
                          })}
                        </span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </>
                  )}
                </section>

                <div className="members-board">
                  {progressBoard.map((entry) => (
                    <article className="member-progress" key={entry.memberId}>
                      <header>
                        <div className="member-identity">
                          {renderAvatar(
                            entry.memberId,
                            getDisplayName(entry.memberId),
                            "avatar avatar-sm",
                          )}
                          <strong>{getDisplayName(entry.memberId)}</strong>
                        </div>
                        <small>
                          Chapter {entry.current} · {entry.percent}%
                        </small>
                      </header>
                      <div className="progress-track mini">
                        <div
                          className="progress-fill"
                          style={{ width: `${entry.percent}%` }}
                        />
                      </div>
                    </article>
                  ))}
                  {progressBoard.length === 0 && (
                    <p className="muted">{t("no_progress_entries")}</p>
                  )}
                </div>
              </section>

              <section className="card detail-column">
                <section className="card inset">
                  <h3>{t("comment_header")}</h3>
                  {!isMember ? (
                    <p>{t("join_to_post")}</p>
                  ) : (
                    <form onSubmit={handleCommentSubmit} className="form">
                      <textarea
                        id="comment-content"
                        name="commentContent"
                        rows={3}
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        required
                      />
                      <button type="submit" disabled={isBusy}>
                        {t("post_comment")}
                      </button>
                    </form>
                  )}
                </section>

                <div className="comment-list">
                  {comments.map((comment) => {
                    const customEmoji = customEmojiByComment[comment.id] ?? "";
                    return (
                      <article className="comment" key={comment.id}>
                        <header>
                          <div className="member-identity">
                            {renderAvatar(
                              comment.user_id,
                              getDisplayName(comment.user_id),
                              "avatar avatar-sm",
                            )}
                            <strong>{getDisplayName(comment.user_id)}</strong>
                          </div>
                          <small>
                            {new Date(comment.created_at).toLocaleString()}
                          </small>
                        </header>
                        <p>{comment.content}</p>
                        <div className="reaction-row">
                          {emojiOptions.map((emoji) => {
                            const key = `${comment.id}__${emoji}`;
                            const count =
                              reactionCountByCommentEmoji.get(key) ?? 0;
                            const selected = reactions.some(
                              (reaction) =>
                                reaction.comment_id === comment.id &&
                                reaction.user_id === user.id &&
                                reaction.emoji === emoji,
                            );
                            return (
                              <button
                                key={emoji}
                                type="button"
                                className={`emoji-btn ${selected ? "selected" : ""}`}
                                onClick={() =>
                                  handleReaction(comment.id, emoji)
                                }
                              >
                                {emoji} {count > 0 ? count : ""}
                              </button>
                            );
                          })}
                          {isMember && (
                            <>
                              <input
                                className="emoji-input"
                                name={`customEmoji-${comment.id}`}
                                maxLength={2}
                                placeholder="😀"
                                value={customEmoji}
                                onChange={(e) =>
                                  setCustomEmojiByComment((previous) => ({
                                    ...previous,
                                    [comment.id]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() => {
                                  if (!customEmoji.trim()) return;
                                  void handleReaction(
                                    comment.id,
                                    customEmoji.trim(),
                                  );
                                  setCustomEmojiByComment((previous) => ({
                                    ...previous,
                                    [comment.id]: "",
                                  }));
                                }}
                              >
                                {t("add_emoji")}
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {comments.length === 0 && (
                    <p className="muted">{t("no_comments")}</p>
                  )}
                </div>
              </section>
            </>
          )}
        </section>
      )}

      {showProfile && (
        <div className="profile-overlay" role="dialog" aria-modal="true">
          <section className="card profile-modal">
            <div className="panel-header">
              <h2>{t("my_profile")}</h2>
              <button
                type="button"
                className="secondary-btn"
                onClick={closeProfileModal}
              >
                {t("close")}
              </button>
            </div>
            <form className="form" onSubmit={handleProfileSave}>
              <div className="profile-avatar-editor">
                <div className="profile-avatar-preview">
                  {profileAvatarPreview ? (
                    <img
                      className="avatar avatar-lg"
                      src={profileAvatarPreview}
                      alt="Profile avatar preview"
                    />
                  ) : (
                    <span className="avatar avatar-lg avatar-fallback">
                      {getInitials(profileNameInput || myDisplayName)}
                    </span>
                  )}
                </div>
                <div className="profile-avatar-controls">
                  <div className="profile-avatar-meta">
                    <div className="profile-avatar-title">
                      {t("avatar_title")}
                    </div>
                    <p className="profile-avatar-hint">{t("avatar_hint")}</p>
                  </div>
                  <div className="profile-avatar-upload">
                    <label className="file-select-btn">
                      {t("choose_file")}
                      <input
                        id="profile-avatar"
                        name="avatarFile"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          const selected = event.target.files?.[0] ?? null;
                          if (!selected) return;
                          if (!selected.type.startsWith("image/")) {
                            setErrorMessage(t("invalid_image_file"));
                            return;
                          }
                          if (selected.size > 2 * 1024 * 1024) {
                            setErrorMessage(t("avatar_size_error"));
                            return;
                          }
                          setErrorMessage("");
                          setProfileAvatarFile(selected);
                          setRemoveAvatar(false);
                          const objectUrl = URL.createObjectURL(selected);
                          if (profileAvatarObjectUrl)
                            URL.revokeObjectURL(profileAvatarObjectUrl);
                          setProfileAvatarObjectUrl(objectUrl);
                          setProfileAvatarPreview(objectUrl);
                        }}
                      />
                    </label>
                    <p className="profile-avatar-note">
                      {profileAvatarFile?.name ?? t("choose_image")}
                    </p>
                    <div className="profile-avatar-actions">
                      <button type="submit" disabled={isBusy}>
                        {t("upload_avatar")}
                      </button>
                      {(profileAvatarPreview || myAvatarUrl) && (
                        <button
                          type="button"
                          className="secondary-btn profile-avatar-remove-btn"
                          onClick={() => {
                            setProfileAvatarFile(null);
                            if (profileAvatarObjectUrl) {
                              URL.revokeObjectURL(profileAvatarObjectUrl);
                              setProfileAvatarObjectUrl(null);
                            }
                            setProfileAvatarPreview("");
                            setRemoveAvatar(true);
                          }}
                        >
                          {t("remove")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <label>
                {t("email_label")}
                <input
                  id="profile-email"
                  name="profileEmail"
                  value={user.email ?? ""}
                  disabled
                />
              </label>
              <label>
                {t("display_name")}
                <input
                  id="profile-display-name"
                  name="displayName"
                  value={profileNameInput}
                  onChange={(event) => setProfileNameInput(event.target.value)}
                  maxLength={40}
                  required
                />
              </label>
              <button type="submit" disabled={isBusy}>
                {t("save_profile")}
              </button>
            </form>
            <button
              type="button"
              className="secondary-btn danger-btn"
              onClick={handleSignOut}
            >
              {t("sign_out")}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
