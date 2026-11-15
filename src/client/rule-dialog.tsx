"use client";

import { type FormEvent, useEffect, useState } from "react";
import { applyRule, interpretRule } from "src/client/rules-api";
import type { InterpretRuleResponse, RuleMessage, RuleProposal } from "src/shared/api-types";

import styles from "./rule-dialog.module.css";

/** The server takes at most 12 turns; the oldest are dropped first. */
const MAX_TURNS = 11;

const KIND_LABEL: Record<Exclude<RuleProposal["kind"], "not_a_rule">, string> = {
  word: "词语替换",
  template: "输出格式",
  instruction: "处理规则"
};

function change(proposal: RuleProposal): string | undefined {
  switch (proposal.kind) {
    case "word":
      return `${proposal.source} → ${proposal.target}`;
    case "template":
    case "instruction":
      return proposal.text;
    case "not_a_rule":
      return undefined;
  }
}

/**
 * S-08: plain language in, the AI's understanding out, saved only on confirmation. The dialog
 * keeps its own short conversation so a proposal can be corrected ("不对，……"); it is dropped
 * when the dialog closes (ADR-006).
 */
export function RuleDialog({ onClose }: { onClose: (saved: boolean) => void }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<RuleMessage[]>([]);
  const [log, setLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [result, setResult] = useState<InterpretRuleResponse>();
  const [busy, setBusy] = useState<"thinking" | "saving">();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) {
      return;
    }
    const turn = [...messages, { role: "user" as const, text }].slice(-MAX_TURNS);
    setBusy("thinking");
    setError(undefined);
    setLog(entries => [...entries, { role: "user", text }]);
    setInput("");
    try {
      const reply = await interpretRule(turn);
      // The AI sees exactly what it proposed, so it can revise it.
      setMessages([...turn, { role: "assistant", text: JSON.stringify(reply.proposal) }]);
      setLog(entries => [...entries, { role: "assistant", text: reply.proposal.explanation }]);
      setResult(reply);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "出错了，请重试。");
    } finally {
      setBusy(undefined);
    }
  }

  async function confirm() {
    if (!result || result.proposal.kind === "not_a_rule" || busy) {
      return;
    }
    setBusy("saving");
    setError(undefined);
    try {
      await applyRule(result.proposal, result.version);
      onClose(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "保存失败，请重试。");
      setBusy(undefined);
    }
  }

  const proposal = result?.proposal;
  const detail = proposal ? change(proposal) : undefined;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="加规则">
      <div className={styles.panel}>
        <h2 className={styles.title}>加规则</h2>

        {log.length > 0 && (
          <ul className={styles.log}>
            {log.map((entry, index) => (
              <li key={index} className={entry.role === "user" ? styles.user : styles.assistant}>
                {entry.text}
              </li>
            ))}
          </ul>
        )}

        {proposal && proposal.kind !== "not_a_rule" && (
          <div className={styles.proposal}>
            <p className={styles.kind}>{KIND_LABEL[proposal.kind]}</p>
            {detail && <p className={styles.change}>{detail}</p>}
            {result?.replacing && (
              <p className={styles.replacing}>替换原来的：{result.replacing}</p>
            )}
            <div className={styles.buttons}>
              <button
                className={styles.primary}
                type="button"
                disabled={busy !== undefined}
                onClick={() => void confirm()}
              >
                {busy === "saving" ? "正在保存…" : "确认保存"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <form className={styles.form} onSubmit={event => void send(event)}>
          <textarea
            className={styles.input}
            value={input}
            onChange={event => setInput(event.target.value)}
            rows={3}
            placeholder={
              proposal
                ? "不对的话，直接说哪里不对。"
                : "用大白话说一条规则，比如：以后 Coles 都叫红超市。也可以贴几条以前的输出。"
            }
          />
          <div className={styles.buttons}>
            <button className={styles.secondary} type="button" onClick={() => onClose(false)}>
              取消
            </button>
            <button
              className={styles.primary}
              type="submit"
              disabled={busy !== undefined || !input.trim()}
            >
              {busy === "thinking" ? "正在理解…" : "发送"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
