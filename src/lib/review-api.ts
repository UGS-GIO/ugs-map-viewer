/**
 * Client for the warehouse review-comments API (served by review-serving under the same origin as the
 * review app, behind IAP). Same `review.*` tables as the internal review viewer, so comments sync —
 * keyed by email (IAP injects the reviewer's @utah.gov address, which review-serving trusts) and item id.
 *
 * Auth: NONE in the client — the app is served behind IAP, so same-origin `/api/*` requests carry the
 * IAP session cookie automatically; review-serving reads the authenticated email from the IAP header.
 * Base URL is same-origin (relative `/api`); VITE_REVIEW_API_URL may override it for local dev.
 */
export const REVIEW_API_URL = (import.meta.env.VITE_REVIEW_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

// A row comment keys on a STABLE domain key (rowKey = the column name, e.g. 'pk') so a comment resolves
// to the same row across the internal warehouse viewer (parquet/PMTiles) and this app (PostGIS pk).
// rowVal = one row's thread (list); rowVals = create on N rows at once.
export type CommentTarget = {
  kind?: 'item' | 'row' | 'column';
  rowKey?: string;
  rowVal?: string;
  rowVals?: string[];
  column?: string;
};

export type Comment = {
  id: number;
  item_ids: string[];
  target_kind: 'item' | 'row' | 'column';
  row_key: string | null;        // the stable-key column name (e.g. 'pk') when target_kind = row
  row_key_vals: string[] | null; // 1..N stable key values
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
  row_key: string | null;
  row_key_vals: string[] | null;
  column_name: string | null;
  parent_id: number | null;
};

/** fetch wrapper — same-origin behind IAP, so the IAP session cookie authenticates; no Bearer token. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${REVIEW_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${res.status} ${detail.slice(0, 200)}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// Comments for an item (a hazard layer id), optionally narrowed to a row (by stable key value) or column.
export const listComments = (itemId: string, target?: { rowVal?: string; column?: string }) => {
  const q = new URLSearchParams({ item_id: itemId });
  if (target?.rowVal != null) q.set('row_val', target.rowVal);
  if (target?.column) q.set('column', target.column);
  return api<Comment[]>(`/api/comments?${q.toString()}`);
};

export const createComment = (itemIds: string[], body: string, target?: CommentTarget) => {
  const rowVals = target?.rowVals ?? (target?.rowVal != null ? [target.rowVal] : null);
  return api<Comment>(`/api/comments`, {
    method: 'POST',
    body: JSON.stringify({
      item_ids: itemIds,
      body,
      target_kind: target?.kind ?? 'item',
      row_key: target?.rowKey ?? null,
      row_key_vals: rowVals,
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
