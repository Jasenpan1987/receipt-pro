"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { compressImage } from "src/client/compress-image";
import { randomId } from "src/client/random-id";
import { fetchSession } from "src/client/session-api";
import { UploadError, uploadReceipt } from "src/client/upload-receipt";
import type { ReceiptStatus, ReceiptView } from "src/shared/api-types";

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
};

const STATUS_LABEL: Record<ReceiptStatus, string> = {
  processing: "处理中…",
  done: "已完成",
  unreadable: "看不清，请重拍",
  failed: "处理失败"
};

const newestFirst = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);

function withReceipt(list: ReceiptView[], receipt: ReceiptView): ReceiptView[] {
  return [receipt, ...list.filter(r => r.receiptId !== receipt.receiptId)].sort(newestFirst);
}

export function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<ReceiptView[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "failed">("loading");
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef<PendingUpload[]>([]);

  const load = useCallback(async () => {
    try {
      const session = await fetchSession();
      setReceipts(session.receipts);
      setLoadState("ready");
    } catch {
      setLoadState(state => (state === "ready" ? state : "failed"));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Release the photo previews when the page goes away.
  useEffect(
    () => () => {
      for (const item of pendingRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    },
    []
  );

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
      setReceipts(list => withReceipt(list, receipt));
      setPending(list => list.filter(p => p.receiptId !== item.receiptId));
      URL.revokeObjectURL(item.previewUrl);
      void load();
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

  const pendingIds = new Set(pending.map(item => item.receiptId));
  const cards: Card[] = [
    ...pending.map(item => ({
      receiptId: item.receiptId,
      createdAt: item.createdAt,
      photoUrl: item.previewUrl,
      label: item.state === "uploading" ? "上传中…" : "上传失败",
      detail: item.message,
      retry: item.state === "failed" && item.retryable ? item : undefined,
      busy: item.state === "uploading"
    })),
    ...receipts
      .filter(receipt => !pendingIds.has(receipt.receiptId))
      .map(receipt => ({
        receiptId: receipt.receiptId,
        createdAt: receipt.createdAt,
        photoUrl: receipt.photoUrl,
        label: STATUS_LABEL[receipt.status],
        text: receipt.status === "done" ? receipt.text : undefined,
        detail: receipt.status === "failed" ? receipt.error : undefined,
        busy: receipt.status === "processing"
      }))
  ].sort(newestFirst);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>receipt-pro</h1>
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
          <button className={styles.secondary} type="button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}
      {loadState === "loading" && cards.length === 0 && <p className={styles.empty}>正在加载…</p>}
      {loadState === "ready" && cards.length === 0 && (
        <p className={styles.empty}>还没有小票。拍一张试试。</p>
      )}

      <ul className={styles.list} aria-live="polite">
        {cards.map(card => (
          <li key={card.receiptId} className={styles.card}>
            {/* Plain <img>: photos are private, behind short-lived presigned URLs, and must not
                pass through the Next.js image optimizer and its cache. */}
            {/* oxlint-disable-next-line nextjs/no-img-element */}
            <img className={styles.thumb} src={card.photoUrl} alt="小票照片" />
            <div className={styles.body}>
              <p className={card.busy ? `${styles.status} ${styles.busy}` : styles.status}>
                {card.label}
              </p>
              {card.text && <p className={styles.text}>{card.text}</p>}
              {card.detail && <p className={styles.detail}>{card.detail}</p>}
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
