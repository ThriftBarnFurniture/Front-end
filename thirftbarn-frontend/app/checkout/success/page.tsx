"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";

export default function CheckoutSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const { clear } = useCart();

  useEffect(() => {
    // Clear cart after successful checkout
    clear();
  }, [clear]);

  const sessionId = params.get("session_id");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem", color: "black", marginTop: "200px"}}>
      <h1 style={{ fontSize: "2rem", fontWeight: 900 }}>Payment successful ✅</h1>
      <p style={{ opacity: 0.9, marginTop: 10 }}>
        Thank you! Your order is being processed.
      </p>

      {sessionId && (
        <p style={{ opacity: 0.75, marginTop: 10 }}>
          Session: <code>{sessionId}</code>
        </p>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <button
          onClick={() => router.push("/shop")}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0, 0, 0, 0.18)",
            background: "rgba(0, 0, 0, 0.12)",
            color: "black",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          Continue shopping
        </button>

        <button
          onClick={() => router.push("/account/orders")}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "1px solid rgba(0, 0, 0, 0.18)",
            background: "rgba(0, 0, 0, 0.25)",
            color: "black",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          View orders
        </button>
      </div>
    </div>
  );
}
