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

const INFO_ITEMS = ["Skríning prebieha po krokoch.", "Výsledok je orientačný.", "Najlepšie funguje v Chrome."];

export default function Info() {
  return (
    <div className="content-stack compact-stack w-100 align-items-center text-center">
      <div>
        <h3 className="mb-1">Základné informácie</h3>
        <p className="lead-muted compact-lead mb-0">Krátky prehľad pred spustením testu.</p>
      </div>

      <div className="anon-grid">
        <section className="info-card compact-card text-start">
          <h4>Účel</h4>
          <p>Jedná o experimentálnu aplikáciu, ktorá ukazuje možnosti gamifikácie a nenahrádza štandardný TEKOS</p>
        </section>

        <section className="info-card compact-card text-start">
          <h4>Priebeh</h4>
          <p>Počas testu sa zobrazujú scény a úlohy, pri ktorých vyberáte odpovede podľa pokynov.</p>
        </section>

        <section className="info-card compact-card text-start anon-grid__wide">
          <h4>Výsledok</h4>
          <p>Výstup je podklad na ďalšie posúdenie, nie náhrada odborného vyšetrenia.</p>
        </section>

        <section className="info-card compact-card text-start anon-grid__wide">
          <h4>Publikácia TEKOS II skr. ver.</h4>
          <p>
            Test bol vytvorený na zájklade tejto publikacie:
            <a
              href="https://detskarec.sk/uploads/documents/5/projekty-tekos-priloha-1-kapalkova-kaletov.pdf"
              target="_blank"
              rel="noopener noreferrer"
            >
              https://detskarec.sk/uploads/documents/5/projekty-tekos-priloha-1-kapalkova-kaletov.pdf
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
