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
  const { wallets } = useSolanaWallets();

  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSyncing = useRef(false);

  // Primary Solana wallet — embedded or external
  const solanaWallet = wallets[0]?.address ?? null;

  const syncSession = useCallback(async (wallet: string, privyId: string) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
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
    if (ready && authenticated && user && solanaWallet) {
      syncSession(solanaWallet, user.id);
    }
    if (ready && !authenticated) {
      setSession(null);
    }
  }, [ready, authenticated, user, solanaWallet, syncSession]);

  const logout = useCallback(async () => {
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
    if (solanaWallet && user?.id) syncSession(solanaWallet, user.id);
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
    isPhantomInstalled: true, // Privy handles wallet detection
  };
}
