"use client";

import { withNumbers } from "src/client/receipt-text";

import styles from "./receipts-screen.module.css";

/** One card of the list, from a photo still uploading or a receipt the server has. */
export type CardView = {
  receiptId: string;
  createdAt: string;
  /** What the card shows: the small copy, or the photo for receipts from before T-019. */
  imageUrl?: string;
  /** Shown by a tap on the thumbnail: the full photo. */
  photoUrl?: string;
  label: string;
  tone: "done" | "busy" | "bad" | "warn";
  text?: string;
  detail?: string;
  /** Offers 重新生成 (S-07). */
  canRegenerate: boolean;
  /** An upload that failed and can be sent again. */
  canRetry: boolean;
  /** Pending previews are local object URLs; only stored photos can fail to load and need new URLs. */
  stored: boolean;
};

type Props = {
  card: CardView;
  /** The result of the last 复制 on this card, while its message shows. */
  copied?: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onRetry: () => void;
  onView: (photoUrl: string) => void;
  onImageError: () => void;
};

const TONE = { done: styles.done, busy: styles.busyTone, bad: styles.bad, warn: styles.warn };

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

export function ReceiptCard({
  card,
  copied,
  onCopy,
  onRegenerate,
  onRetry,
  onView,
  onImageError
}: Props) {
  const { photoUrl } = card;
  return (
    <li className={styles.card}>
      {/* Shows the photo larger over the list (S-05 criterion 3). Plain <img>: photos are
          private, behind short-lived presigned URLs, and must not pass through the Next.js
          image optimizer and its cache. */}
      <button
        className={styles.thumbButton}
        type="button"
        aria-label="查看大图"
        disabled={!photoUrl}
        onClick={() => photoUrl && onView(photoUrl)}
      >
        {card.imageUrl ? (
          // oxlint-disable-next-line nextjs/no-img-element
          <img
            className={styles.thumb}
            src={card.imageUrl}
            alt="小票照片"
            // Receipts from before T-019 show the full photo: only decode the ones on screen.
            loading="lazy"
            decoding="async"
            onError={card.stored ? onImageError : undefined}
          />
        ) : (
          // A queued photo before its small copy exists.
          <span className={styles.thumb} aria-hidden="true" />
        )}
      </button>

      <div className={styles.body}>
        <div className={styles.meta}>
          <span className={`${styles.chip} ${TONE[card.tone]}`}>{card.label}</span>
          <span className={styles.time}>{time(card.createdAt)}</span>
        </div>

        {card.text !== undefined && (
          <p className={styles.text}>{withNumbers(card.text, styles.number)}</p>
        )}
        {card.text === undefined && card.tone === "busy" && (
          <div className={styles.skeleton} aria-hidden="true">
            <span />
            <span />
          </div>
        )}
        {card.detail && <p className={styles.message}>{card.detail}</p>}

        {(card.text !== undefined || card.canRegenerate || card.canRetry) && (
          <div className={styles.actions}>
            {card.text !== undefined && (
              <button
                className={copied ? `${styles.copy} ${styles.copiedButton}` : styles.copy}
                type="button"
                onClick={onCopy}
              >
                {copied ? "已复制" : "复制"}
              </button>
            )}
            {card.canRegenerate && (
              <button
                className={card.text !== undefined ? styles.quiet : styles.soft}
                type="button"
                onClick={onRegenerate}
              >
                重新生成
              </button>
            )}
            {card.canRetry && (
              <button className={styles.soft} type="button" onClick={onRetry}>
                重试
              </button>
            )}
          </div>
        )}
        {copied === false && (
          <p className={styles.message} role="status">
            复制失败，请长按文字手动复制
          </p>
        )}
      </div>
    </li>
  );
}
