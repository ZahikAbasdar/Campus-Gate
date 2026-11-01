const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const deploymentPath = path.join(__dirname, "contract.json");
const deployment = fs.existsSync(deploymentPath)
  ? JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
  : null;
const artifactPath = path.join(__dirname, "..", "artifacts", "contracts", "CampusVehicleLog.sol", "CampusVehicleLog.json");
const artifact = fs.existsSync(artifactPath)
  ? JSON.parse(fs.readFileSync(artifactPath, "utf8"))
  : null;
const address = process.env.CONTRACT_ADDRESS || deployment?.address;
const abi = deployment?.abi || artifact?.abi;

if (!process.env.RPC_URL) throw new Error("RPC_URL must be configured");
if (!address || !ethers.isAddress(address)) {
  throw new Error("Set CONTRACT_ADDRESS or generate backend/contract.json by deploying the contract");
}
if (!Array.isArray(abi) || abi.length === 0) {
  throw new Error("Contract ABI is unavailable; compile the contract before starting the backend");
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const contract = new ethers.Contract(address, abi, provider);

const hashPlate = (plate) =>
  ethers.keccak256(ethers.toUtf8Bytes(plate.trim().toUpperCase() + process.env.PLATE_SALT));

function getEvent(receipt, name) {
  for (const l of receipt.logs) {
    try {
      const e = contract.interface.parseLog(l);
      if (e && e.name === name) return e;
    } catch {}
  }
}

module.exports = {
  contract,
  hashPlate,
  getEvent,
  provider,
  address,
  abi,
};
