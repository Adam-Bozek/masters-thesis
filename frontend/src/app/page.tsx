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

  return (
    <>
      {/* add small vertical padding on mobile only */}
      <main className="d-flex align-items-center justify-content-center min-vh-100 py-3 py-lg-0">
        {/* lighter padding on phones, keep glass look */}
        <div className="container glass p-3 p-lg-5 mx-3">
          <div className="row g-3 g-lg-4 align-items-stretch">
            {/* use the lg-only height class */}
            <div className={`col-lg-6 d-flex flex-column justify-content-center text-center ${styles.heroCol}`}>
              <h1 className={`${styles.title} mb-2`}>Vitajte! 👋</h1>
              <p className="mb-3">
                Táto webová aplikácia vznikla ako súčasť praktickej časti diplomovej práce a slúži na testovanie dieťaťa skrátenou verziou testu TEKOS
                2. Autorom je Bc. Adam Božek pod vedením doc. Ing. Stanislava Ondáša, PhD. Viac informácií nájdete v karte Informácie.
              </p>

              <p className="status-pill status-pill--active warning-pill py-1">
                Pre správne fungovanie webovej aplikácie je potrbené použiť prehliadač Google Chrome.
              </p>

              <div className="glass my-4 p-2 rounded-4 align-self-center" style={{ width: "max-content" }}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "login"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "login" ? styles.active : ""} rounded-4`}
                  onClick={() => setMode("login")}
                >
                  Prihlásiť
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "register"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "register" ? styles.active : ""} rounded-4`}
                  onClick={() => setMode("register")}
                >
                  Registrovať
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "info"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "info" ? styles.active : ""} rounded-4`}
                  onClick={() => setMode("info")}
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
                  onClick={() => setMode("demo")}
                >
                  Vyskúšať demo
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === "runWithoutRegister"}
                  aria-controls="auth-pane"
                  className={`${styles.segBtn} ${mode === "runWithoutRegister" ? styles.active : ""} rounded-4`}
                  onClick={() => setMode("runWithoutRegister")}
                >
                  Spustiť bez registrácie
                </button>
              </div>
            </div>

            <div className="col-lg-6 d-flex flex-column justify-content-center align-items-center text-center">
              {mode === "login" ? (
                <Login setMode={setMode} />
              ) : mode === "register" ? (
                <Register setMode={setMode} />
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
