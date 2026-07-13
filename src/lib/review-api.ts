/**
 * Client for the warehouse review-comments API (the non-IAP `ugs-warehouse-review-api` Cloud Run twin).
 * Same `review.*` tables as the internal warehouse review viewer, so comments/notifications written here
 * are SYNCED with it — keyed by email (Firebase/Entra and Google IAP resolve to the same @utah.gov
 * address) and by item id. Auth is the Firebase ID token (verified server-side); no cookies.
 *
 * Base URL comes from VITE_REVIEW_API_URL. When unset (e.g. before the service is deployed), calls are
 * skipped by the hooks so the UI degrades quietly.
 */
import { auth } from '@/lib/auth';

export const REVIEW_API_URL = (import.meta.env.VITE_REVIEW_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export type CommentTarget = {
  kind?: 'item' | 'row' | 'column';
  featureId?: number;
  featureIds?: number[];
  column?: string;
};

export type Comment = {
  id: number;
  item_ids: string[];
  target_kind: 'item' | 'row' | 'column';
  feature_ids: number[] | null;
  column_name: string | null;
  parent_id: number | null;
  body: string;
  author: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Notification = {
  id: number;
  actor: string;
  kind: 'mention' | 'reply';
  seen_at: string | null;
  created_at: string;
  comment_id: number;
  body: string;
  item_ids: string[];
  target_kind: string;
  feature_ids: number[] | null;
  column_name: string | null;
  parent_id: number | null;
};

/** fetch wrapper that attaches the current user's Firebase ID token as a Bearer credential. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${REVIEW_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${detail.slice(0, 200)}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Comments for an item (a hazard layer id), optionally narrowed to a feature/column.
export const listComments = (itemId: string, target?: { featureId?: number; column?: string }) => {
  const q = new URLSearchParams({ item_id: itemId });
  if (target?.featureId != null) q.set('feature_id', String(target.featureId));
  if (target?.column) q.set('column', target.column);
  return api<Comment[]>(`/api/comments?${q.toString()}`);
};

export const createComment = (itemIds: string[], body: string, target?: CommentTarget) => {
  const featureIds = target?.featureIds ?? (target?.featureId != null ? [target.featureId] : null);
  return api<Comment>(`/api/comments`, {
    method: 'POST',
    body: JSON.stringify({
      item_ids: itemIds,
      body,
      target_kind: target?.kind ?? 'item',
      feature_ids: featureIds,
      column_name: target?.column ?? null,
    }),
  });
};

export const replyToComment = (parentId: number, body: string) =>
  api<Comment>(`/api/comments`, { method: 'POST', body: JSON.stringify({ parent_id: parentId, body }) });

export const setStatus = (id: number, status: string) =>
  api<Comment>(`/api/comments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });

export const deleteComment = (id: number) =>
  api<{ deleted: number }>(`/api/comments/${id}`, { method: 'DELETE' });

export const listReviewers = () => api<string[]>(`/api/reviewers`);

// Map a hazards-review layer value to the warehouse STAC item id so a comment lands on the SAME thread
// as the internal review viewer. 'hazards:hazards_qfaults_current' → 'hazards_qfaults' (drop the
// workspace prefix + the _current suffix; the matview name already embeds the schema).
export const layerToItemId = (layerValue: string): string =>
  (layerValue.split(':').pop() ?? layerValue).replace(/_current$/, '');

export const listNotifications = (unseen = false) =>
  api<Notification[]>(`/api/notifications${unseen ? '?unseen=true' : ''}`);

export const markNotificationsSeen = (ids?: number[]) =>
  api<{ ok: boolean }>(`/api/notifications/seen`, { method: 'POST', body: JSON.stringify({ ids: ids ?? null }) });
