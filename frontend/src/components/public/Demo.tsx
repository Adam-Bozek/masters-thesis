/**
 * @ Author: Bc. Adam Božek
 * @ Create Time: 2026-03-22 13:44:02
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

import { useRouter } from "next/navigation";

export default function Demo() {
  const router = useRouter();

  return (
    <div className="content-stack compact-stack w-100 align-items-center text-center">
      <div>
        <h3 className="mb-1">Demo režim</h3>
        <p className="lead-muted compact-lead mb-0">Rýchla ukážka rozhrania bez registrácie a bez trvalého uloženia dát.</p>
      </div>

      <div className="info-grid info-grid--compact compact-grid">
        <section className="info-card compact-card text-start">
          <h4>Na vyskúšanie</h4>
          <p>Pozriete si priebeh a ovládanie pred prvým použitím.</p>
        </section>
        <section className="info-card compact-card text-start">
          <h4>Bez záväzkov</h4>
          <p>Ukážka neslúži na finálne vyhodnotenie.</p>
        </section>
      </div>

      <div className="d-flex gap-2 flex-wrap align-items-center justify-content-center">
        <button className="btn btn-primary rounded-pill px-4" onClick={() => router.push("/demo")}>
          Spustiť demo
        </button>
        <span className="text-muted small">Len na oboznámenie s aplikáciou.</span>
      </div>
    </div>
  );
}
