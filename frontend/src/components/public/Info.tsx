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
