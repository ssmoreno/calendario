"use client";

import { useEffect, useState } from "react";

import styles from "./whatsapp-link.module.css";

interface WhatsAppStatus {
  waId: string | null;
  code: string | null;
}

export function WhatsAppLink() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/whatsapp", { cache: "no-store" })
      .then((response) => response.json() as Promise<WhatsAppStatus>)
      .then(setStatus);
  }, []);

  async function update(method: "POST" | "DELETE") {
    setBusy(true);
    try {
      const response = await fetch("/api/whatsapp", { method });
      if (!response.ok) throw new Error("WhatsApp could not be updated.");
      setStatus((await response.json()) as WhatsAppStatus);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.section} aria-label="WhatsApp connection">
      <strong>WhatsApp</strong>
      {status?.waId ? (
        <>
          <span>Connected to +{status.waId}</span>
          <button disabled={busy} type="button" onClick={() => void update("DELETE")}>
            Disconnect
          </button>
        </>
      ) : (
        <>
          {status?.code ? (
            <span>Text <b>{status.code}</b> to the SS WhatsApp number.</span>
          ) : (
            <span>Connect this account to message the calendar agent.</span>
          )}
          <button disabled={busy} type="button" onClick={() => void update("POST")}>
            {status?.code ? "New code" : "Connect"}
          </button>
        </>
      )}
    </section>
  );
}
