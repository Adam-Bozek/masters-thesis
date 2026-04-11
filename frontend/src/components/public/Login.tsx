/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-03-22 13:44:03
 * @ Description: This repository contains a full-stack application suite developed within a master’s thesis.
		 It is designed to support the screening of children using the Slovak
		 implementation of the TEKOS II screening instrument, short version. Copyright (C) 2026  Bc. Adam Božek
 * @ License: This program is free software: you can redistribute it and/or modify it under the terms of
		 the GNU Affero General Public License as published by the Free Software Foundation, either
		 version 3 of the License, or any later version. This program is distributed in the hope
		 that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
		 of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
		 See the GNU Affero General Public License for more details.
		 You should have received a copy of the GNU Affero General Public License along with this program.
		 If not, see <https://www.gnu.org/licenses/>..
 */

"use client";

import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { useAuth } from "../../utilities/AuthContext";
import styles from "@/components/css/home.module.css";

type Mode = "login" | "register" | "info" | "demo" | "runWithoutRegister";

interface Props {
  setMode: Dispatch<SetStateAction<Mode>>;
  successMessage: string | null;
  clearSuccessMessage: () => void;
}

export default function Login({ setMode, successMessage, clearSuccessMessage }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    clearSuccessMessage();
    setPending(true);

    try {
      await login(email.trim(), password);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.trim()) {
        setErr(error.message);
      } else {
        setErr("Prihlásenie zlyhalo. Skúste znova.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="content-stack compact-stack w-100 align-items-center text-center">
      <form onSubmit={handleSubmit} noValidate className={styles.formWidth}>
        <header className="mb-2">
          <h3 className=" mb-1">Prihlásenie</h3>
          <p className="text-secondary small m-0">Pokračovanie v uloženej práci a výsledkoch.</p>
        </header>

        {successMessage && (
          <div className="alert alert-success py-2 mb-2" role="alert" aria-live="polite">
            {successMessage}
          </div>
        )}

        <div className="form-floating mb-2">
          <input
            type="email"
            className="form-control glass-input compact-input"
            id="loginEmail"
            placeholder="name@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (successMessage) {
                clearSuccessMessage();
              }
            }}
            required
          />
          <label htmlFor="loginEmail">E-mail</label>
        </div>

        <div className="form-floating mb-2">
          <input
            type="password"
            className="form-control glass-input compact-input"
            id="loginPassword"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (successMessage) {
                clearSuccessMessage();
              }
            }}
            required
            minLength={6}
          />
          <label htmlFor="loginPassword">Heslo</label>
        </div>

        {err && (
          <div className="alert alert-danger py-2 text-start mb-2" role="alert" aria-live="polite">
            {err}
          </div>
        )}

        <button type="submit" className={`${styles.segBtn} ${styles.active} w-100 rounded-4`} disabled={pending}>
          {pending ? "Prihlasujem..." : "Prihlásiť sa"}
        </button>
      </form>

      <p className="mb-0 small text-center">
        Nemáte účet?{" "}
        <button
          className={styles.linkBtn}
          onClick={() => {
            clearSuccessMessage();
            setMode("register");
          }}
        >
          Registrovať
        </button>
      </p>
    </div>
  );
}
