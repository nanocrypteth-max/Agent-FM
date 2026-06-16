"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UserSession {
  id: string;
  solanaWallet: string;
  teamId: string;
  displayName: string | null;
  avatarBase64: string | null;
  team: {
    id: string;
    name: string;
    logoSvg: string | null;
    jerseyColor: string;
    budget: number;
  };
}

interface PhantomProvider {
  isPhantom: boolean;
  publicKey: { toString(): string } | null;
  connect(opts?: {
    onlyIfTrusted?: boolean;
  }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const phantom = (window as any).phantom?.solana ?? (window as any).solana;
  return phantom?.isPhantom ? phantom : null;
}

// Key used in localStorage to remember explicit logout
// Prevents Phantom auto-reconnect after user disconnects
const LOGGED_OUT_KEY = "ai_manager_logged_out";

function markLoggedOut() {
  try {
    localStorage.setItem(LOGGED_OUT_KEY, "1");
  } catch {}
}
function clearLoggedOut() {
  try {
    localStorage.removeItem(LOGGED_OUT_KEY);
  } catch {}
}
function isLoggedOut(): boolean {
  try {
    return localStorage.getItem(LOGGED_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function useAuth() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSyncing = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockSync = useRef(false); // in-memory block during logout sequence

  const clearState = useCallback(() => {
    setWalletAddress(null);
    setConnected(false);
    setSession(null);
    setError(null);
    setLoading(false);
  }, []);

  const syncSession = useCallback(async (address: string) => {
    // Block if user explicitly logged out
    if (blockSync.current || isLoggedOut()) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      if (blockSync.current || isLoggedOut()) return;
      if (isSyncing.current) return;
      isSyncing.current = true;
      setLoading(true);
      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solanaWallet: address }),
        });
        const data = await res.json();
        if (res.ok) {
          setSession(data.session);
          setConnected(true);
        } else {
          setError(data.error ?? "Failed to sync session");
        }
      } catch {
        setError("Network error — could not reach server");
      } finally {
        setLoading(false);
        isSyncing.current = false;
      }
    }, 150);
  }, []);

  // On mount: attempt trusted reconnect ONLY if user hasn't explicitly logged out
  useEffect(() => {
    const phantom = getPhantom();
    if (!phantom) {
      setReady(true);
      return;
    }

    // User previously clicked Disconnect — do NOT auto-reconnect
    if (isLoggedOut()) {
      setReady(true);
      return;
    }

    phantom
      .connect({ onlyIfTrusted: true })
      .then(({ publicKey }) => {
        if (blockSync.current || isLoggedOut()) return;
        const addr = publicKey.toString();
        setWalletAddress(addr);
        syncSession(addr);
      })
      .catch(() => {
        // Not previously authorized — normal, show landing page
      })
      .finally(() => setReady(true));

    const onConnect = (pk: { toString(): string }) => {
      if (blockSync.current || isLoggedOut()) return;
      const addr = pk.toString();
      setWalletAddress(addr);
      setConnected(true);
      syncSession(addr);
    };

    const onDisconnect = () => {
      // Phantom emitted disconnect (e.g. user disconnected from Phantom UI directly)
      // Only clear if this wasn't our own logout() call
      if (!blockSync.current) {
        clearState();
        markLoggedOut();
      }
    };

    const onAccountChange = (pk: { toString(): string } | null) => {
      if (blockSync.current || isLoggedOut()) return;
      if (!pk) {
        clearState();
        markLoggedOut();
        return;
      }
      const addr = pk.toString();
      setWalletAddress(addr);
      syncSession(addr);
    };

    phantom.on("connect", onConnect);
    phantom.on("disconnect", onDisconnect);
    phantom.on("accountChanged", onAccountChange);

    return () => {
      phantom.off("connect", onConnect);
      phantom.off("disconnect", onDisconnect);
      phantom.off("accountChanged", onAccountChange);
    };
  }, [syncSession, clearState]);

  const login = useCallback(async () => {
    setError(null);
    const phantom = getPhantom();
    if (!phantom) {
      setError(
        "Phantom wallet not found. Please install it from https://phantom.app",
      );
      return;
    }

    // Clear logged-out flag so syncSession is allowed again
    clearLoggedOut();
    blockSync.current = false;

    try {
      const { publicKey } = await phantom.connect();
      const addr = publicKey.toString();
      setWalletAddress(addr);
      await syncSession(addr);
    } catch (e: any) {
      if (e?.code !== 4001) {
        // 4001 = user rejected — not an error worth showing
        setError(e?.message ?? "Connection failed");
      }
    }
  }, [syncSession]);

  const logout = useCallback(async () => {
    // 1. Block all pending/future syncSession calls immediately
    blockSync.current = true;

    // 2. Cancel pending debounced sync
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    // 3. Persist logout state to localStorage
    //    This survives re-renders and prevents onlyIfTrusted auto-reconnect
    markLoggedOut();

    // 4. Clear React state — UI updates immediately
    clearState();

    // 5. Tell Phantom to disconnect
    const phantom = getPhantom();
    if (phantom) {
      await phantom.disconnect().catch(() => {});
    }

    // 6. Unblock after Phantom's events have settled (~500ms)
    //    User can now click "Connect" again if they want
    setTimeout(() => {
      blockSync.current = false;
      // NOTE: we do NOT clear the localStorage flag here.
      // It stays set until the user explicitly clicks Connect again (in login()).
    }, 500);
  }, [clearState]);

  const updateProfile = useCallback(
    async (updates: {
      displayName?: string;
      avatarBase64?: string;
      teamName?: string;
    }) => {
      if (!walletAddress) return false;
      const res = await fetch("/api/auth", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solanaWallet: walletAddress, ...updates }),
      });
      const data = await res.json();
      if (res.ok) setSession(data.session);
      return res.ok;
    },
    [walletAddress],
  );

  const isPhantomInstalled = typeof window !== "undefined" && !!getPhantom();

  return {
    ready,
    connected,
    loading,
    error,
    session,
    walletAddress,
    isPhantomInstalled,
    login,
    logout,
    updateProfile,
    refetch: () =>
      walletAddress ? syncSession(walletAddress) : Promise.resolve(),
  };
}
