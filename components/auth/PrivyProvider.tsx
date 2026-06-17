"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: true });

export default function PrivyProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <>
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
          background: "rgba(255,82,82,0.15)", borderBottom: "1px solid #ff5252",
          padding: "8px 16px", fontSize: 12, color: "#ff5252", textAlign: "center",
        }}>
          ⚠️ NEXT_PUBLIC_PRIVY_APP_ID not set — see privy_step.txt
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
        },
        loginMethods: ["wallet", "email"],
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets", // auto-create for email users
          requireUserPasswordOnCreate: false,
        },
        solanaClusters: [
          {
            name: "devnet",
            rpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
          },
        ],
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
