import os
from dotenv import load_dotenv

load_dotenv()

CLICKUP_API_TOKEN = os.getenv("CLICKUP_API_TOKEN", "")
CLICKUP_TEAM_ID = os.getenv("CLICKUP_TEAM_ID", "")
CLICKUP_BASE_URL = "https://api.clickup.com/api/v2"

GRIPP_API_URL = os.getenv("GRIPP_API_URL", "")
GRIPP_API_TOKEN = os.getenv("GRIPP_API_TOKEN", "")

SPACE_IDS = {
    "growth": os.getenv("SPACE_GROWTH_ID", ""),
    "delivery": os.getenv("SPACE_DELIVERY_ID", ""),
    "operations": os.getenv("SPACE_OPERATIONS_ID", ""),
    "overview": os.getenv("SPACE_OVERVIEW_ID", ""),
}

ZUID_SPACES = ["Growth", "Delivery", "Operations", "Overview"]

HOUR_WARNING_THRESHOLD = 0.85
HOUR_DANGER_THRESHOLD = 1.0

DEFAULT_HOURLY_RATE = 125.0
