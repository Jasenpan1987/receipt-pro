import styles from "./page.module.css";

// Placeholder until T-003 adds capture and the receipt list.
export default function HomePage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>receipt-pro</h1>
      <p>本地版本已启动。拍照功能还没有做。</p>
    </main>
  );
}
