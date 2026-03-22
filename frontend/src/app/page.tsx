"use client";

import { useState } from "react";

import Login from "@/components/public/Login";
import Register from "@/components/public/Register";
import Info from "@/components/public/Info";
import Demo from "@/components/public/Demo";
import RunWithoutRegister from "@/components/public/RunWithoutRegister";

import "@/components/css/global.css";
import styles from "@/components/css/home.module.css";

type Mode = "login" | "register" | "info" | "demo" | "runWithoutRegister";

const NAV_ITEMS: { key: Mode; label: string }[] = [
  { key: "register", label: "Registrácia" },
  { key: "login", label: "Prihlásenie" },
  { key: "demo", label: "Demo" },
  { key: "runWithoutRegister", label: "Bez registrácie" },
  { key: "info", label: "Info" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("register");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openMode = (nextMode: Mode) => {
    if (nextMode !== "login") {
      setSuccessMessage(null);
    }
    setMode(nextMode);
  };

  return (
    <main className={styles.viewport}>
      <div className={`container ${styles.frameWrap}`}>
        <section className={`glass ${styles.frame}`}>
          <div className={styles.layout}>
            <aside className={styles.heroPane}>
              <div>
                <h1 className={`${styles.title} m-4`}>Vitajte! 👋</h1>
                <p className={`${styles.heroText} mx-4 mb-3`}>
                  Táto webová aplikácia vznikla v rámci projektu <strong>3PoCube APVV-22-0261 </strong> ako súčasť praktickej časti diplomovej práce
                  na Technickej Univerzite v Košiciach s názvom
                  <strong> Aplikácia pre testovanie komunikačných schopností u detí</strong>. Slúži na skríning dieťaťa skrátenou verziou TEKOS II.
                </p>
              </div>

              <article className="info-card compact-card">
                <h4>Užitočné informácie:</h4>
                <p className="my-1">
                  Katedra počitačových sietí:
                  <a href="https://kps.fei.tuke.sk/" target="_blank" rel="noopener noreferrer">
                    https://kps.fei.tuke.sk/
                  </a>
                </p>
                <p className="mb-1">
                  Ďalšie testy:
                  <a href="https://nlp.kemt.fei.tuke.sk/audiometry" target="_blank" rel="noopener noreferrer">
                    https://nlp.kemt.fei.tuke.sk/audiometry
                  </a>
                </p>
              </article>
              <div className={styles.heroCards}>
                <article className="info-card compact-card">
                  <h4>Autor</h4>
                  <p>Bc. Adam Božek</p>
                </article>
                <article className="info-card compact-card">
                  <h4>Vedúci práce</h4>
                  <p className="mb-1">doc. Ing. Stanislav Ondáš, PhD.</p>
                  <p>
                    kontakt: <a href="mailto:stanislav.ondas@tuke.sk">stanislav.ondas@tuke.sk</a>
                  </p>
                </article>
              </div>
              <p className="status-pill status-pill--active warning-pill py-1 m-0">
                Pre správne fungovanie webovej aplikácie je potrebné použiť prehliadač Google Chrome.
              </p>
              <p className="status-pill status-pill--active warning-pill py-1 m-0">
                Aplikácia sa stále vyvíja, preto sa v nej môžu vyskytnúť chyby. Ak nejakú nájdete, obráťte sa, prosím, na vedúceho diplomovej práce a
                pošlite aj popis chyby, prípadne fotografiu.
              </p>
            </aside>

            <section className={styles.panelPane}>
              <nav className={styles.navGrid} aria-label="Hlavná navigácia">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={mode === item.key}
                    aria-controls="auth-pane"
                    className={`${styles.segBtn} ${styles.navBtn} ${mode === item.key ? styles.active : ""}`}
                    onClick={() => openMode(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className={styles.panelCard} id="auth-pane">
                {mode === "login" ? (
                  <Login setMode={setMode} successMessage={successMessage} clearSuccessMessage={() => setSuccessMessage(null)} />
                ) : mode === "register" ? (
                  <Register setMode={setMode} setSuccessMessage={setSuccessMessage} />
                ) : mode === "info" ? (
                  <Info />
                ) : mode === "demo" ? (
                  <Demo />
                ) : mode === "runWithoutRegister" ? (
                  <RunWithoutRegister />
                ) : null}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
