export class UdamClient {
  constructor(baseUrl = "http://localhost:4000", token = null) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = token;
  }
  setToken(token) {
    this.token = token;
  }
  async _request(method, path, body = null, headers = {}) {
    const h = { "Content-Type": "application/json", ...headers };
    if (this.token) h["Authorization"] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : null,
    });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      if (!res.ok) throw new Error(`http_${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `http_${res.status}`);
    return data;
  }
  async login(email, oauth_provider = "email") {
    const r = await this._request("POST", "/auth/login", { email, oauth_provider });
    if (r?.session_token) this.token = r.session_token;
    return r;
  }
  async logout() {
    return await this._request("POST", "/auth/logout");
  }
  async getListings() {
    return await this._request("GET", "/listings");
  }
  async createListing({ service_name, api_key, price_per_unit, unit_description, available_units }) {
    return await this._request("POST", "/listings", { service_name, api_key, price_per_unit, unit_description, available_units });
  }
  async createOrder({ listing_id, units }) {
    return await this._request("POST", "/orders", { listing_id, units });
  }
  async getOrder(id) {
    return await this._request("GET", `/orders/${id}`);
  }
  async devConfirmOrder(id) {
    const res = await fetch(`${this.baseUrl}/orders/dev/confirm/${id}`);
    if (!res.ok) throw new Error(`http_${res.status}`);
    return true;
  }
  async acceptOrder(id) {
    return await this._request("POST", `/orders/${id}/accept`);
  }
  async disputeOrder(id, { reason = "", evidence = "" } = {}) {
    return await this._request("POST", `/orders/${id}/dispute`, { reason, evidence });
  }
  async counterOrder(id, { reason = "", evidence = "" } = {}) {
    return await this._request("POST", `/orders/${id}/counter`, { reason, evidence });
  }
  async adjudicate(id, decision, adminToken) {
    return await this._request("POST", `/orders/${id}/adjudicate`, { decision }, { "x-admin-token": adminToken });
  }
  async listTokens() {
    return await this._request("GET", "/tokens");
  }
  async reviewOrder(id, { score, comment = "" }) {
    return await this._request("POST", `/orders/${id}/review`, { score, comment });
  }
  async getUserRatings(userId) {
    return await this._request("GET", `/users/${userId}/ratings`);
  }
}
