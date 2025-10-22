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
      {/* add small vertical padding on mobile only */}
      <main className="d-flex align-items-center py-3 py-lg-0">
        {/* lighter padding on phones, keep glass look */}
        <div className="container glass p-3 p-lg-5">
          {/* tighter gutters on phones, normal on desktop */}
          <div className="row g-3 g-lg-4 align-items-stretch">
            <h1 className={`${styles.title} mb-2`}>Zdravíme! 👋</h1>
            <p className="mb-3">
              Táto webová aplikácia vznikla ako súčasť praktickej časti diplomovej práce a slúži na testovanie dieťaťa
              skrátenou verziou testu TEKOS 2. Autorom je Bc. Adam Božek pod vedením doc. Ing. Stanislava Ondáša, PhD.
              Viac informácií nájdete v karte Informácie.
            </p>
            
          
          </div>
        </div>
      </main>
    </>
  );
}
