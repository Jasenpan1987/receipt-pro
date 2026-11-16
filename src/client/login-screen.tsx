"use client";

import { type FormEvent, useState } from "react";
import type { ApiError } from "src/shared/api-types";

import styles from "./login-screen.module.css";

/** S-01: username and password; there is no sign-up (the one account is made by a script). */
export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
        signal: AbortSignal.timeout(20_000)
      });
      if (response.ok) {
        window.location.replace("/");
        return;
      }
      const body = (await response.json().catch(() => undefined)) as ApiError | undefined;
      setError(body?.error ?? "登录失败，请重试。");
    } catch {
      setError("连不上服务器，请检查网络后重试。");
    }
    setBusy(false);
  }

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <h1 className={styles.title}>receipt-pro</h1>
        <p className={styles.subtitle}>拍小票，出一行字</p>
        <form className={styles.form} onSubmit={event => void submit(event)}>
          <label className={styles.label}>
            用户名
            <input
              className={styles.input}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={event => setUsername(event.target.value)}
            />
          </label>
          <label className={styles.label}>
            密码
            <input
              className={styles.input}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <button className={styles.button} type="submit" disabled={busy || !username || !password}>
            {busy ? "正在登录…" : "登录"}
          </button>
        </form>
      </div>
    </main>
  );
}
