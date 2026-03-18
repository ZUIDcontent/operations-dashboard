"""
PM Board — Deadline Monitor

Toont taken met due date in het verleden of nabije toekomst
die nog niet status 'Complete' hebben.

Categorieën:
- Kritiek: >14 dagen te laat
- Te laat: 7-14 dagen te laat
- Recent verlopen: <7 dagen te laat
- Binnenkort: deadline binnen N dagen
"""

from datetime import datetime, timedelta

import pandas as pd
import plotly.express as px
import streamlit as st

from api.clickup_client import ClickUpClient
from utils.calculations import is_container_task

COMPLETE_STATUSES = {
    "complete", "completed", "done", "closed",
    "afgesloten", "klaar", "opgeleverd",
}


def _categorize(task: dict, upcoming_days: int) -> str | None:
    due = ClickUpClient.parse_date(task.get("due_date"))
    if not due:
        return None

    status = (task.get("status", {}).get("status") or "").lower()
    if status in COMPLETE_STATUSES:
        return None

    now = datetime.now()
    if due < now:
        days_late = (now - due).days
        if days_late > 14:
            return "critical"
        elif days_late > 7:
            return "overdue"
        return "recent"
    elif due <= now + timedelta(days=upcoming_days):
        return "upcoming"

    return None


CATEGORY_CONFIG = {
    "critical": {"label": "🔴 Kritiek (>14d)", "color": "#F44336", "sort": 0},
    "overdue":  {"label": "🟠 Te laat (7-14d)", "color": "#FF9800", "sort": 1},
    "recent":   {"label": "🟡 Recent (<7d)", "color": "#FFC107", "sort": 2},
    "upcoming": {"label": "🔵 Binnenkort", "color": "#2196F3", "sort": 3},
}


def _build_row(task: dict, category: str) -> dict:
    due = ClickUpClient.parse_date(task.get("due_date"))
    assignees = ", ".join(
        a.get("username", a.get("email", "?")) for a in task.get("assignees", [])
    )

    if due:
        delta = (datetime.now() - due).days
        if delta > 0:
            urgency = f"{delta}d te laat"
        elif delta == 0:
            urgency = "Vandaag"
        else:
            urgency = f"Over {abs(delta)}d"
    else:
        urgency = "—"

    cfg = CATEGORY_CONFIG[category]
    return {
        "task_name": task["name"],
        "project": task.get("_folder_name") or task.get("_list_name", ""),
        "list": task.get("_list_name", ""),
        "status": (task.get("status", {}).get("status") or "").capitalize(),
        "assignee": assignees or "Niet toegewezen",
        "due_date": due.strftime("%d-%m-%Y") if due else "—",
        "urgentie": urgency,
        "categorie": cfg["label"],
        "url": task.get("url", ""),
        "_days": (datetime.now() - due).days if due else 0,
        "_cat": category,
        "_sort": cfg["sort"],
    }


def render(client: ClickUpClient, space_ids: dict[str, str]):
    st.header("📋 PM Board — Deadline Monitor")

    st.sidebar.markdown("### Instellingen")
    upcoming_days = st.sidebar.slider(
        "Binnenkort = binnen (dagen)", 1, 30, 7, key="pm_days"
    )
    selected_spaces = st.sidebar.multiselect(
        "Spaces",
        options=[k for k in space_ids if k != "overview"],
        default=["delivery"],
        key="pm_spaces",
    )
    max_folders = st.sidebar.slider(
        "Max folders per space", 5, 50, 20, key="pm_max"
    )
    filter_assignee = st.sidebar.text_input(
        "Filter op assignee", key="pm_assignee"
    )

    with st.spinner("Taken ophalen..."):
        all_tasks = []
        for space_key in selected_spaces:
            sid = space_ids.get(space_key)
            if not sid:
                continue
            folders = client.get_folders(sid)[:max_folders]
            for folder in folders:
                for lst in client.get_lists(folder["id"]):
                    if lst["name"].startswith("*"):
                        continue
                    try:
                        tasks = client.get_all_tasks_in_list(lst["id"])
                        for t in tasks:
                            t["_list_name"] = lst["name"]
                            t["_folder_name"] = folder["name"]
                        all_tasks.extend(tasks)
                    except Exception:
                        continue

    if not all_tasks:
        st.warning("Geen taken gevonden.")
        return

    flagged = []
    for task in all_tasks:
        if is_container_task(task):
            continue
        cat = _categorize(task, upcoming_days)
        if cat:
            flagged.append(_build_row(task, cat))

    if not flagged:
        st.success("Geen verlopen of binnenkort vervallende taken! Alles op schema.")
        return

    df = pd.DataFrame(flagged)

    if filter_assignee:
        df = df[df["assignee"].str.contains(filter_assignee, case=False, na=False)]

    if df.empty:
        st.info("Geen resultaten voor deze filter.")
        return

    # ── KPI's ───────────────────────────────────────────────
    counts = df["_cat"].value_counts()
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("🔴 Kritiek", counts.get("critical", 0))
    col2.metric("🟠 Te laat", counts.get("overdue", 0))
    col3.metric("🟡 Recent", counts.get("recent", 0))
    col4.metric("🔵 Binnenkort", counts.get("upcoming", 0))

    st.divider()

    # ── Chart per project ───────────────────────────────────
    if len(df) > 1:
        chart_df = (
            df.groupby(["project", "_cat"])
            .size()
            .reset_index(name="count")
        )
        fig = px.bar(
            chart_df, x="project", y="count", color="_cat",
            color_discrete_map={k: v["color"] for k, v in CATEGORY_CONFIG.items()},
            category_orders={"_cat": list(CATEGORY_CONFIG.keys())},
            labels={"_cat": "Categorie", "project": "Project", "count": "Taken"},
            title="Verdeling per project",
        )
        fig.update_layout(height=350, xaxis_tickangle=-45)
        st.plotly_chart(fig, use_container_width=True)

    st.divider()

    # ── Filter knoppen ──────────────────────────────────────
    view = st.radio(
        "Toon", ["Alle", "Kritiek", "Te laat", "Recent", "Binnenkort"],
        horizontal=True, key="pm_view",
    )
    cat_filter = {
        "Kritiek": "critical", "Te laat": "overdue",
        "Recent": "recent", "Binnenkort": "upcoming",
    }
    if view != "Alle":
        df = df[df["_cat"] == cat_filter[view]]

    # ── Tabel ───────────────────────────────────────────────
    display = ["categorie", "task_name", "project", "assignee", "status", "due_date", "urgentie"]
    sorted_df = df.sort_values(["_sort", "_days"], ascending=[True, False])

    st.dataframe(
        sorted_df[display].rename(columns={
            "categorie": "🚦", "task_name": "Taak", "project": "Project",
            "assignee": "Assignee", "status": "Status",
            "due_date": "Due date", "urgentie": "Urgentie",
        }),
        hide_index=True,
        use_container_width=True,
        column_config={"Taak": st.column_config.TextColumn(width="large")},
    )

    # ── Export ──────────────────────────────────────────────
    st.divider()
    csv = sorted_df[display].to_csv(index=False)
    st.download_button("📥 Export CSV", csv, "pm_board.csv", "text/csv", key="pm_dl")
