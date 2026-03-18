"""
Business logic voor financiële berekeningen en signalering.
"""

from config import DEFAULT_HOURLY_RATE, HOUR_DANGER_THRESHOLD, HOUR_WARNING_THRESHOLD

CONTAINER_TASK_TYPE_INDEX = 1


def is_container_task(task: dict) -> bool:
    """Task type dropdown: 0 = Task, 1 = Container. Containers bevatten subtaken."""
    for field in task.get("custom_fields", []):
        if field["name"] == "Task type":
            try:
                return int(field.get("value", 0)) == CONTAINER_TASK_TYPE_INDEX
            except (TypeError, ValueError):
                return False
    return False


def calculate_ohw(
    opdrachtwaarde: float,
    gefactureerd: float,
    waarde_geschreven_uren: float,
) -> float:
    """OHW mag nooit hoger zijn dan de opdrachtwaarde."""
    ohw = waarde_geschreven_uren - gefactureerd
    return min(ohw, opdrachtwaarde)


def hours_to_value(hours: float, rate: float = DEFAULT_HOURLY_RATE) -> float:
    return hours * rate


def get_burn_percentage(planned: float, actual: float) -> float:
    if planned <= 0:
        return 0.0 if actual == 0 else 999.0
    return actual / planned


def get_status_color(burn_pct: float) -> str:
    if burn_pct >= HOUR_DANGER_THRESHOLD:
        return "red"
    elif burn_pct >= HOUR_WARNING_THRESHOLD:
        return "orange"
    return "green"


def get_status_emoji(burn_pct: float) -> str:
    return {"green": "🟢", "orange": "🟠", "red": "🔴"}[get_status_color(burn_pct)]


def get_status_label(burn_pct: float) -> str:
    return {
        "green": "Op schema",
        "orange": "Let op (>85%)",
        "red": "Overschrijding",
    }[get_status_color(burn_pct)]
