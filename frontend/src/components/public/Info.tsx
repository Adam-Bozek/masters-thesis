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
          <p>Aplikácia slúži na orientačný skríning komunikačných schopností dieťaťa.</p>
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
          <h4>Pred začiatkom</h4>
          <ul className="feature-list compact-list mb-0">
            {INFO_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="info-card compact-card text-start anon-grid__wide">
          <h4>Zdrojový kód</h4>
          <p>
            Github:{" "}
            <a href="https://github.com/Adam-Bozek/masters-thesis" target="_blank" rel="noopener noreferrer">
              https://github.com/Adam-Bozek/masters-thesis
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
