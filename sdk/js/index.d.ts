export declare class UdamClient {
  constructor(baseUrl?: string, token?: string);
  baseUrl: string;
  token: string | null;
  setToken(token: string): void;
  login(email: string, oauth_provider?: string): Promise<{ user_id: number; session_token: string }>;
  logout(): Promise<any>;
  getListings(): Promise<any[]>;
  createListing(params: { service_name: string; api_key: string; price_per_unit: string | number; unit_description: string; available_units: number }): Promise<{ id: number }>;
  createOrder(params: { listing_id: number; units: number }): Promise<{ order_id: number; payment_amount: string; payment_requires_confirmation: boolean; payment_url?: string | null }>;
  getOrder(id: number): Promise<any>;
  devConfirmOrder(id: number): Promise<boolean>;
  acceptOrder(id: number): Promise<{ ok: boolean }>;
  disputeOrder(id: number, params?: { reason?: string; evidence?: string }): Promise<{ ok: boolean }>;
  counterOrder(id: number, params?: { reason?: string; evidence?: string }): Promise<{ ok: boolean }>;
  adjudicate(id: number, decision: 'refund' | 'release', adminToken: string): Promise<{ ok: boolean }>;
  listTokens(): Promise<any[]>;
  reviewOrder(id: number, params: { score: number; comment?: string }): Promise<{ ok: boolean }>;
  getUserRatings(userId: number): Promise<{ avg_score: number; count: number; recent: any[] }>;
}
