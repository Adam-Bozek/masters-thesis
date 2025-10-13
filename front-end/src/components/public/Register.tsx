"use client";

import { useState } from "react";
import { useAuth } from "../../utilities/AuthContext";
import type { Dispatch, SetStateAction } from "react";

import styles from "@/components/css/home.module.css";

type Mode = "login" | "register" | "info";

interface Props {
  setMode: Dispatch<SetStateAction<Mode>>;
}

export default function Register({ setMode }: Props) {
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

    if (password !== confirm) {
      setErr("Heslá sa nezhodujú.");
      return;
    }

    setPending(true);

    try {
      await register(firstName.trim(), lastName.trim(), email.trim(), password);
      setMode("login")
    } catch (e: unknown) {
      if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("Registrácia zlyhala. Skúste znova.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} noValidate>
        <header className="mb-3">
          <h2 className="h4 mb-1">Vytvorte si účet</h2>
          <p className="text-secondary small m-0">Zaregistrujte sa e-mailom a heslom</p>
        </header>

        <div className="form-floating mb-2">
          <input
            type="text"
            className="form-control glass-input"
            id="regFirst"
            placeholder="Janko"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <label htmlFor="regFirst">Meno</label>
        </div>

        <div className="form-floating mb-2">
          <input
            type="text"
            className="form-control glass-input"
            id="regLast"
            placeholder="Novák"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <label htmlFor="regLast">Priezvisko</label>
        </div>

        <div className="form-floating mb-2">
          <input
            type="email"
            className="form-control glass-input"
            id="regEmail"
            placeholder="janko.novak@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="regEmail">E-mail</label>
        </div>

        <div className="form-floating mb-2">
          <input
            type="password"
            className="form-control glass-input"
            id="regPass"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <label htmlFor="regPass">Heslo</label>
        </div>

        <div className="form-floating mb-3">
          <input
            type="password"
            className="form-control glass-input"
            id="regConfirm"
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
          />
          <label htmlFor="regConfirm">Zopakujte heslo</label>
        </div>

        {err && (
          <div className="alert alert-danger py-2" role="alert" aria-live="polite">
            {err}
          </div>
        )}

        <button type="submit" className={`${styles.segBtn} ${styles.active} w-75 rounded-4`} disabled={pending}>
          {pending ? "Prebieha…" : "Vytvoriť účet"}
        </button>
      </form>

      <p className="mt-2 small">
        Už máte účet?{" "}
        <button className={styles.linkBtn} onClick={() => setMode("login")}>
          Prihlásiť sa
        </button>
      </p>
    </>
  );
}
