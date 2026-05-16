"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="ca">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            padding: 32,
            border: "1px solid #fecaca",
            borderRadius: 8,
            background: "#fff",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 18, margin: 0, color: "#0f172a" }}>
            Alguna cosa ha fallat
          </h1>
          <p style={{ marginTop: 8, fontSize: 13, color: "#52525b" }}>
            {error.message || "Error desconegut"}
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: 6,
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
                color: "#a1a1aa",
              }}
            >
              digest: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 20,
              padding: "6px 14px",
              fontSize: 13,
              border: "1px solid #d4d4d8",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Torna a provar
          </button>
        </div>
      </body>
    </html>
  );
}
