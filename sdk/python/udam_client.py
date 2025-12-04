import json
import requests

class UdamClient:
    def __init__(self, base_url="http://localhost:4000", token=None):
        self.base_url = base_url.rstrip("/")
        self.token = token

    def set_token(self, token):
        self.token = token

    def _request(self, method, path, body=None, headers=None):
        h = {"Content-Type": "application/json"}
        if headers:
            h.update(headers)
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        url = f"{self.base_url}{path}"
        data = json.dumps(body) if body is not None else None
        r = requests.request(method, url, headers=h, data=data)
        ct = r.headers.get("content-type", "")
        if "application/json" in ct:
            d = r.json()
            if r.status_code >= 400:
                raise Exception(d.get("error", f"http_{r.status_code}"))
            return d
        if r.status_code >= 400:
            raise Exception(f"http_{r.status_code}")
        return None

    def login(self, email, oauth_provider="email"):
        r = self._request("POST", "/auth/login", {"email": email, "oauth_provider": oauth_provider})
        if r and r.get("session_token"):
            self.token = r["session_token"]
        return r

    def logout(self):
        return self._request("POST", "/auth/logout")

    def get_listings(self):
        return self._request("GET", "/listings")

    def create_listing(self, service_name, api_key, price_per_unit, unit_description, available_units):
        body = {
            "service_name": service_name,
            "api_key": api_key,
            "price_per_unit": price_per_unit,
            "unit_description": unit_description,
            "available_units": available_units,
        }
        return self._request("POST", "/listings", body)

    def create_order(self, listing_id, units):
        return self._request("POST", "/orders", {"listing_id": listing_id, "units": units})

    def get_order(self, order_id):
        return self._request("GET", f"/orders/{order_id}")

    def dev_confirm_order(self, order_id):
        r = requests.get(f"{self.base_url}/orders/dev/confirm/{order_id}")
        if r.status_code >= 400:
            raise Exception(f"http_{r.status_code}")
        return True

    def accept_order(self, order_id):
        return self._request("POST", f"/orders/{order_id}/accept")

    def dispute_order(self, order_id, reason="", evidence=""):
        return self._request("POST", f"/orders/{order_id}/dispute", {"reason": reason, "evidence": evidence})

    def counter_order(self, order_id, reason="", evidence=""):
        return self._request("POST", f"/orders/{order_id}/counter", {"reason": reason, "evidence": evidence})

    def adjudicate(self, order_id, decision, admin_token):
        return self._request("POST", f"/orders/{order_id}/adjudicate", {"decision": decision}, {"x-admin-token": admin_token})

    def list_tokens(self):
        return self._request("GET", "/tokens")

    def review_order(self, order_id, score, comment=""):
        return self._request("POST", f"/orders/{order_id}/review", {"score": score, "comment": comment})

    def get_user_ratings(self, user_id):
        return self._request("GET", f"/users/{user_id}/ratings")
