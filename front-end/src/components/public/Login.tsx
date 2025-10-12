"use client";

import { useState } from "react";
import { useAuth } from "../../utilities/AuthContext";
import type { Dispatch, SetStateAction } from "react";

import styles from "@/components/css/home.module.css";

type Mode = "login" | "register" | "info";

interface Props {
  setMode: Dispatch<SetStateAction<Mode>>;
}

export default function Login({ setMode }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await login(email.trim(), password);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message ?? "Prihlásenie zlyhalo. Skúste znova.");
      } else {
        setErr("Prihlásenie zlyhalo. Skúste znova.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <header className="mb-3">
          <h2 className="h4 mb-1">Vitajte späť</h2>
          <p className="text-secondary small m-0">Prihláste sa e-mailom a heslom</p>
        </header>

        <div className="form-floating mb-2">
          <input
            type="email"
            className="form-control glass-input"
            id="loginEmail"
            placeholder="name@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="loginEmail">E-mail</label>
        </div>

        <div className="form-floating mb-3">
          <input
            type="password"
            className="form-control glass-input"
            id="loginPassword"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <label htmlFor="loginPassword">Heslo</label>
        </div>

        {err && (
          <div className="alert alert-danger py-2" role="alert" aria-live="polite">
            {err}
          </div>
        )}

        <button type="submit" className={`${styles.segBtn} ${styles.active} w-75 rounded-4`} disabled={pending}>
          {pending ? "Prebieha…" : "Prihlásiť sa"}
        </button>
      </form>

      <p className="mt-3 small">
        Nemáte účet? {""}
        <button className={styles.linkBtn} onClick={() => setMode("register")}>
          Zaregistrujte sa
        </button>
      </p>
    </>
  );
}
