import { network } from "hardhat";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: "backend/.env" });

async function main() {
  const { ethers } = await network.create();
  const [deployer] = await ethers.getSigners();
  const walletAddress = process.env.METAMASK_ADDRESS;
  if (!walletAddress || !ethers.isAddress(walletAddress)) {
    throw new Error("Set METAMASK_ADDRESS in backend/.env to your MetaMask account address");
  }
  const c = await ethers.deployContract("CampusVehicleLog");
  await c.waitForDeployment();
  const address = await c.getAddress();
  const adminRole = await c.DEFAULT_ADMIN_ROLE();
  await (await c.grantRole(adminRole, walletAddress)).wait();
  await (await c.addGuard(walletAddress)).wait();
  const isLocalChain = Number((await ethers.provider.getNetwork()).chainId) === 31337;
  if (isLocalChain && walletAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await deployer.sendTransaction({
      to: walletAddress,
      value: ethers.parseEther("10"),
    })).wait();
  }
  if (walletAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    await (await c.revokeRole(adminRole, deployer.address)).wait();
  }
  const artifact = JSON.parse(fs.readFileSync(
    new URL("../artifacts/contracts/CampusVehicleLog.sol/CampusVehicleLog.json", import.meta.url),
    "utf8",
  ));
  fs.writeFileSync("backend/contract.json", JSON.stringify({ address, abi: artifact.abi }, null, 2));
  console.log("Deployed at:", address, "\nMetaMask account:", walletAddress, "\nSaved to backend/contract.json");
}
main().catch((e) => { console.error(e); process.exit(1); });
