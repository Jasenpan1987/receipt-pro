"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { preparePhoto } from "src/client/compress-image";
import { copyText } from "src/client/copy-text";
import { logout } from "src/client/logout";
import { startNewSession } from "src/client/new-session";
import { PhotoViewer } from "src/client/photo-viewer";
import { processReceipt } from "src/client/process-receipt";
import { randomId } from "src/client/random-id";
import { type CardView, ReceiptCard } from "src/client/receipt-card";
import { canRegenerate, statusLabel } from "src/client/receipt-labels";
import { RuleDialog } from "src/client/rule-dialog";
import { StableUrls } from "src/client/stable-urls";
import { UploadError, uploadReceipt } from "src/client/upload-receipt";
import { useSessionPoll } from "src/client/use-session-poll";
import type { ReceiptView } from "src/shared/api-types";
import { SESSION_SIZE_PROMPT } from "src/shared/limits";

import styles from "./receipts-screen.module.css";

/** A photo on its way to the server. It leaves this list once the server has the receipt. */
type PendingUpload = {
  receiptId: string;
  createdAt: string;
  /**
   * The small copy, once made. Never the original file: a 12 MP camera photo is about 48 MB
   * decoded, and a batch of them froze the iPhone (T-019).
   */
  previewUrl?: string;
  file: File;
  /** The re-encoded JPEG and its small copy, kept so a retry sends the same bytes. */
  photo?: Blob;
  thumb?: Blob;
  state: "uploading" | "failed";
  message?: string;
  /** False when the photo itself cannot be read: retrying would fail the same way. */
  retryable: boolean;
};

/** How long "已复制" stays on the card. */
const COPIED_MESSAGE_MS = 2_000;

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);

