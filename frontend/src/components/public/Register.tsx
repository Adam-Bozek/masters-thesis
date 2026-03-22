"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { useAuth } from "../../utilities/AuthContext";
import styles from "@/components/css/home.module.css";

type Mode = "login" | "register" | "info" | "demo" | "runWithoutRegister";

interface Props {
  setMode: Dispatch<SetStateAction<Mode>>;
  setSuccessMessage: Dispatch<SetStateAction<string | null>>;
}

export default function Register({ setMode, setSuccessMessage }: Props) {
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccessMessage(null);

    if (password !== confirm) {
      setErr("Heslá sa nezhodujú.");
      return;
    }

    setPending(true);

    try {
      await register(firstName.trim(), lastName.trim(), email.trim(), password);
      setSuccessMessage("Registrácia prebehla úspešne. Teraz sa môžete prihlásiť.");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirm("");
      setMode("login");
    } catch (error: unknown) {
      if (error instanceof Error && error.message.trim()) {
        setErr(error.message);
      } else {
        setErr("Registrácia zlyhala. Skúste znova.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="content-stack compact-stack w-100 align-items-center text-center">
      <form onSubmit={handleSubmit} noValidate className={styles.formWidth}>
        <header className="mb-2 text-start">
          <h2 className="h4 mb-1">Registrácia</h2>
          <p className="text-secondary small mb-2">
            Účet pre ukladanie testov a výsledkov. <span className="status-pill status-pill--done warning-pill">Odporúčame</span>
          </p>
        </header>

        <div className="row g-2 mb-2">
          <div className="col-6">
            <div className="form-floating">
              <input
                type="text"
                className="form-control glass-input compact-input"
                id="regFirst"
                placeholder="Meno"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <label htmlFor="regFirst">Meno</label>
            </div>
          </div>
          <div className="col-6">
            <div className="form-floating">
              <input
                type="text"
                className="form-control glass-input compact-input"
                id="regLast"
                placeholder="Priezvisko"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
              <label htmlFor="regLast">Priezvisko</label>
            </div>
          </div>
        </div>

        <div className="form-floating mb-2">
          <input
            type="email"
            className="form-control glass-input compact-input"
            id="regEmail"
            placeholder="janko.novak@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="regEmail">E-mail</label>
        </div>

        <div className="row g-2 mb-2">
          <div className="col-6">
            <div className="form-floating">
              <input
                type="password"
                className="form-control glass-input compact-input"
                id="regPass"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <label htmlFor="regPass">Heslo</label>
            </div>
          </div>
          <div className="col-6">
            <div className="form-floating">
              <input
                type="password"
                className="form-control glass-input compact-input"
                id="regConfirm"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
              <label htmlFor="regConfirm">Potvrdiť</label>
            </div>
          </div>
        </div>

        {err && (
          <div className="alert alert-danger py-2 text-start mb-2" role="alert" aria-live="polite">
            {err}
          </div>
        )}

        <button type="submit" className={`${styles.segBtn} ${styles.active} w-100 rounded-4`} disabled={pending}>
          {pending ? "Registrujem..." : "Vytvoriť účet"}
        </button>
      </form>

      <p className="mb-0 small text-center">
        Už máte účet?{" "}
        <button className={styles.linkBtn} onClick={() => setMode("login")}>
          Prihlásiť sa
        </button>
      </p>
    </div>
  );
}
