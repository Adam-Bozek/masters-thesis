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
    <>
      <main className="d-flex align-items-center justify-content-center min-vh-100 py-3 py-lg-0">
        <div className="container glass p-3 p-lg-5 mx-3">
          <div className="row g-3 g-lg-4 align-items-stretch">
            <div className={`col-lg-6 d-flex flex-column justify-content-center text-center ${styles.heroCol}`}>
              <h1 className={`${styles.title} mb-2`}>Vitajte! 👋</h1>
              <p className="mb-3">
                Táto webová aplikácia vznikla v rámci projektu <strong>3PoCube APVV-22-0261 </strong> ako súčasť praktickej časti diplomovej práce s
                názvom
                <strong> Aplikácia pre testovanie komunikačných schopností u detí</strong>. Slúži na skríning dieťaťa skrátenou verziou TEKOS II.
                Autorom aplikácie je <strong>Bc. Adam Božek</strong> pod vedením
                <strong> doc. Ing. Stanislava Ondáša, PhD.</strong> V prípade otázok kontaktujte vedúceho práce na e-mailovej adrese
                <a href="mailto:stanislav.ondas@tuke.sk"> stanislav.ondas@tuke.sk</a>.
              </p>

              <p>
                Katedra počítačových sietí:{" "}
                <a href="https://kps.fei.tuke.sk/" target="_blank" rel="noopener noreferrer">
                  https://kps.fei.tuke.sk/
                </a>
              </p>

              <p>
                Ďalšie testy:{" "}
                <a href="https://nlp.kemt.fei.tuke.sk/audiometry" target="_blank" rel="noopener noreferrer">
                  https://nlp.kemt.fei.tuke.sk/audiometry
                </a>
              </p>

              <p className="status-pill status-pill--active warning-pill py-1">
                Aplikácia sa stále vyvíja, preto sa v nej môžu vyskytnúť chyby. Ak nejakú nájdete, obráťte sa, prosím, na vedúceho diplomovej práce a
                pošlite aj popis chyby, prípadne fotografiu.
              </p>

              <p className="status-pill status-pill--active warning-pill py-1">
                Pre správne fungovanie webovej aplikácie je potrebné použiť prehliadač Google Chrome.
              </p>
              <div className="glass my-4 p-2 rounded-4 align-self-center" style={{ width: "max-content" }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "login" ? styles.active : ""} rounded-4`}
                  onClick={() => openMode("login")}
                >
                  Prihlásiť
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "register" ? styles.active : ""} rounded-4`}
                  onClick={() => openMode("register")}
                >
                  Registrovať
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "info"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "info" ? styles.active : ""} rounded-4`}
                  onClick={() => openMode("info")}
                >
                  Informácie
                </button>
              </div>
              <div className="glass my-4 p-2 rounded-4 align-self-center" style={{ width: "max-content" }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "demo"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "demo" ? styles.active : ""} rounded-4`}
                  onClick={() => openMode("demo")}
                >
                  Vyskúšať demo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "runWithoutRegister"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "runWithoutRegister" ? styles.active : ""} rounded-4`}
                  onClick={() => openMode("runWithoutRegister")}
                >
                  Spustiť bez registrácie
                </button>
              </div>
            </div>

            <div className="col-lg-6 d-flex flex-column justify-content-center align-items-center text-center">
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
          </div>
        </div>
      </main>
    </>
  );
}
