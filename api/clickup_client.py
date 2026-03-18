"""
ClickUp API Client voor ZUID dashboards.
"""

import re
import time
from datetime import datetime
from typing import Optional

import requests

from config import CLICKUP_API_TOKEN, CLICKUP_BASE_URL, CLICKUP_TEAM_ID


class ClickUpClient:
    def __init__(self, token: str = CLICKUP_API_TOKEN, team_id: str = CLICKUP_TEAM_ID):
        self.token = token
        self.team_id = team_id
        self.base_url = CLICKUP_BASE_URL
        self.headers = {
            "Authorization": self.token,
            "Content-Type": "application/json",
        }
        self._rate_limit_remaining = 100

    def _request(self, method: str, endpoint: str, params: dict | None = None) -> dict:
        if self._rate_limit_remaining < 5:
            time.sleep(1)

        url = f"{self.base_url}/{endpoint}"
        response = requests.request(
            method, url, headers=self.headers, params=params, timeout=30
        )
        self._rate_limit_remaining = int(
            response.headers.get("X-RateLimit-Remaining", 100)
        )
        response.raise_for_status()
        return response.json()

    def _get(self, endpoint: str, params: dict | None = None) -> dict:
        return self._request("GET", endpoint, params=params)

    # ── Spaces ──────────────────────────────────────────────

    def get_spaces(self) -> list[dict]:
        data = self._get(f"team/{self.team_id}/space", params={"archived": "false"})
        return data.get("spaces", [])

    def find_space_ids(self) -> dict[str, str]:
        result = {}
        for space in self.get_spaces():
            key = space["name"].lower()
            if key in ("growth", "delivery", "operations", "overview"):
                result[key] = space["id"]
        return result

    # ── Folders & Lists ─────────────────────────────────────

    def get_folders(self, space_id: str, archived: bool = False) -> list[dict]:
        data = self._get(
            f"space/{space_id}/folder",
            params={"archived": str(archived).lower()},
        )
        return data.get("folders", [])

    def get_lists(self, folder_id: str, archived: bool = False) -> list[dict]:
        data = self._get(
            f"folder/{folder_id}/list",
            params={"archived": str(archived).lower()},
        )
        return data.get("lists", [])

    def get_folderless_lists(self, space_id: str) -> list[dict]:
        data = self._get(f"space/{space_id}/list", params={"archived": "false"})
        return data.get("lists", [])

    def get_all_lists_in_space(
        self, space_id: str, include_archived: bool = False
    ) -> list[dict]:
        all_lists = []
        folders = self.get_folders(space_id)
        for folder in folders:
            for lst in self.get_lists(folder["id"]):
                lst["_folder_name"] = folder["name"]
                lst["_folder_id"] = folder["id"]
                all_lists.append(lst)
            if include_archived:
                for lst in self.get_lists(folder["id"], archived=True):
                    lst["_folder_name"] = folder["name"]
                    lst["_folder_id"] = folder["id"]
                    lst["_is_archived"] = True
                    all_lists.append(lst)

        for lst in self.get_folderless_lists(space_id):
            lst["_folder_name"] = None
            lst["_folder_id"] = None
            all_lists.append(lst)

        return all_lists

    # ── Tasks ───────────────────────────────────────────────

    def get_tasks(
        self,
        list_id: str,
        include_subtasks: bool = True,
        include_closed: bool = False,
        page: int = 0,
    ) -> list[dict]:
        params = {
            "subtasks": str(include_subtasks).lower(),
            "include_closed": str(include_closed).lower(),
            "page": page,
        }
        data = self._get(f"list/{list_id}/task", params=params)
        return data.get("tasks", [])

    def get_all_tasks_in_list(
        self, list_id: str, include_closed: bool = False
    ) -> list[dict]:
        all_tasks = []
        page = 0
        while True:
            tasks = self.get_tasks(
                list_id, page=page, include_closed=include_closed
            )
            if not tasks:
                break
            all_tasks.extend(tasks)
            page += 1
        return all_tasks

    def get_all_tasks_in_space(
        self, space_id: str, include_closed: bool = False
    ) -> list[dict]:
        all_tasks = []
        for lst in self.get_all_lists_in_space(space_id):
            tasks = self.get_all_tasks_in_list(lst["id"], include_closed=include_closed)
            for task in tasks:
                task["_list_name"] = lst["name"]
                task["_list_id"] = lst["id"]
                task["_folder_name"] = lst.get("_folder_name")
            all_tasks.extend(tasks)
        return all_tasks

    def get_task(self, task_id: str) -> dict:
        return self._get(f"task/{task_id}")

    # ── Time Tracking ───────────────────────────────────────

    def get_time_entries(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> list[dict]:
        params = {}
        if start_date:
            params["start_date"] = int(start_date.timestamp() * 1000)
        if end_date:
            params["end_date"] = int(end_date.timestamp() * 1000)
        data = self._get(f"team/{self.team_id}/time_entries", params=params)
        return data.get("data", [])

    # ── Members ─────────────────────────────────────────────

    def get_team_members(self) -> list[dict]:
        data = self._get(f"team/{self.team_id}")
        return data.get("team", {}).get("members", [])

    # ── Helpers ─────────────────────────────────────────────

    @staticmethod
    def extract_custom_field(task: dict, field_name: str):
        for field in task.get("custom_fields", []):
            if field["name"].lower() == field_name.lower():
                return field.get("value")
        return None

    @staticmethod
    def extract_custom_field_by_names(task: dict, *field_names: str):
        """Try multiple field name variants, return first match."""
        for name in field_names:
            val = ClickUpClient.extract_custom_field(task, name)
            if val is not None:
                return val
        return None

    @staticmethod
    def ms_to_hours(ms: int) -> float:
        return ms / 3_600_000

    @staticmethod
    def parse_date(timestamp_ms) -> Optional[datetime]:
        if not timestamp_ms:
            return None
        try:
            return datetime.fromtimestamp(int(timestamp_ms) / 1000)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def extract_list_id_from_url(url: str) -> Optional[str]:
        """Extract ClickUp list ID from a list URL."""
        if not url:
            return None
        match = re.search(r"/li/(\d+)", url)
        return match.group(1) if match else None
