import { useState, useEffect } from "react";
import { BrowserProvider, Contract } from "ethers";
import { api } from "./api.js";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const fmt = (s) => new Date(s * 1000).toLocaleString();
const pages = {
  gate: { title: "Gate activity", subtitle: "A clear view of every arrival and departure." },
  admin: { title: "Vehicle registry", subtitle: DEMO_MODE ? "Browse fictional vehicle records in read-only mode." : "Manage campus access with a secure, verified record." },
  logs: { title: "Movement history", subtitle: DEMO_MODE ? "Explore fictional sample activity from the demo dataset." : "Explore recent gate activity across your campus." },
  verify: { title: DEMO_MODE ? "Sample record preview" : "Ledger verification", subtitle: DEMO_MODE ? "View a sample comparison; no live verification is performed." : "Compare a database record with its on-chain proof." },
};

function Icon({ name, size = 18 }) {
  const paths = {
    campus: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    gate: <><path d="M4 20V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15" /><path d="M8 20v-8h8v8M12 7v2" /></>,
    car: <><path d="m5 11 1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" /><path d="M3 11h18v7H3zM6 18v2m12-2v2M6 14h.01M18 14h.01" /></>,
    history: <><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    verify: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 8V6a3 3 0 0 1 3-3h12M16 14h.01" /><path d="M21 11h-5a3 3 0 0 0 0 6h5" /></>,
    exit: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" /></>,
    entry: <><path d="m14 7-5 5 5 5M9 12h12" /><path d="M12 3H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6" /></>,
    blocks: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m12 12 8-4.5M12 12v9m0-9L4 7.5m4-2.25 8 4.5v4.5l-8-4.5v-4.5Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.campus}</svg>;
}

