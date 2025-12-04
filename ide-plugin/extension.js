const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
function activate(context) {
  const backend = process.env.UDAM_BACKEND_URL || "http://localhost:4000";
  const provider = new (class {
    constructor() { this.items = []; }
    getChildren() { return this.items; }
    getTreeItem(e) { return e; }
    setItems(items) { this.items = items.map((i) => new vscode.TreeItem(i)); this._onDidChangeTreeData.fire(); }
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
  })();
  vscode.window.createTreeView("udamView", { treeDataProvider: provider });
  context.subscriptions.push(
    vscode.commands.registerCommand("udam.login", async () => {
      const email = await vscode.window.showInputBox({ prompt: "Email" });
      const prov = await vscode.window.showQuickPick(["email", "google", "github"], { placeHolder: "Provider" });
      if (!email) return;
      const r = await fetch(`${backend}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, oauth_provider: prov || "email" }) });
      const j = await r.json();
      if (j.session_token) context.globalState.update("udam_session_token", j.session_token);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("udam.fetchListings", async () => {
      const r = await fetch(`${backend}/listings`);
      const j = await r.json();
      provider.setItems(j.map((l) => `${l.service_name} $${l.price_per_unit}`));
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("udam.fetchTokens", async () => {
      const t = await context.globalState.get("udam_session_token");
      if (!t) return;
      const r = await fetch(`${backend}/tokens`, { headers: { Authorization: `Bearer ${t}` } });
      const j = await r.json();
      provider.setItems(j.map((x) => `${x.service_name} ${x.api_key}`));
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("udam.writeTokens", async () => {
      const t = await context.globalState.get("udam_session_token");
      if (!t) return;
      const r = await fetch(`${backend}/tokens`, { headers: { Authorization: `Bearer ${t}` } });
      const j = await r.json();
      const dir = path.join(os.homedir(), ".udam");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, "tokens.json"), JSON.stringify(j, null, 2));
    })
  );
}
function deactivate() {}
module.exports = { activate, deactivate };
