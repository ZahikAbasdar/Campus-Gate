import { defineConfig } from "hardhat/config";
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import dotenv from "dotenv";

dotenv.config({ path: "backend/.env" });
const networks = {
  hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
  localhost: {
    type: "http",
    chainType: "l1",
    url: process.env.RPC_URL || "http://127.0.0.1:8545",
  },
};

if (process.env.DEPLOYER_PRIVATE_KEY) {
  if (!process.env.RPC_URL || !process.env.CHAIN_ID) {
    throw new Error("RPC_URL and CHAIN_ID are required when DEPLOYER_PRIVATE_KEY is set");
  }
  networks.configured = {
    type: "http",
    chainType: "l1",
    url: process.env.RPC_URL,
    chainId: Number(process.env.CHAIN_ID),
    accounts: [process.env.DEPLOYER_PRIVATE_KEY],
  };
}

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: "0.8.20",
  networks,
});
