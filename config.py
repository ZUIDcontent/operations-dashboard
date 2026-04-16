import os
from dotenv import load_dotenv

load_dotenv()

def _get_setting(key: str, default: str = "") -> str:
    """
    Prefer Streamlit Cloud secrets, then environment variables.
    Keeps local `.env` working while making Streamlit Community Cloud reliable.
    """
    try:
        import streamlit as st  # type: ignore

        if hasattr(st, "secrets") and key in st.secrets:
            val = st.secrets.get(key)
            return str(val) if val is not None else default
    except Exception:
        # Streamlit not installed/importable in some contexts (e.g. tooling)
        pass

    return os.getenv(key, default)


CLICKUP_API_TOKEN = _get_setting("CLICKUP_API_TOKEN", "")
CLICKUP_TEAM_ID = _get_setting("CLICKUP_TEAM_ID", "")
CLICKUP_BASE_URL = "https://api.clickup.com/api/v2"

GRIPP_API_URL = _get_setting("GRIPP_API_URL", "")
GRIPP_API_TOKEN = _get_setting("GRIPP_API_TOKEN", "")

SPACE_IDS = {
    "growth": _get_setting("SPACE_GROWTH_ID", ""),
    "delivery": _get_setting("SPACE_DELIVERY_ID", ""),
    "operations": _get_setting("SPACE_OPERATIONS_ID", ""),
    "overview": _get_setting("SPACE_OVERVIEW_ID", ""),
}

ZUID_SPACES = ["Growth", "Delivery", "Operations", "Overview"]

HOUR_WARNING_THRESHOLD = 0.85
HOUR_DANGER_THRESHOLD = 1.0

DEFAULT_HOURLY_RATE = 125.0
