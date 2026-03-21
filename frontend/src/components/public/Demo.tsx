"use client";

import { useRouter } from "next/navigation";

export default function Demo() {
  const router = useRouter();

  return (
    <div className="w-100 p-4 rounded-4 border bg-white shadow-sm">
      <h3 className="mb-2">Demo ukážka</h3>
      <p className="text-muted mb-3">Krátka ukážka priebehu testovania bez ukladania údajov.</p>
      <button className="btn btn-primary rounded-pill px-4" onClick={() => router.push("/demo")}>
        Spustiť demo
      </button>
    </div>
  );
}
