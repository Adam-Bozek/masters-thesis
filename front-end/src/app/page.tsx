"use client";

import { useState } from "react";

import Login from "@/components/public/Login";
import Register from "@/components/public/Register";
import Info from "@/components/public/Info";

import "@/components/css/global.css";

import styles from "@/components/css/home.module.css";

type Mode = "login" | "register" | "info";

export default function Home() {
  const [mode, setMode] = useState<Mode>("register");

  return (
    <>
      <main className="d-flex align-items-center ">
        <div className="container glass p-5">
          <div className="row align-items-stretch">
            <div className="col-lg-6 d-flex flex-column justify-content-center text-center m-5 px-5 py-4">
              <h1 className={`${styles.title}`}>Vitajte! 👋</h1>
              <p>
                Táto webová aplikácia vznikla ako súčasť praktickej časti diplomovej práce a slúži na testovanie dieťaťa
                skrátenou verziou testu TEKOS 2. Autorom je Bc. Adam Božek pod vedením doc. Ing. Stanislava Ondáša, PhD.
                Viac informácií nájdete v karte Informácie.
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
            </div>

            <div className={`${styles.fieldsWidth} col-lg-6 d-flex flex-column justify-content-center text-center`}>
              {mode === "login" ? (
                <Login setMode={setMode} />
              ) : mode === "register" ? (
                <Register setMode={setMode} />
              ) : (
                <Info />
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
