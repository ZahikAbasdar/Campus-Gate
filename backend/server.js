require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const Vehicle = require("./models/Vehicle");
const LogCache = require("./models/LogCache");
const { contract, hashPlate, getEvent, provider, address, abi } = require("./blockchain");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "16kb" }));

const err = (res, e, code = 400) =>
  res.status(code).json({ error: e.reason || e.shortMessage || e.message });
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

function validateProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  const required = [
    "MONGO_URI", "RPC_URL", "PUBLIC_RPC_URL", "CHAIN_ID", "PLATE_SALT", "JWT_SECRET",
    "ADMIN_USER", "ADMIN_PASS", "GUARD_USER", "GUARD_PASS",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(", ")}`);
  if (!process.env.CONTRACT_ADDRESS && !fs.existsSync(path.join(__dirname, "contract.json"))) {
    throw new Error("CONTRACT_ADDRESS must be configured for production");
  }
  if (process.env.PLATE_SALT.length < 32 || process.env.JWT_SECRET.length < 32) {
    throw new Error("PLATE_SALT and JWT_SECRET must each be at least 32 characters in production");
  }
  if (["admin123", "guard123"].includes(process.env.ADMIN_PASS) ||
      ["admin123", "guard123"].includes(process.env.GUARD_PASS) ||
      process.env.ADMIN_PASS.length < 12 ||
      process.env.GUARD_PASS.length < 12 ||
      process.env.ADMIN_PASS === process.env.GUARD_PASS ||
      process.env.ADMIN_USER === process.env.GUARD_USER) {
    throw new Error("Set unique, non-default admin and guard passwords before production");
  }
  if (!Number.isSafeInteger(Number(process.env.CHAIN_ID)) || Number(process.env.CHAIN_ID) <= 0) {
    throw new Error("CHAIN_ID must be a positive integer");
  }
}

// ---------- auth ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  let role = null;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) role = "admin";
  if (username === process.env.GUARD_USER && password === process.env.GUARD_PASS) role = "guard";
  if (!role) return res.status(401).json({ error: "Wrong username or password" });
  res.json({ token: jwt.sign({ role }, process.env.JWT_SECRET, { expiresIn: "8h" }), role });
});

const auth = (...roles) => (req, res, next) => {
  try {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    const u = jwt.verify(t, process.env.JWT_SECRET);
    if (!roles.includes(u.role)) return res.status(403).json({ error: "Not allowed" });
    next();
  } catch { res.status(401).json({ error: "Please log in" }); }
};

async function getSuccessfulTransaction(txHash) {
  if (typeof txHash !== "string" || !/^0x[0-9a-f]{64}$/i.test(txHash)) {
    throw new Error("A valid transaction hash is required");
  }
  const [tx, receipt] = await Promise.all([
    provider.getTransaction(txHash),
    provider.getTransactionReceipt(txHash),
  ]);
  if (!tx || !receipt) throw new Error("Transaction was not found on the configured blockchain");
  if (receipt.status !== 1) throw new Error("Blockchain transaction failed");
  if (!tx.to || tx.to.toLowerCase() !== address.toLowerCase()) {
    throw new Error("Transaction was not sent to the campus log contract");
  }
  return { tx, receipt };
}

app.get("/api/wallet/config", (_req, res) => {
  res.json({
    address,
    abi,
    chainId: Number(process.env.CHAIN_ID || 31337),
    rpcUrl: process.env.PUBLIC_RPC_URL || process.env.RPC_URL || "http://127.0.0.1:8545",
  });
});

app.get("/api/health", asyncRoute(async (_req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const [network] = await Promise.all([provider.getNetwork(), provider.getBlockNumber()]);
  const contractDeployed = (await provider.getCode(address)) !== "0x";
  const healthy = databaseConnected && contractDeployed &&
    Number(network.chainId) === Number(process.env.CHAIN_ID || 31337);
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "unavailable",
    database: databaseConnected ? "connected" : "disconnected",
    blockchain: contractDeployed ? "connected" : "contract_missing",
  });
}));

// ---------- vehicles ----------
app.post("/api/vehicles/prepare", auth("admin"), async (req, res) => {
  try {
    const { plate } = req.body;
    if (typeof plate !== "string" || !plate.trim()) throw new Error("Plate number is required");
    const p = plate.trim().toUpperCase();
    if (await Vehicle.exists({ plate: p })) throw new Error("Vehicle is already registered");
    res.json({ plate: p, plateHash: hashPlate(p) });
  } catch (e) { err(res, e); }
});

app.post("/api/vehicles/plate-hash", auth("admin", "guard"), async (req, res) => {
  try {
    const { plate } = req.body;
    if (typeof plate !== "string" || !plate.trim()) throw new Error("Plate number is required");
    const p = plate.trim().toUpperCase();
    const v = await Vehicle.findOne({ plate: p });
    if (!v) throw new Error("Vehicle not registered");
    res.json({ plate: p, plateHash: v.plateHash });
  } catch (e) { err(res, e); }
});

app.post("/api/vehicles", auth("admin"), async (req, res) => {
  try {
    const { plate, ownerName, phone, department, txHash } = req.body;
    if (typeof plate !== "string" || !plate.trim()) throw new Error("Plate number is required");
    const p = plate.trim().toUpperCase();
    if (await Vehicle.exists({ plate: p })) throw new Error("Vehicle is already registered");
    const plateHash = hashPlate(p);
    const { receipt } = await getSuccessfulTransaction(txHash);
    const event = getEvent(receipt, "VehicleRegistered");
    if (!event || event.args.plateHash.toLowerCase() !== plateHash.toLowerCase()) {
      throw new Error("Transaction does not register this vehicle");
    }
    const chainVehicle = await contract.vehicles(plateHash);
    if (!chainVehicle.registered) throw new Error("Vehicle is not registered on the blockchain");
    const v = await Vehicle.create({ plate: p, plateHash, ownerName, phone, department, regTx: txHash });
    res.json(v);
  } catch (e) { err(res, e); }
});

app.get("/api/vehicles", auth("admin", "guard"), asyncRoute(async (_req, res) =>
  res.json(await Vehicle.find().sort("-createdAt"))));

// ---------- entry / exit ----------
async function record(action, plate, gateId, txHash) {
  if (typeof plate !== "string" || !plate.trim()) throw new Error("Plate number is required");
  const p = plate.trim().toUpperCase();
  const v = await Vehicle.findOne({ plate: p });
  if (!v) throw new Error("Vehicle not registered");
  const gate = Number(gateId);
  if (!Number.isInteger(gate) || gate < 1 || gate > 255) throw new Error("Gate number must be between 1 and 255");
  const { tx, receipt } = await getSuccessfulTransaction(txHash);
  const event = getEvent(receipt, "VehicleLogged");
  const expectedAction = action === "ENTRY" ? 0 : 1;
  if (!event ||
      event.args.plateHash.toLowerCase() !== v.plateHash.toLowerCase() ||
      Number(event.args.action) !== expectedAction ||
      Number(event.args.gateId) !== gate) {
    throw new Error("Transaction does not match this vehicle action and gate");
  }
  const logId = Number(event.args.logId);
  if (!Number.isSafeInteger(logId)) throw new Error("Blockchain log number is outside the supported range");
  const chainLog = await contract.getLog(logId);
  if (chainLog.guard.toLowerCase() !== tx.from.toLowerCase()) {
    throw new Error("Transaction sender does not match the recorded guard");
  }
  const existing = await LogCache.findOne({ logId });
  if (existing) {
    if (existing.txHash === tx.hash) return existing;
    throw new Error("This blockchain log is already cached");
  }
  return LogCache.create({
    logId, plate: p, plateHash: v.plateHash, action,
    gateId: gate, timestamp: Number(event.args.timestamp), txHash: tx.hash,
  });
}
app.post("/api/logs/entry", auth("guard", "admin"), async (req, res) => {
  try { res.json(await record("ENTRY", req.body.plate, req.body.gateId || 1, req.body.txHash)); } catch (e) { err(res, e); }
});
app.post("/api/logs/exit", auth("guard", "admin"), async (req, res) => {
  try { res.json(await record("EXIT", req.body.plate, req.body.gateId || 1, req.body.txHash)); } catch (e) { err(res, e); }
});

app.get("/api/logs", auth("admin", "guard"), asyncRoute(async (req, res) => {
  const plate = typeof req.query.plate === "string" ? req.query.plate.trim() : "";
  const escapedPlate = plate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const q = escapedPlate ? { plate: new RegExp(escapedPlate, "i") } : {};
  res.json(await LogCache.find(q).sort("-logId").limit(200));
}));

// vehicles currently inside (state read directly from the blockchain)
app.get("/api/inside", auth("admin", "guard"), asyncRoute(async (_req, res) => {
  const all = await Vehicle.find();
  const states = await Promise.all(all.map((v) => contract.vehicles(v.plateHash)));
  const out = all.filter((_v, index) => states[index].inside);
  res.json(out);
}));

// ---------- verification: blockchain vs MongoDB ----------
app.get("/api/verify/:logId", auth("admin", "guard"), async (req, res) => {
  try {
    const id = Number(req.params.logId);
    if (!Number.isSafeInteger(id) || id < 0) throw new Error("Log number must be a non-negative integer");
    const chain = await contract.getLog(id);
    const db = await LogCache.findOne({ logId: id });
    const txReceipt = db ? await provider.getTransactionReceipt(db.txHash) : null;
    const txEvent = txReceipt ? getEvent(txReceipt, "VehicleLogged") : null;
    const onChain = {
      plateHash: chain.plateHash, action: Number(chain.action) === 0 ? "ENTRY" : "EXIT",
      gateId: Number(chain.gateId), timestamp: Number(chain.timestamp), guard: chain.guard,
    };
    const match = !!db && db.plateHash === onChain.plateHash && db.action === onChain.action &&
      db.gateId === onChain.gateId && db.timestamp === onChain.timestamp &&
      !!txReceipt && txReceipt.status === 1 && !!txEvent &&
      Number(txEvent.args.logId) === id &&
      txEvent.args.plateHash.toLowerCase() === onChain.plateHash.toLowerCase() &&
      Number(txEvent.args.action) === Number(chain.action) &&
      Number(txEvent.args.gateId) === Number(chain.gateId) &&
      Number(txEvent.args.timestamp) === Number(chain.timestamp);
    res.json({ match, onChain, database: db });
  } catch (e) { err(res, e); }
});

app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found" }));
app.use(express.static(path.join(__dirname, "..", "frontend", "dist")));
app.get("*", (_req, res, next) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "dist", "index.html"), (e) => {
    if (e) next(e);
  });
});
app.use((e, _req, res, _next) => {
  console.error("API request failed:", e.message);
  res.status(e.status === 413 ? 413 : 500).json({
    error: e.status === 413 ? "Request body is too large" : "Unexpected server error",
  });
});

async function start() {
  validateProductionConfig();
  const network = await provider.getNetwork();
  if (Number(process.env.CHAIN_ID || 31337) !== Number(network.chainId)) {
    throw new Error(`Configured CHAIN_ID does not match RPC network (received ${network.chainId})`);
  }
  const code = await provider.getCode(address);
  if (code === "0x") throw new Error(`No contract is deployed at CONTRACT_ADDRESS on chain ${network.chainId}`);
  await mongoose.connect(process.env.MONGO_URI);
  const port = Number(process.env.PORT || 5000);
  await new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`Campus Gate server listening on port ${port} (chain ${network.chainId})`);
      resolve();
    });
    server.once("error", reject);
  });
}

if (require.main === module) {
  start().catch(async (e) => {
    console.error("Campus Gate startup failed:", e.message);
    await mongoose.disconnect();
    await provider.destroy();
    process.exitCode = 1;
  });
}

module.exports = { app, start };
