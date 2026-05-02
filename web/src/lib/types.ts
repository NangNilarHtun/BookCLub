export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type ReadingSession = {
  id: string;
  host_user_id: string;
  book_title: string;
  book_author: string;
  total_chapters: number;
  created_at: string;
};

export type SessionMember = {
  id: string;
  session_id: string;
  user_id: string;
};

export type ProgressUpdate = {
  id: string;
  session_id: string;
  user_id: string;
  current_chapter: number;
  created_at: string;
};

export type DiscussionComment = {
  id: string;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export type CommentReaction = {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
};