async function connectMetaMask() {
  if (!window.ethereum) throw new Error("Install the MetaMask browser extension first");
  const config = await api("/wallet/config");
  const chainId = "0x" + Number(config.chainId).toString(16);
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId,
        chainName: config.chainName,
        nativeCurrency: config.nativeCurrency,
        rpcUrls: [config.rpcUrl],
        ...(config.blockExplorerUrls ? { blockExplorerUrls: config.blockExplorerUrls } : {}),
      }],
    });
  }
  const provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const contract = new Contract(config.address, config.abi, signer);
  const [adminRole, guardRole] = await Promise.all([
    contract.DEFAULT_ADMIN_ROLE(),
    contract.GUARD_ROLE(),
  ]);
  const [isAdmin, isGuard] = await Promise.all([
    contract.hasRole(adminRole, account),
    contract.hasRole(guardRole, account),
  ]);
  return { account, contract, isAdmin, isGuard };
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [tab, setTab] = useState("gate");
  const [wallet, setWallet] = useState(null);
  const [walletMessage, setWalletMessage] = useState("");

  const login = (session) => {
    setTab("gate");
    setWallet(null);
    setWalletMessage("");
    setAuth(session);
  };

  useEffect(() => {
    if (DEMO_MODE || !window.ethereum?.on) return;
    const disconnect = () => setWallet(null);
    window.ethereum.on("accountsChanged", disconnect);
    window.ethereum.on("chainChanged", disconnect);
    return () => {
      window.ethereum.removeListener("accountsChanged", disconnect);
      window.ethereum.removeListener("chainChanged", disconnect);
    };
  }, []);

  if (!auth) return <Login onLogin={login} demoMode={DEMO_MODE} />;
  const connect = async () => {
    setWalletMessage("");
    try {
      setWallet(await connectMetaMask());
      setWalletMessage("Wallet connected. MetaMask will ask you to approve each transaction.");
    } catch (e) {
      setWalletMessage(e.message);
    }
  };
  const tabs = [["gate", "Gate activity", "gate"], ["logs", "Movement history", "history"], ["verify", "Verify a record", "verify"]];
  if (auth.role === "admin") tabs.splice(1, 0, ["admin", "Vehicle registry", "car"]);
  const page = pages[tab];
  return (
    <div className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark"><Icon name="campus" size={22} /></span>
            <span><span className="brand-name">Campus Gate</span><span className="brand-caption">Access, in harmony</span></span>
          </div>
          <span className="nav-caption">Workspace</span>
          <nav className="side-nav" aria-label="Main navigation">
            {tabs.map(([key, label, icon]) => (
              <button key={key} className={`nav-item${tab === key ? " active" : ""}`} onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined}>
                <Icon name={icon} /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="chain-card">
              <div className="chain-card-title"><span className="live-dot" />{DEMO_MODE ? "Sample dataset" : "Protected ledger"}</div>
              <p>{DEMO_MODE ? "Fictional sample records for a read-only product preview." : "Every movement is verified and anchored to your campus chain."}</p>
            </div>
          </div>
        </aside>

        <main className="workspace">
          <header className="topbar">
            <span className="crumb">Campus operations&nbsp; / &nbsp;{page.title}</span>
            <div className="topbar-actions">
              <span className="role-chip"><span className="live-dot" />{DEMO_MODE ? "Read-only preview" : auth.role === "admin" ? "Administrator" : "Gate guard"}</span>
              {!DEMO_MODE && (wallet ? (
                <span className="wallet-chip"><Icon name="wallet" size={15} />{wallet.account.slice(0, 6)}…{wallet.account.slice(-4)}</span>
              ) : (
                <button className="btn btn-wallet" onClick={connect}><Icon name="wallet" size={16} />Connect wallet</button>
              ))}
              {!DEMO_MODE && wallet && <button className="btn btn-wallet" onClick={connect}><Icon name="wallet" size={16} />Switch</button>}
              <button className="btn btn-link sign-out" aria-label="Sign out" onClick={() => { setWallet(null); setWalletMessage(""); setTab("gate"); setAuth(null); }}><Icon name="logout" size={15} /><span className="sign-out-label">Sign out</span></button>
            </div>
          </header>

          {DEMO_MODE && <div className="demo-banner" role="note"><strong>Read-only demo preview</strong><span>All records are fictional samples. No wallet, database, or blockchain is connected; changes are disabled.</span></div>}

          <div className="welcome-line">
            <div>
              <h1 className="page-heading">{page.title}</h1>
              <p className="welcome-copy">{page.subtitle}</p>
            </div>
            <span className="welcome-icon"><Icon name={page === pages.gate ? "gate" : page === pages.admin ? "car" : page === pages.logs ? "history" : "verify"} size={24} /></span>
          </div>

          {walletMessage && <p className={`wallet-message ${wallet ? "good" : "bad"}`} role="status">
            {walletMessage === "Install the MetaMask browser extension first" ? (
              <>MetaMask isn’t available in this browser. <a href="https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn" target="_blank" rel="noreferrer">Install MetaMask from the Chrome Web Store</a>, then reload this page.</>
            ) : walletMessage}
          </p>}
          {wallet && <p className="wallet-message good" role="status">
            Network roles: {wallet.isAdmin ? "administrator" : "not administrator"} · {wallet.isGuard ? "gate guard" : "not gate guard"}
          </p>}
          <div key={tab} className="page-transition">
            {tab === "gate" && <Gate t={auth.token} wallet={wallet} demoMode={DEMO_MODE} />}
            {tab === "admin" && <Admin t={auth.token} wallet={wallet} demoMode={DEMO_MODE} />}
            {tab === "logs" && <Logs t={auth.token} demoMode={DEMO_MODE} />}
            {tab === "verify" && <Verify t={auth.token} demoMode={DEMO_MODE} />}
          </div>
        </main>
      </div>
    </div>
  );
}

function Login({ onLogin, demoMode = false }) {
  const [f, setF] = useState({ username: "", password: "" });
  const [msg, setMsg] = useState("");
  const [pending, setPending] = useState(false);
  const go = async (event) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try { onLogin(await api("/login", "POST", f)); } catch (e) { setMsg(e.message); } finally { setPending(false); }
  };
  return (
    <div className="login-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <main className="login-card">
        <div className="brand">
          <span className="brand-mark"><Icon name="campus" size={22} /></span>
          <span><span className="brand-name">Campus Gate</span><span className="brand-caption">Access, in harmony</span></span>
        </div>
        <span className="section-label">{demoMode ? "Read-only product preview" : "Campus operations"}</span>
        <h1>{demoMode ? "Explore the demo." : "Welcome back."}</h1>
        <p className="login-subtitle">{demoMode ? "Sign in with a sample account to explore fictional campus activity. No real services are connected." : "Sign in to manage campus vehicle access and movement records."}</p>
        <form className="login-fields" onSubmit={go}>
          <div className="field"><label htmlFor="username">Username</label><input id="username" autoComplete="username" placeholder="Enter your username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></div>
          <div className="field"><label htmlFor="password">Password</label><input id="password" autoComplete="current-password" placeholder="Enter your password" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
          <button className="btn btn-primary" type="submit" disabled={pending}><Icon name="shield" size={17} />{pending ? "Signing in…" : "Sign in securely"}</button>
        </form>
        {msg && <p className="wallet-message bad" role="alert">{msg}</p>}
        {demoMode
          ? <p className="demo-credentials">Try <strong>admin</strong> or <strong>guard</strong> with password <strong>demo123</strong>.</p>
          : <p className="login-footnote">Protected with a verifiable campus ledger</p>}
      </main>
    </div>
  );
}

