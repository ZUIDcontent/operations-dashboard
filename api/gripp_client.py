"""
Gripp API Client voor ZUID dashboards.
Haalt financiële data op: opdrachtwaarden, projecten, facturatie.

NOTE: Dit is een basis-implementatie. De exacte API-structuur hangt af van
jullie Gripp-configuratie. Pas de endpoints en veldnamen aan op basis van
de bestaande bot-koppeling die Sander heeft gebouwd.
"""

from typing import Optional

import requests

from config import GRIPP_API_TOKEN, GRIPP_API_URL


class GrippClient:
    def __init__(self, api_url: str = GRIPP_API_URL, token: str = GRIPP_API_TOKEN):
        self.api_url = api_url.rstrip("/") if api_url else ""
        self.token = token
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    @property
    def is_configured(self) -> bool:
        return bool(self.api_url and self.token)

    def _post(self, endpoint: str, payload: dict) -> dict:
        if not self.is_configured:
            return {}
        url = f"{self.api_url}/{endpoint}"
        response = requests.post(url, headers=self.headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

    def get_projects(self, active_only: bool = True) -> list[dict]:
        """Haal projecten op uit Gripp."""
        filters = []
        if active_only:
            filters.append({"field": "status", "operator": "equals", "value": "active"})

        payload = {
            "entity": "project",
            "filter": filters,
            "fields": [
                "id", "title", "number", "status",
                "totalvalue", "budget", "invoiced",
                "hours_budget", "hours_spent",
            ],
        }
        result = self._post("", payload)
        return result.get("data", []) if result else []

    def get_project_by_number(self, project_number: str) -> Optional[dict]:
        payload = {
            "entity": "project",
            "filter": [
                {"field": "number", "operator": "equals", "value": project_number}
            ],
        }
        result = self._post("", payload)
        data = result.get("data", []) if result else []
        return data[0] if data else None

    def get_open_invoices(self) -> list[dict]:
        payload = {
            "entity": "invoice",
            "filter": [
                {"field": "status", "operator": "equals", "value": "open"}
            ],
            "fields": ["id", "project_id", "amount", "date"],
        }
        result = self._post("", payload)
        return result.get("data", []) if result else []


def build_gripp_project_map(gripp: GrippClient) -> dict[str, dict]:
    """
    Bouwt een lookup dictionary van Gripp projecten.
    Key = projectnummer (str), Value = project dict.
    """
    if not gripp.is_configured:
        return {}

    projects = gripp.get_projects(active_only=False)
    return {str(p.get("number", p.get("id"))): p for p in projects}