export function ReceiptsScreen() {
  const { session, state: loadState, refresh } = useSessionPoll();
  const [pending, setPending] = useState<PendingUpload[]>([]);
  // Receipts the server confirmed that the next poll has not delivered yet.
  const [recent, setRecent] = useState<ReceiptView[]>([]);
  const [copied, setCopied] = useState<{ receiptId: string; ok: boolean }>();
  // Regenerate pressed here; shown at once, before the next poll brings the server's state.
  const [regenerating, setRegenerating] = useState<Set<string>>(() => new Set());
  const [clearing, setClearing] = useState(false);
  const [addingRule, setAddingRule] = useState(false);
  const [ruleSaved, setRuleSaved] = useState(false);
  /** The full photo shown over the list, if any. */
  const [viewing, setViewing] = useState<string>();
  const [menuOpen, setMenuOpen] = useState(false);
  const ruleSavedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<PendingUpload[]>([]);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stableUrls = useRef(new StableUrls());

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Release the photo previews and timers when the page goes away.
  useEffect(
    () => () => {
      for (const item of pendingRef.current) {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
      clearTimeout(copiedTimer.current);
      clearTimeout(ruleSavedTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Once the session has a receipt, the local copy is no longer needed.
  useEffect(() => {
    if (session) {
      const ids = new Set(session.receipts.map(receipt => receipt.receiptId));
      setRecent(list =>
        list.some(receipt => ids.has(receipt.receiptId))
          ? list.filter(r => !ids.has(r.receiptId))
          : list
      );
    }
  }, [session]);

  const patch = (receiptId: string, change: Partial<PendingUpload>) =>
    setPending(list =>
      list.map(item => (item.receiptId === receiptId ? { ...item, ...change } : item))
    );

  async function send(item: PendingUpload) {
    patch(item.receiptId, { state: "uploading", message: undefined });

    let { photo, thumb, previewUrl } = item;
    try {
      if (!photo) {
        ({ photo, thumb } = await preparePhoto(item.file));
        previewUrl = URL.createObjectURL(thumb);
        patch(item.receiptId, { photo, thumb, previewUrl });
      }
    } catch {
      patch(item.receiptId, {
        state: "failed",
        retryable: false,
        message: "这张照片无法读取，请换一张，或直接拍照。"
      });
      return;
    }

    try {
      const receipt = await uploadReceipt({
        photo,
        thumb,
        receiptId: item.receiptId,
        createdAt: item.createdAt
      });
      setRecent(list => [receipt, ...list.filter(r => r.receiptId !== receipt.receiptId)]);
      setPending(list => list.filter(p => p.receiptId !== item.receiptId));
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      refresh();
      // Not part of the upload queue: the next photo uploads while this one is read.
      void processReceipt(receipt.receiptId).then(() => refresh());
    } catch (error) {
      patch(item.receiptId, {
        state: "failed",
        photo,
        thumb,
        retryable: true,
        message: error instanceof UploadError ? error.message : "上传失败，请重试。"
      });
    }
  }

  /** One upload at a time, so a slow connection does not time out a whole batch at once. */
  function enqueue(item: PendingUpload) {
    queue.current = queue.current.then(() => send(item));
  }

  function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    // Lets the same photo be picked again later.
    event.currentTarget.value = "";
    // 1 ms apart, so the list keeps the order of selection, newest on top.
    const start = Date.now();
    const items: PendingUpload[] = files.map((file, index) => ({
      receiptId: randomId(),
      createdAt: new Date(start + index).toISOString(),
      file,
      state: "uploading",
      retryable: true
    }));
    setPending(list => [...items, ...list]);
    for (const item of items) {
      enqueue(item);
    }
  }

  // Straight from the click: both copy paths need the user's gesture.
  function onCopy(receiptId: string, text: string) {
    void copyText(text).then(ok => {
      setCopied({ receiptId, ok });
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(undefined), COPIED_MESSAGE_MS);
    });
  }

  // S-07: the same photo with the current settings; the new text replaces the old.
  function onRegenerate(receiptId: string) {
    setRegenerating(ids => new Set(ids).add(receiptId));
    refresh();
    void processReceipt(receiptId).then(() => {
      setRegenerating(ids => {
        const next = new Set(ids);
        next.delete(receiptId);
        return next;
      });
      refresh();
    });
  }

  // S-06: confirmation first, because one accidental tap would lose a batch nobody has pasted yet.
  async function onNewSession() {
    if (!window.confirm("开始新 session？当前所有小票和照片都会删除，规则不变。")) {
      return;
    }
    setClearing(true);
    try {
      await startNewSession();
      setRecent([]);
      refresh(true);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "开新 session 失败，请重试。");
    } finally {
      setClearing(false);
    }
  }

  function onRuleDialogClose(saved: boolean) {
    setAddingRule(false);
    if (saved) {
      setRuleSaved(true);
      clearTimeout(ruleSavedTimer.current);
      ruleSavedTimer.current = setTimeout(() => setRuleSaved(false), 4_000);
    }
  }

  const pendingIds = new Set(pending.map(item => item.receiptId));
  const sessionReceipts = session?.receipts ?? [];
  const sessionIds = new Set(sessionReceipts.map(receipt => receipt.receiptId));
  const cards: Array<CardView & { retry?: PendingUpload }> = [
    ...pending.map(item => ({
      receiptId: item.receiptId,
      createdAt: item.createdAt,
      imageUrl: item.previewUrl,
      label: item.state === "uploading" ? "上传中…" : "上传失败",
      tone: item.state === "uploading" ? ("busy" as const) : ("bad" as const),
      detail: item.message,
      retry: item.state === "failed" && item.retryable ? item : undefined,
      canRetry: item.state === "failed" && item.retryable,
      canRegenerate: false,
      stored: false
    })),
    ...[...recent.filter(receipt => !sessionIds.has(receipt.receiptId)), ...sessionReceipts]
      .filter(receipt => !pendingIds.has(receipt.receiptId))
      .map(receipt => {
        const rerunning = regenerating.has(receipt.receiptId);
        const busy = receipt.status === "processing" || rerunning;
        return {
          receiptId: receipt.receiptId,
          createdAt: receipt.createdAt,
          imageUrl: stableUrls.current.get(receipt.receiptId, receipt.thumbUrl ?? receipt.photoUrl),
          photoUrl: receipt.photoUrl,
          label: rerunning ? "重新生成中…" : statusLabel(receipt),
          tone: busy
            ? ("busy" as const)
            : receipt.status === "done"
              ? ("done" as const)
              : receipt.status === "failed"
                ? ("bad" as const)
                : ("warn" as const),
          text: receipt.status === "done" && !rerunning ? receipt.text : undefined,
          detail: receipt.status === "failed" && !rerunning ? receipt.error : undefined,
          canRegenerate: canRegenerate(receipt) && !rerunning,
          canRetry: false,
          stored: true
        };
      })
  ].sort(newestFirst);

  const newSessionLabel = clearing ? "正在清空…" : "新 session";

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>receipt-pro</h1>
        {/* The computer: everything in sight, nothing to reach for. */}
        <nav className={styles.deskActions}>
          <label className={styles.ghost} htmlFor="pick-library">
            选照片
          </label>
          <button className={styles.ghost} type="button" onClick={() => setAddingRule(true)}>
            加规则
          </button>
          <Link className={styles.ghost} href="/rules">
            规则
          </Link>
          <button
            className={`${styles.ghost} ${styles.dangerText}`}
            type="button"
            disabled={clearing}
            onClick={() => void onNewSession()}
          >
            {newSessionLabel}
          </button>
        </nav>
        {/* The phone: rarely used actions behind one button, away from the thumb. */}
        <button
          className={styles.more}
          type="button"
          aria-label="更多"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}
        >
          ⋯
        </button>
      </header>

      {menuOpen && (
        <>
          <div className={styles.shade} aria-hidden="true" onClick={() => setMenuOpen(false)} />
          <div className={styles.menu} role="menu">
            <button
              className={styles.menuItem}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setAddingRule(true);
              }}
            >
              加规则<small>用一句话改写法</small>
            </button>
            <div className={styles.menuLine} />
            <button
              className={`${styles.menuItem} ${styles.dangerText}`}
              type="button"
              role="menuitem"
              disabled={clearing}
              onClick={() => {
                setMenuOpen(false);
                void onNewSession();
              }}
            >
              {newSessionLabel}
              <small>清空这一批</small>
            </button>
            <button
              className={styles.menuItem}
              type="button"
              role="menuitem"
              onClick={() => void logout()}
            >
              退出登录
            </button>
          </div>
        </>
      )}

      {/* One pair of inputs for every button that picks photos; labels open them. */}
      <input
        id="pick-camera"
        className={styles.fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFiles}
      />
      <input
        id="pick-library"
        className={styles.fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={onFiles}
      />

      <main className={styles.main}>
        {loadState === "failed" && (
          <div className={`${styles.notice} ${styles.noticeBad}`} role="alert">
            <p>加载失败，请检查网络后重试。</p>
            <button className={styles.soft} type="button" onClick={() => refresh(true)}>
              重试
            </button>
          </div>
        )}
        {ruleSaved && (
          <p className={`${styles.notice} ${styles.noticeGood}`} role="status">
            规则已保存，从下一张小票开始生效。已有的小票可以点“重新生成”。
          </p>
        )}
        {sessionReceipts.length >= SESSION_SIZE_PROMPT && (
          <p className={styles.notice}>
            这一批已经有 {sessionReceipts.length} 张小票了。复制完以后，可以开一个新
            session，开始新的一批。
          </p>
        )}
        {loadState === "loading" && cards.length === 0 && <p className={styles.empty}>正在加载…</p>}
        {loadState === "ready" && cards.length === 0 && (
          <p className={styles.empty}>还没有小票。拍一张试试。</p>
        )}

        <ul className={styles.list} aria-live="polite">
          {cards.map(card => (
            <ReceiptCard
              key={card.receiptId}
              card={card}
              copied={copied?.receiptId === card.receiptId ? copied.ok : undefined}
              onCopy={() => onCopy(card.receiptId, card.text ?? "")}
              onRegenerate={() => onRegenerate(card.receiptId)}
              onRetry={() => card.retry && enqueue(card.retry)}
              onView={setViewing}
              onImageError={() => {
                // An expired or broken URL: take the newest one, and ask for the whole session,
                // which signs new ones (at most once a minute per receipt).
                if (stableUrls.current.failed(card.receiptId)) {
                  refresh(true);
                }
              }}
            />
          ))}
        </ul>
      </main>

      {/* The phone: the one thing done most, in thumb reach. */}
      <nav className={styles.bar}>
        <label className={styles.side} htmlFor="pick-library">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="2" />
            <path d="m21 16-5-5-9 9" />
          </svg>
          相册
        </label>
        <label className={styles.shoot} htmlFor="pick-camera">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13.5" r="3.5" />
          </svg>
          拍照
        </label>
        <Link className={styles.side} href="/rules">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6h13M8 12h13M8 18h13" />
            <circle cx="4" cy="6" r="1" />
            <circle cx="4" cy="12" r="1" />
            <circle cx="4" cy="18" r="1" />
          </svg>
          规则
        </Link>
      </nav>

      {addingRule && <RuleDialog onClose={onRuleDialogClose} />}
      {viewing && <PhotoViewer url={viewing} onClose={() => setViewing(undefined)} />}
    </div>
  );
}
