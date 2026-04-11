/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-03-22 13:44:04
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
  setSuccessMessage: Dispatch<SetStateAction<string | null>>;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RULES = {
  minLength: 8,
  upper: /[A-Z]/,
  lower: /[a-z]/,
  number: /\d/,
  special: /[^A-Za-z0-9]/,
};

export default function Register({ setMode, setSuccessMessage }: Props) {
  const { register } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  const trimmedFirstName = firstName.trim();
  const trimmedLastName = lastName.trim();
  const trimmedEmail = email.trim();

  const isEmailValid = EMAIL_REGEX.test(trimmedEmail);

  const passwordChecks = {
    length: password.length >= PASSWORD_RULES.minLength,
    upper: PASSWORD_RULES.upper.test(password),
    lower: PASSWORD_RULES.lower.test(password),
    number: PASSWORD_RULES.number.test(password),
    special: PASSWORD_RULES.special.test(password),
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);
  const isConfirmValid = confirm.length > 0 && password === confirm;

  const getPasswordError = () => {
    if (!password) return "Zadajte heslo.";
    if (!passwordChecks.length) return "Heslo musí mať aspoň 8 znakov.";
    if (!passwordChecks.upper) return "Heslo musí obsahovať aspoň jedno veľké písmeno.";
    if (!passwordChecks.lower) return "Heslo musí obsahovať aspoň jedno malé písmeno.";
    if (!passwordChecks.number) return "Heslo musí obsahovať aspoň jedno číslo.";
    if (!passwordChecks.special) return "Heslo musí obsahovať aspoň jeden špeciálny znak.";
    return "";
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidated(true);
    setErr(null);
    setSuccessMessage(null);

    if (!trimmedFirstName || !trimmedLastName) {
      setErr("Vyplňte meno aj priezvisko.");
      return;
    }

    if (!isEmailValid) {
      setErr("Zadajte platnú e-mailovú adresu.");
      return;
    }

    if (!isPasswordValid) {
      setErr(getPasswordError());
      return;
    }

    if (!isConfirmValid) {
      setErr("Heslá sa nezhodujú.");
      return;
    }

    setPending(true);

    try {
      await register(trimmedFirstName, trimmedLastName, trimmedEmail, password);
      setSuccessMessage("Registrácia prebehla úspešne. Teraz sa môžete prihlásiť.");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirm("");
      setValidated(false);
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
      <form onSubmit={handleSubmit} noValidate className={`${styles.formWidth} ${validated ? "was-validated" : ""}`}>
        <header className="mb-2">
          <h3 className=" mb-1">Registrácia</h3>
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
              <div className="invalid-feedback text-start">Zadajte meno.</div>
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
              <div className="invalid-feedback text-start">Zadajte priezvisko.</div>
            </div>
          </div>
        </div>

        <div className="form-floating mb-2">
          <input
            type="email"
            className={`form-control glass-input compact-input ${validated && trimmedEmail && !isEmailValid ? "is-invalid" : ""}`}
            id="regEmail"
            placeholder="janko.novak@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="regEmail">E-mail</label>
          <div className="invalid-feedback text-start">Zadajte platnú e-mailovú adresu.</div>
        </div>

        <div className="row g-2 mb-2">
          <div className="col-6">
            <div className="form-floating">
              <input
                type="password"
                className={`form-control glass-input compact-input ${validated && password && !isPasswordValid ? "is-invalid" : ""}`}
                id="regPass"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={PASSWORD_RULES.minLength}
              />
              <label htmlFor="regPass">Heslo</label>
              <div className="invalid-feedback text-start">{getPasswordError()}</div>
            </div>
          </div>

          <div className="col-6">
            <div className="form-floating">
              <input
                type="password"
                className={`form-control glass-input compact-input ${validated && confirm && !isConfirmValid ? "is-invalid" : ""}`}
                id="regConfirm"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={PASSWORD_RULES.minLength}
              />
              <label htmlFor="regConfirm">Potvrdiť</label>
              <div className="invalid-feedback text-start">Heslá sa musia zhodovať.</div>
            </div>
          </div>
        </div>

        <div className="form-text text-start small mt-1">Minimálne 8 znakov, veľké a malé písmeno, číslo a špeciálny znak.</div>

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
        <button type="button" className={styles.linkBtn} onClick={() => setMode("login")}>
          Prihlásiť sa
        </button>
      </p>
    </div>
  );
}
