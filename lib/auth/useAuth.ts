"use client";

import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useState, useEffect, useCallback, useRef } from "react";

export interface UserSession {
  id: string;
  solanaWallet: string;
  privyUserId: string | null;
  teamId: string;
  displayName: string | null;
  avatarBase64: string | null;
  managerLevel: number;
  managerExp: number;
  totalWins: number;
  totalMatches: number;
  team: {
    id: string;
    name: string;
    logoSvg: string | null;
    jerseyColor: string;
    budget: number;
  };
}

export function useAuth() {
  const { ready, authenticated, user, login, logout: privyLogout } = usePrivy();
  const { wallets, createWallet } = useSolanaWallets();

  const [session, setSession] = useState<UserSession | null>(null);
  // Start as true — stays true until first sync attempt completes.
  // This prevents AuthWall from briefly showing LandingPage between
  // "Privy authenticated" and "session fetched from /api/auth".
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSyncing = useRef(false);
  const hasSynced = useRef(false);

  // Primary Solana wallet — embedded or external
  const solanaWallet = wallets[0]?.address ?? null;

  const syncSession = useCallback(async (wallet: string, privyId: string) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    hasSynced.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet: wallet, privyUserId: privyId }),
      });
      const data = await res.json();
      if (res.ok) setSession(data.session);
      else setError(data.error ?? "Failed to sync session");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
      isSyncing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!ready || !authenticated || !user) {
      if (ready && !authenticated) {
        setSession(null);
        setLoading(false); // not logged in — stop loading, show LandingPage
        hasSynced.current = false;
      }
      return;
    }

    // Case 1: wallet already available → sync immediately
    if (solanaWallet && !hasSynced.current) {
      syncSession(solanaWallet, user.id);
      return;
    }

    // Case 2: authenticated but no wallet yet (email login — embedded wallet being created)
    // Poll every 500ms until wallet appears, max 15s
    if (!solanaWallet && !hasSynced.current) {
      let attempts = 0;
      const maxAttempts = 30; // 30 × 500ms = 15s

      const interval = setInterval(async () => {
        attempts++;

        // Try to create wallet if it doesn't exist yet
        if (attempts === 3) {
          try {
            await createWallet();
          } catch {
            // Wallet might already be in creation, ignore
          }
        }

        // Check if wallet appeared
        const currentWallets = wallets;
        if (currentWallets.length > 0 && currentWallets[0]?.address) {
          clearInterval(interval);
          syncSession(currentWallets[0].address, user.id);
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setError("Wallet setup timed out. Please refresh and try again.");
          setLoading(false);
        }
      }, 500);

      setLoading(true);
      return () => clearInterval(interval);
    }
  }, [
    ready,
    authenticated,
    user,
    solanaWallet,
    syncSession,
    wallets,
    createWallet,
  ]);

  // When wallet appears after polling, sync if not yet done
  useEffect(() => {
    if (
      solanaWallet &&
      authenticated &&
      user &&
      !hasSynced.current &&
      !isSyncing.current
    ) {
      syncSession(solanaWallet, user.id);
    }
  }, [solanaWallet, authenticated, user, syncSession]);

  const logout = useCallback(async () => {
    hasSynced.current = false;
    await privyLogout();
    setSession(null);
    setError(null);
  }, [privyLogout]);

  const updateProfile = useCallback(
    async (updates: {
      displayName?: string;
      avatarBase64?: string;
      teamName?: string;
    }) => {
      if (!solanaWallet) return false;
      const res = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet, ...updates }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        return true;
      }
      return false;
    },
    [solanaWallet],
  );

  const refetch = useCallback(() => {
    if (solanaWallet && user?.id) {
      hasSynced.current = false;
      syncSession(solanaWallet, user.id);
    }
  }, [solanaWallet, user, syncSession]);

  return {
    ready,
    authenticated,
    connected: authenticated && !!session,
    loading,
    error,
    session,
    walletAddress: solanaWallet,
    login,
    logout,
    updateProfile,
    refetch,
    isPhantomInstalled: true,
  };
}
