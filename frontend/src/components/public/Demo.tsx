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
