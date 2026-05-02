import { supabase } from "./supabase";
import type {
  CommentReaction,
  DiscussionComment,
  Profile,
  ProgressUpdate,
  ReadingSession,
  SessionMember,
} from "./types";

const AVATAR_BUCKET = "avatars";

function getFileExtension(fileName: string) {
  const parts = fileName.split(".");
  if (parts.length < 2) return "jpg";
  return parts.pop()?.toLowerCase() ?? "jpg";
}

export async function uploadProfileAvatar(input: { userId: string; file: File }) {
  const extension = getFileExtension(input.file.name);
  const filePath = `${input.userId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, input.file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function removeProfileAvatarByUrl(avatarUrl: string) {
  const marker = `${AVATAR_BUCKET}/`;
  const markerIndex = avatarUrl.indexOf(marker);
  if (markerIndex === -1) return;
  const filePath = avatarUrl.slice(markerIndex + marker.length);
  if (!filePath) return;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([filePath]);
  if (error) throw error;
}

export async function upsertProfile(input: {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}) {
  const payload = {
    id: input.userId,
    display_name: input.displayName,
    avatar_url: input.avatarUrl,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("profiles").upsert(payload, {
    onConflict: "id",
    ignoreDuplicates: false,
  });
  if (error) throw error;
}

export async function listProfiles(userIds: string[]) {
  if (userIds.length === 0) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", userIds);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function listSessions() {
  const { data, error } = await supabase
    .from("reading_sessions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ReadingSession[];
}

export async function createSession(input: {
  hostUserId: string;
  title: string;
  author: string;
  totalChapters: number;
}) {
  const payload = {
    host_user_id: input.hostUserId,
    book_title: input.title,
    book_author: input.author,
    total_chapters: input.totalChapters,
    visibility: "public",
  };

  const { data, error } = await supabase
    .from("reading_sessions")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as ReadingSession;
}

export async function listMembers(sessionId: string) {
  const { data, error } = await supabase
    .from("session_members")
    .select("*")
    .eq("session_id", sessionId);
  if (error) throw error;
  return (data ?? []) as SessionMember[];
}

export async function joinSession(sessionId: string, userId: string) {
  const payload = { session_id: sessionId, user_id: userId };
  const { error } = await supabase.from("session_members").insert(payload);
  if (error) {
    // Ignore duplicate membership attempts.
    if ((error as { code?: string }).code === "23505") return;
    throw error;
  }
}

export async function listMyMembershipSessionIds(userId: string) {
  const { data, error } = await supabase
    .from("session_members")
    .select("session_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.session_id as string);
}

export async function listProgress(sessionId: string) {
  const { data, error } = await supabase
    .from("progress_updates")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProgressUpdate[];
}

export async function addProgress(
  sessionId: string,
  userId: string,
  currentChapter: number,
) {
  const payload = {
    session_id: sessionId,
    user_id: userId,
    current_chapter: currentChapter,
  };
  const { error } = await supabase.from("progress_updates").insert(payload);
  if (error) throw error;
}

export async function listComments(sessionId: string) {
  const { data, error } = await supabase
    .from("discussion_comments")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DiscussionComment[];
}

export async function addComment(sessionId: string, userId: string, content: string) {
  const payload = { session_id: sessionId, user_id: userId, content };
  const { error } = await supabase.from("discussion_comments").insert(payload);
  if (error) throw error;
}

export async function listReactions(commentIds: string[]) {
  if (commentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("comment_reactions")
    .select("*")
    .in("comment_id", commentIds);
  if (error) throw error;
  return (data ?? []) as CommentReaction[];
}

export async function toggleReaction(commentId: string, userId: string, emoji: string) {
  const { data, error } = await supabase
    .from("comment_reactions")
    .select("id")
    .eq("comment_id", commentId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (error) throw error;

  if (data?.id) {
    const { error: deleteError } = await supabase
      .from("comment_reactions")
      .delete()
      .eq("id", data.id);
    if (deleteError) throw deleteError;
    return;
  }

  const { error: insertError } = await supabase.from("comment_reactions").insert({
    comment_id: commentId,
    user_id: userId,
    emoji,
  });
  if (insertError) throw insertError;
}

