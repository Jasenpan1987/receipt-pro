"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteRule, fetchRules } from "src/client/rules-api";
import type { RulesView } from "src/shared/api-types";

import styles from "./rules-screen.module.css";

/** S-09: one place to see every saved rule in plain words and delete any of them. */
export function RulesScreen() {
  const [rules, setRules] = useState<RulesView>();
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState<string>();

  const load = useCallback(async () => {
    try {
      setRules(await fetchRules());
      setError(undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "读取规则失败，请重试。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/login");
  }

  async function remove(id: string, what: string) {
    if (
      !rules ||
      !window.confirm(`删除这条规则？\n${what}\n以后的小票不再按它处理，已有的小票不变。`)
    ) {
      return;
    }
    setDeleting(id);
    try {
      await deleteRule(id, rules.version);
    } catch (failure) {
      window.alert(failure instanceof Error ? failure.message : "删除失败，请重试。");
    } finally {
      setDeleting(undefined);
      await load();
    }
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link className={styles.back} href="/">
          ← 返回
        </Link>
        <h1 className={styles.title}>规则</h1>
        <button className={styles.logout} type="button" onClick={() => void logout()}>
          退出登录
        </button>
      </header>

      {error && (
        <div className={styles.notice} role="alert">
          <p>{error}</p>
          <button className={styles.secondary} type="button" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}
      {!rules && !error && <p className={styles.empty}>正在加载…</p>}

      {rules && (
        <>
          <section className={styles.section}>
            <h2 className={styles.heading}>输出格式</h2>
            {rules.template ? (
              <div className={styles.rule}>
                <p className={styles.text}>{rules.template}</p>
                <button
                  className={styles.delete}
                  type="button"
                  disabled={deleting !== undefined}
                  onClick={() => void remove("template", rules.template ?? "")}
                >
                  删除
                </button>
              </div>
            ) : (
              <p className={styles.empty}>还没有保存，用的是标准格式：{rules.defaultTemplate}</p>
            )}
          </section>

          <section className={styles.section}>
            <h2 className={styles.heading}>词语替换</h2>
            {rules.words.length === 0 && (
              <p className={styles.empty}>还没有。在首页点“加规则”添加。</p>
            )}
            {rules.words.map(word => (
              <div key={word.id} className={styles.rule}>
                <p className={styles.text}>
                  小票上的 {word.source} 写成 {word.target}
                </p>
                <button
                  className={styles.delete}
                  type="button"
                  disabled={deleting !== undefined}
                  onClick={() => void remove(word.id, `${word.source} → ${word.target}`)}
                >
                  删除
                </button>
              </div>
            ))}
          </section>

          <section className={styles.section}>
            <h2 className={styles.heading}>处理规则</h2>
            {rules.instructions.length === 0 && (
              <p className={styles.empty}>还没有。在首页点“加规则”添加。</p>
            )}
            {rules.instructions.map(instruction => (
              <div key={instruction.id} className={styles.rule}>
                <p className={styles.text}>{instruction.text}</p>
                <button
                  className={styles.delete}
                  type="button"
                  disabled={deleting !== undefined}
                  onClick={() => void remove(instruction.id, instruction.text)}
                >
                  删除
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