function Gate({ t, wallet, demoMode = false }) {
  const [plate, setPlate] = useState("");
  const [gate, setGate] = useState(1);
  const [msg, setMsg] = useState(null);
  const [inside, setInside] = useState([]);
  const [pending, setPending] = useState(false);
  const load = () => api("/inside", "GET", null, t).then(setInside).catch((e) => setMsg({ t: e.message, bad: true }));
  useEffect(() => { load(); }, []);
  const send = async (kind) => {
    if (!wallet) return setMsg({ t: "Connect MetaMask before recording a vehicle.", bad: true });
    if (!wallet.isGuard) return setMsg({ t: "This MetaMask account does not have the on-chain guard role.", bad: true });
    if (pending) return;
    setPending(true);
    setMsg({ t: "Confirm the transaction in MetaMask…" });
    try {
      const { plateHash } = await api("/vehicles/plate-hash", "POST", { plate }, t);
      const tx = kind === "entry"
        ? await wallet.contract.logEntry(plateHash, Number(gate))
        : await wallet.contract.logExit(plateHash, Number(gate));
      setMsg({ t: "Waiting for the blockchain…" });
      await tx.wait();
      const r = await api("/logs/" + kind, "POST", { plate, gateId: Number(gate), txHash: tx.hash }, t);
      setMsg({ ok: true, t: `${r.action} recorded for ${r.plate} (log #${r.logId}). Tx ${r.txHash.slice(0, 18)}…` });
      setPlate(""); load();
    } catch (e) { setMsg({ t: e.message, bad: true }); } finally { setPending(false); }
  };
  return (
    <section className="content-card">
      <div className="card-heading">
        <div><span className="section-label">{demoMode ? "Sample campus activity" : "Access control"}</span><h2>{demoMode ? "Vehicle movement overview" : "Record vehicle movement"}</h2><p>{demoMode ? "Browse sample vehicles currently on campus. Recording movements is disabled in this preview." : "Choose the gate, enter a plate number, and confirm the record in MetaMask."}</p></div>
        <span className="status-pill"><span className="live-dot" />{demoMode ? "Sample data" : "Gate system ready"}</span>
      </div>
      {!demoMode && <div className="field-grid">
        <div className="field"><label htmlFor="vehicle-plate">Vehicle plate</label><input id="vehicle-plate" placeholder="e.g. PB10AB1234" value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
        <div className="field"><label htmlFor="gate-number">Campus gate</label><select id="gate-number" value={gate} onChange={(e) => setGate(e.target.value)}>{[1, 2, 3].map((g) => <option key={g} value={g}>Gate {g}</option>)}</select></div>
      </div>}
      {!demoMode && <div className="action-row">
        <button className="btn btn-primary" onClick={() => send("entry")} disabled={pending}><Icon name="entry" size={17} />{pending ? "Processing…" : "Record entry"}</button>
        <button className="btn btn-soft" onClick={() => send("exit")} disabled={pending}><Icon name="exit" size={17} />{pending ? "Processing…" : "Record exit"}</button>
      </div>}
      {msg && <p className={`notice ${msg.ok ? "good" : msg.bad ? "bad" : ""}`} role={msg.bad ? "alert" : "status"}>{msg.t}</p>}
      <div className="divider" />
      <div className="subheading"><h3>Currently on campus</h3><span className="count-badge">{inside.length}</span></div>
      {inside.length === 0 ? (
        <div className="empty-state"><div><span className="empty-icon"><Icon name="car" /></span><p>No registered vehicles are currently inside.</p></div></div>
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Owner</th><th>Department</th></tr></thead><tbody>
          {inside.map((v) => <tr key={v._id}><td><span className="plate-tag">{v.plate}</span></td><td>{v.ownerName || "—"}</td><td>{v.department || "—"}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}

function Admin({ t, wallet, demoMode = false }) {
  const [f, setF] = useState({ plate: "", ownerName: "", phone: "", department: "" });
  const [msg, setMsg] = useState(null);
  const [pending, setPending] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  useEffect(() => {
    if (demoMode) api("/vehicles", "GET", null, t).then(setVehicles).catch((e) => setMsg({ t: e.message, bad: true }));
  }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (event) => {
    event.preventDefault();
    if (!wallet) return setMsg({ t: "Connect MetaMask before registering a vehicle.", bad: true });
    if (!wallet.isAdmin) return setMsg({ t: "This MetaMask account does not have the on-chain admin role.", bad: true });
    if (pending) return;
    setPending(true);
    setMsg({ t: "Confirm the transaction in MetaMask…" });
    try {
      const prepared = await api("/vehicles/prepare", "POST", { plate: f.plate }, t);
      const tx = await wallet.contract.registerVehicle(prepared.plateHash);
      setMsg({ t: "Waiting for the blockchain…" });
      await tx.wait();
      const v = await api("/vehicles", "POST", { ...f, plate: prepared.plate, txHash: tx.hash }, t);
      setMsg({ ok: true, t: `Registered ${v.plate}. Tx ${v.regTx.slice(0, 18)}…` });
      setF({ plate: "", ownerName: "", phone: "", department: "" });
    } catch (e) { setMsg({ t: e.message, bad: true }); } finally { setPending(false); }
  };
  if (demoMode) return (
    <section className="content-card">
      <div className="card-heading"><div><span className="section-label">Fictional sample records</span><h2>Vehicle registry</h2><p>Sample records only. Registration and editing are disabled in this preview.</p></div><span className="status-pill"><Icon name="car" size={14} />Read-only</span></div>
      {msg && <p className="notice bad" role="alert">{msg.t}</p>}
      <div className="table-wrap"><table><thead><tr><th>Vehicle</th><th>Owner</th><th>Department</th></tr></thead><tbody>
        {vehicles.map((v) => <tr key={v._id}><td><span className="plate-tag">{v.plate}</span></td><td>{v.ownerName}</td><td>{v.department}</td></tr>)}
      </tbody></table></div>
    </section>
  );
  return (
    <section className="content-card">
      <div className="card-heading"><div><span className="section-label">Vehicle management</span><h2>Add an authorized vehicle</h2><p>Owner details remain in MongoDB; only a plate hash is written to the chain.</p></div><span className="status-pill"><Icon name="shield" size={14} />Admin access</span></div>
      <form onSubmit={save}>
        <div className="field-grid">
          <div className="field"><label htmlFor="reg-plate">Vehicle plate</label><input id="reg-plate" placeholder="e.g. PB10AB1234" value={f.plate} onChange={set("plate")} required /></div>
          <div className="field"><label htmlFor="reg-department">Department</label><input id="reg-department" placeholder="e.g. Engineering" value={f.department} onChange={set("department")} /></div>
          <div className="field"><label htmlFor="reg-owner">Owner name</label><input id="reg-owner" placeholder="Full name" value={f.ownerName} onChange={set("ownerName")} /></div>
          <div className="field"><label htmlFor="reg-phone">Phone number</label><input id="reg-phone" type="tel" placeholder="Contact number" value={f.phone} onChange={set("phone")} /></div>
        </div>
        <div className="action-row"><button className="btn btn-primary" type="submit" disabled={pending}><Icon name="car" size={17} />{pending ? "Processing…" : "Register vehicle"}</button></div>
      </form>
      {msg && <p className={`notice ${msg.ok ? "good" : msg.bad ? "bad" : ""}`} role={msg.bad ? "alert" : "status"}>{msg.t}</p>}
    </section>
  );
}

function Logs({ t, demoMode = false }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => api("/logs?plate=" + encodeURIComponent(q), "GET", null, t).then((data) => { setRows(data); setMsg(""); }).catch((e) => setMsg(e.message));
  useEffect(() => { load(); }, []);
  return (
    <section className="content-card">
      <div className="card-heading"><div><span className="section-label">{demoMode ? "Fictional sample records" : "Campus timeline"}</span><h2>Recent vehicle activity</h2><p>{demoMode ? "Search sample entry and exit records. These are not stored on a blockchain." : "Search and review entry and exit records saved on the blockchain."}</p></div><span className="status-pill"><Icon name="blocks" size={14} />{demoMode ? "Sample records" : "Ledger records"}</span></div>
      <div className="search-row">
        <div className="search-box"><Icon name="search" size={17} /><input aria-label="Search by plate" placeholder="Search by vehicle plate" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") load(); }} /></div>
        <button className="btn btn-primary" onClick={load}><Icon name="search" size={16} />Search</button>
      </div>
      {msg && <p className="notice bad" role="alert">{msg}</p>}
      {rows.length === 0 ? (
        <div className="empty-state"><div><span className="empty-icon"><Icon name="history" /></span><p>No matching activity yet. Try another plate number.</p></div></div>
      ) : (
        <div className="table-wrap"><table><thead><tr><th>Log</th><th>Vehicle</th><th>Movement</th><th>Gate</th><th>Time</th><th>{demoMode ? "Source" : "Transaction"}</th></tr></thead><tbody>
          {rows.map((r) => <tr key={r.logId}><td>#{r.logId}</td><td><span className="plate-tag">{r.plate}</span></td><td><span className={`action-tag ${r.action === "ENTRY" ? "action-entry" : "action-exit"}`}><Icon name={r.action === "ENTRY" ? "entry" : "exit"} size={13} />{r.action}</span></td><td>Gate {r.gateId}</td><td>{fmt(r.timestamp)}</td><td>{demoMode ? "Fictional sample" : <span title={r.txHash}>{r.txHash.slice(0, 12)}…</span>}</td></tr>)}
        </tbody></table></div>
      )}
    </section>
  );
}

function Verify({ t, demoMode = false }) {
  const [id, setId] = useState("");
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState("");
  const go = async (event) => {
    event.preventDefault();
    setMsg(""); setRes(null);
    try { setRes(await api("/verify/" + id, "GET", null, t)); } catch (e) { setMsg(e.message); }
  };
  return (
    <section className="content-card">
      <div className="card-heading"><div><span className="section-label">{demoMode ? "Sample comparison" : "Integrity check"}</span><h2>{demoMode ? "Explore a sample record" : "Verify a ledger record"}</h2><p>{demoMode ? "Preview a fictional record comparison. No database or blockchain check is performed." : "Confirm that the cached entry matches the immutable on-chain log."}</p></div><span className="status-pill"><Icon name="shield" size={14} />{demoMode ? "Demo only" : "Cryptographic proof"}</span></div>
      <form className="search-row" onSubmit={go}>
        <div className="search-box"><Icon name="blocks" size={17} /><input aria-label="Log number" placeholder="Enter a log number" value={id} onChange={(e) => setId(e.target.value)} required /></div>
        <button className="btn btn-primary" type="submit"><Icon name="verify" size={16} />Verify record</button>
      </form>
      {msg && <p className="notice bad" role="alert">{msg}</p>}
      {res && <div className="verify-box">
        <p className={`notice ${res.match ? "good" : "bad"}`} role="status">{demoMode ? "Sample comparison complete — this is fictional demo data, not a live verification." : res.match ? "Verified — the database record matches the blockchain." : "Mismatch — the database record differs from the blockchain."}</p>
        <pre>{JSON.stringify(demoMode ? { sampleRecord: res.sampleRecord, note: res.disclaimer } : { blockchain: res.onChain, database: res.database }, null, 2)}</pre>
      </div>}
    </section>
  );
}
