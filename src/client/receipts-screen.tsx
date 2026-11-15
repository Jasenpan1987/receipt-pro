"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { compressImage } from "src/client/compress-image";
import { copyText } from "src/client/copy-text";
import { startNewSession } from "src/client/new-session";
import { processReceipt } from "src/client/process-receipt";
import { randomId } from "src/client/random-id";
import { canRegenerate, statusLabel } from "src/client/receipt-labels";
import { RuleDialog } from "src/client/rule-dialog";
import { UploadError, uploadReceipt } from "src/client/upload-receipt";
import { useSessionPoll } from "src/client/use-session-poll";
import type { ReceiptView } from "src/shared/api-types";
import { SESSION_SIZE_PROMPT } from "src/shared/limits";

import styles from "./receipts-screen.module.css";

/** A photo on its way to the server. It leaves this list once the server has the receipt. */
type PendingUpload = {
  receiptId: string;
  createdAt: string;
  previewUrl: string;
  file: File;
  /** The re-encoded JPEG, kept so a retry sends the same bytes without re-encoding. */
  photo?: Blob;
  state: "uploading" | "failed";
  message?: string;
  /** False when the photo itself cannot be read: retrying would fail the same way. */
  retryable: boolean;
};

type Card = {
  receiptId: string;
  createdAt: string;
  photoUrl: string;
  label: string;
  text?: string;
  detail?: string;
  retry?: PendingUpload;
  busy: boolean;
  /** Pending previews are local object URLs; only stored photos can fail to load and need new URLs. */
  stored: boolean;
  /** Offers 重新生成 (S-07). */
  regenerate: boolean;
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
  const ruleSavedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<PendingUpload[]>([]);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Release the photo previews and timers when the page goes away.
  useEffect(
    () => () => {
      for (const item of pendingRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
      clearTimeout(copiedTimer.current);
      clearTimeout(ruleSavedTimer.current);
    },
    []
  );

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

    let photo = item.photo;
    try {
      photo ??= await compressImage(item.file);
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
        receiptId: item.receiptId,
        createdAt: item.createdAt
      });
      setRecent(list => [receipt, ...list.filter(r => r.receiptId !== receipt.receiptId)]);
      setPending(list => list.filter(p => p.receiptId !== item.receiptId));
      URL.revokeObjectURL(item.previewUrl);
      refresh();
      // Not part of the upload queue: the next photo uploads while this one is read.
      void processReceipt(receipt.receiptId).then(() => refresh());
    } catch (error) {
      patch(item.receiptId, {
        state: "failed",
        photo,
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
      previewUrl: URL.createObjectURL(file),
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
  const cards: Card[] = [
    ...pending.map(item => ({
      receiptId: item.receiptId,
      createdAt: item.createdAt,
      photoUrl: item.previewUrl,
      label: item.state === "uploading" ? "上传中…" : "上传失败",
      detail: item.message,
      retry: item.state === "failed" && item.retryable ? item : undefined,
      busy: item.state === "uploading",
      stored: false,
      regenerate: false
    })),
    ...[...recent.filter(receipt => !sessionIds.has(receipt.receiptId)), ...sessionReceipts]
      .filter(receipt => !pendingIds.has(receipt.receiptId))
      .map(receipt => ({
        receiptId: receipt.receiptId,
        createdAt: receipt.createdAt,
        photoUrl: receipt.photoUrl,
        label: regenerating.has(receipt.receiptId) ? "重新生成中…" : statusLabel(receipt),
        text:
          receipt.status === "done" && !regenerating.has(receipt.receiptId)
            ? receipt.text
            : undefined,
        detail:
          receipt.status === "failed" && !regenerating.has(receipt.receiptId)
            ? receipt.error
            : undefined,
        busy: receipt.status === "processing" || regenerating.has(receipt.receiptId),
        stored: true,
        regenerate: canRegenerate(receipt) && !regenerating.has(receipt.receiptId)
      }))
  ].sort(newestFirst);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>receipt-pro</h1>
          <Link className={styles.rulesLink} href="/rules">
            规则
          </Link>
          <button className={styles.addRule} type="button" onClick={() => setAddingRule(true)}>
            加规则
          </button>
          <button
            className={styles.newSession}
            type="button"
            disabled={clearing}
            onClick={() => void onNewSession()}
          >
            {clearing ? "正在清空…" : "新 session"}
          </button>
        </div>
        <div className={styles.actions}>
          <label className={styles.action}>
            拍照
            <input
              className={styles.fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFiles}
            />
          </label>
          <label className={styles.action}>
            从相册选
            <input
              className={styles.fileInput}
              type="file"
              accept="image/*"
              multiple
              onChange={onFiles}
            />
          </label>
        </div>
      </header>

      {loadState === "failed" && (
        <div className={styles.notice} role="alert">
          <p>加载失败，请检查网络后重试。</p>
          <button className={styles.secondary} type="button" onClick={() => refresh(true)}>
            重试
          </button>
        </div>
      )}
      {ruleSaved && (
        <p className={styles.saved} role="status">
          规则已保存，从下一张小票开始生效。已有的小票可以点“重新生成”。
        </p>
      )}
      {addingRule && <RuleDialog onClose={onRuleDialogClose} />}
      {sessionReceipts.length >= SESSION_SIZE_PROMPT && (
        <p className={styles.notice}>
          这一批已经有 {sessionReceipts.length} 张小票了。复制完以后，可以点“新
          session”开始新的一批。
        </p>
      )}
      {loadState === "loading" && cards.length === 0 && <p className={styles.empty}>正在加载…</p>}
      {loadState === "ready" && cards.length === 0 && (
        <p className={styles.empty}>还没有小票。拍一张试试。</p>
      )}

      <ul className={styles.list} aria-live="polite">
        {cards.map(card => (
          <li key={card.receiptId} className={styles.card}>
            {/* Opens the photo larger in a new tab (S-05 criterion 3). Plain <img>: photos are
                private, behind short-lived presigned URLs, and must not pass through the
                Next.js image optimizer and its cache. */}
            <a
              className={styles.thumbLink}
              href={card.photoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* oxlint-disable-next-line nextjs/no-img-element */}
              <img
                className={styles.thumb}
                src={card.photoUrl}
                alt="小票照片"
                // Full-size photos: only decode the ones on screen.
                loading="lazy"
                decoding="async"
                // An expired or broken photo URL: ask for the whole session, which signs new ones.
                onError={card.stored ? () => refresh(true) : undefined}
              />
            </a>
            <div className={styles.body}>
              <p className={card.busy ? `${styles.status} ${styles.busy}` : styles.status}>
                {card.label}
              </p>
              {card.text && <p className={styles.text}>{card.text}</p>}
              {card.detail && <p className={styles.detail}>{card.detail}</p>}
              {card.text !== undefined && (
                <div className={styles.copyRow}>
                  <button
                    className={styles.copy}
                    type="button"
                    onClick={() => onCopy(card.receiptId, card.text ?? "")}
                  >
                    复制
                  </button>
                  {copied?.receiptId === card.receiptId && (
                    <span className={copied.ok ? styles.copied : styles.detail} role="status">
                      {copied.ok ? "已复制" : "复制失败，请长按文字手动复制"}
                    </span>
                  )}
                </div>
              )}
              {card.regenerate && (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => onRegenerate(card.receiptId)}
                >
                  重新生成
                </button>
              )}
              {card.retry && (
                <button
                  className={styles.secondary}
                  type="button"
                  onClick={() => card.retry && enqueue(card.retry)}
                >
                  重试
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
