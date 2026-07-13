/**
 * Review comments panel for the hazards-review app. Reads/writes the SAME warehouse review.* tables as
 * the internal review viewer (via the non-IAP review-api, Firebase-token auth), so threads sync across
 * both. `itemId` is the hazard layer id the comments hang off. Renders nothing until the API is
 * configured (VITE_REVIEW_API_URL) and the user is signed in.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useAuth } from '@/context/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  type Comment,
  createComment,
  deleteComment,
  listComments,
  listReviewers,
  replyToComment,
  setStatus,
} from '@/lib/review-api';

// The active "@token" just left of the caret (the fragment being typed), or null.
function mentionAt(text: string, caret: number): { at: number; query: string } | null {
  const m = /(?:^|\s)@(\S*)$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { at: caret - m[1].length - 1, query: m[1] };
}

export function ReviewComments({ itemId, label = 'Review comments' }: { itemId: string; label?: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const myEmail = user?.email ?? undefined;
  const key = ['review-comments', itemId] as const;
  // Same-origin by default (empty REVIEW_API_URL + the firebase.json `/api/**` rewrite → review-api),
  // so we gate on the signed-in user, not on a base URL. No backend → the fetch errors → panel hides.
  const enabled = !!user;

  const { data: comments = [], isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => listComments(itemId),
    retry: false,
    enabled,
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const [body, setBody] = useState('');
  const reviewers = useQuery({ queryKey: ['review-reviewers'], queryFn: listReviewers, retry: false, enabled, staleTime: 5 * 60_000 });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionIdx, setMentionIdx] = useState(0);

  const add = useMutation({
    mutationFn: () => createComment([itemId], body),
    onSuccess: (created) => {
      setBody('');
      qc.setQueryData<Comment[]>(key, (old = []) => [created, ...old]);
      invalidate();
    },
  });
  const toggle = useMutation({ mutationFn: (c: Comment) => setStatus(c.id, c.status === 'resolved' ? 'open' : 'resolved'), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: number) => deleteComment(id), onSuccess: invalidate });
  const reply = useMutation({ mutationFn: (v: { parentId: number; body: string }) => replyToComment(v.parentId, v.body), onSuccess: invalidate });

  const onBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setBody(v);
    const tok = mentionAt(v, e.target.selectionStart ?? v.length);
    if (!tok || !reviewers.data?.length) return setMentions([]);
    const q = tok.query.toLowerCase();
    setMentions(reviewers.data.filter((r) => r.toLowerCase().includes(q)).slice(0, 6));
    setMentionIdx(0);
  };
  const pickMention = (email: string) => {
    const ta = taRef.current;
    const caret = ta?.selectionStart ?? body.length;
    const tok = mentionAt(body, caret);
    if (!tok) return;
    const local = email.split('@')[0];
    setBody(`${body.slice(0, tok.at)}@${local} ${body.slice(caret)}`);
    setMentions([]);
    const pos = tok.at + local.length + 2;
    requestAnimationFrame(() => { ta?.focus(); ta?.setSelectionRange(pos, pos); });
  };
  const onBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentions.length) % mentions.length); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(mentions[mentionIdx]); }
    else if (e.key === 'Escape') { e.preventDefault(); setMentions([]); }
  };

  const roots = comments.filter((c) => c.parent_id == null);
  const repliesByRoot = new Map<number, Comment[]>();
  for (const c of comments) if (c.parent_id != null) (repliesByRoot.get(c.parent_id) ?? repliesByRoot.set(c.parent_id, []).get(c.parent_id)!).push(c);

  // No backend reachable (public build without the rewrite → /api/* returns the SPA HTML → parse
  // error; or 401/403/503) → render nothing.
  const notConfigured = error && /\b(401|403|503)\b|Failed to fetch|Unexpected token|not valid JSON/i.test(String(error));
  if (notConfigured) return null;

  return (
    <div className="rounded-md border bg-card/50 p-2 text-xs">
      <div className="mb-1.5 font-medium">{label}{comments.length ? ` (${comments.length})` : ''}</div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && !error && roots.length === 0 && <p className="text-muted-foreground">No comments yet.</p>}

      <ul className="space-y-1.5">
        {roots.map((root) => (
          <li key={root.id} className="rounded border bg-background p-1.5">
            <CommentRow c={root} myEmail={myEmail}
              onToggle={() => toggle.mutate(root)} onDelete={() => remove.mutate(root.id)} />
            {(repliesByRoot.get(root.id) ?? []).map((r) => (
              <div key={r.id} className="mt-1.5 border-l-2 pl-2">
                <CommentRow c={r} myEmail={myEmail} onDelete={() => remove.mutate(r.id)} />
              </div>
            ))}
            <ReplyBox onReply={(text) => reply.mutate({ parentId: root.id, body: text })} pending={reply.isPending} />
          </li>
        ))}
      </ul>

      <div className="relative mt-2 flex gap-1.5">
        {mentions.length > 0 && (
          <ul className="absolute bottom-full left-0 z-10 mb-1 max-h-40 w-56 overflow-auto rounded border bg-card shadow">
            {mentions.map((email, i) => (
              <li key={email}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); pickMention(email); }}
                  onMouseEnter={() => setMentionIdx(i)}
                  className={`block w-full px-2 py-1 text-left ${i === mentionIdx ? 'bg-muted' : ''}`}>
                  <span className="font-medium text-foreground">@{email.split('@')[0]}</span>
                  <span className="ml-1 text-[10px] text-muted-foreground">{email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Textarea ref={taRef} value={body} onChange={onBodyChange} onKeyDown={onBodyKeyDown} rows={2}
          onBlur={() => setMentions([])} placeholder="Add a review note… (@ to mention)" className="flex-1 text-xs" />
        <Button size="sm" disabled={!body.trim() || add.isPending} onClick={() => add.mutate()} className="self-end">
          {add.isPending ? '…' : 'Add'}
        </Button>
      </div>
      {add.error && <p className="mt-1 text-destructive">Failed to add: {String(add.error)}</p>}
    </div>
  );
}

function renderBody(text: string) {
  return text.split(/(?<!\S)(@[A-Za-z0-9][A-Za-z0-9._%+-]*)/g).map((part, i) =>
    /^@[A-Za-z0-9]/.test(part)
      ? <span key={i} className="rounded bg-primary/10 px-0.5 font-medium text-primary">{part}</span>
      : part,
  );
}

function CommentRow({ c, myEmail, onToggle, onDelete }: {
  c: Comment; myEmail?: string; onToggle?: () => void; onDelete: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-foreground">{c.author.split('@')[0]}</span>
        <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
        {c.status === 'resolved' && <Badge variant="outline" className="px-1.5 py-0 text-[10px] text-green-600">resolved</Badge>}
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-foreground">{renderBody(c.body)}</p>
      <div className="mt-1 flex gap-3 text-[11px]">
        {onToggle && <button className="text-primary hover:underline" onClick={onToggle}>{c.status === 'resolved' ? 'reopen' : 'resolve'}</button>}
        {myEmail === c.author && <button className="text-destructive hover:underline" onClick={onDelete}>delete</button>}
      </div>
    </>
  );
}

function ReplyBox({ onReply, pending }: { onReply: (body: string) => void; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) return <button className="mt-1 text-[11px] text-primary hover:underline" onClick={() => setOpen(true)}>Reply</button>;
  return (
    <div className="mt-1 flex gap-1.5">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} autoFocus placeholder="Reply…" className="flex-1 text-xs" />
      <Button size="sm" disabled={!text.trim() || pending} className="self-end"
        onClick={() => { onReply(text.trim()); setText(''); setOpen(false); }}>
        {pending ? '…' : 'Reply'}
      </Button>
    </div>
  );
}
