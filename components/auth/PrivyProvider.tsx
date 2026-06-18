"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

// Configure Solana wallet connectors (Phantom, Solflare, Backpack, etc.)
const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

export default function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  console.log("Privy App ID:", process.env.NEXT_PUBLIC_PRIVY_APP_ID);

  if (!appId) {
    return (
      <>
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "rgba(255,82,82,0.15)", borderBottom: "1px solid #ff5252",
          padding: "8px 16px", fontSize: 12, color: "#ff5252", textAlign: "center",
        }}>
          ⚠️ NEXT_PUBLIC_PRIVY_APP_ID not set
        </div>
        {children}
      </>
    );
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#ffd700",
          // Required: tell Privy this is a Solana-only app
          walletChainType: "solana-only",
        },
        loginMethods: ["email", "wallet"],
        externalWallets: {
          solana: {
            // Required: pass the Solana connectors
            connectors: solanaConnectors,
          },
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
          noPromptOnSignature: true,
        },
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}