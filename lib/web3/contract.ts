import { ethers } from "ethers";

// Copy the ABI from SpinContract.sol after compiling, or use the minimal ABI below
export const SPIN_CONTRACT_ABI = [
  "function spin(uint8 tier) payable returns (uint256)",
  "function standardPrice() view returns (uint256)",
  "function premiumPrice() view returns (uint256)",
  "event SpinRequested(address indexed player, uint8 tier, uint256 requestId, uint256 timestamp)",
] as const;

export const SPIN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SPIN_CONTRACT_ADDRESS ?? "";

export const SEPOLIA_CHAIN_ID = 11155111;

export type GachaTier = "STANDARD" | "PREMIUM";

/**
 * Gets a signer-connected contract instance.
 * Call from browser only (requires window.ethereum / MetaMask).
 */
export async function getSpinContract() {
  if (!window.ethereum) throw new Error("MetaMask not detected. Please install MetaMask.");

  const provider = new ethers.BrowserProvider(window.ethereum as any);
  const network = await provider.getNetwork();

  if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
    // Request chain switch
    await (window.ethereum as any).request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
    });
  }

  const signer = await provider.getSigner();
  return new ethers.Contract(SPIN_CONTRACT_ADDRESS, SPIN_CONTRACT_ABI, signer);
}

/**
 * Execute a gacha spin on-chain.
 * Returns the transaction hash for backend verification.
 */
export async function executeSpin(tier: GachaTier): Promise<string> {
  if (!SPIN_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_SPIN_CONTRACT_ADDRESS not set in .env");
  }

  const contract = await getSpinContract();
  const price = tier === "STANDARD"
    ? await contract.standardPrice()
    : await contract.premiumPrice();

  const tx = await contract.spin(tier === "STANDARD" ? 0 : 1, { value: price });
  const receipt = await tx.wait();

  return receipt.hash;
}
