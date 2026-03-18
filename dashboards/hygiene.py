"""
Hygiëne Dashboard

Controleert datakwaliteit:
- Ontbrekende Assignee
- Ontbrekende Estimate hours
- Ontbrekende start- en due dates
- Uren op gearchiveerde lijsten of hoofdtaken
- Mismatch archivering tussen ClickUp en Gripp (via Gripp Number)
"""

import pandas as pd
import streamlit as st

from api.clickup_client import ClickUpClient
from utils.calculations import is_container_task

OVERVIEW_PROJECTS_LIST = "901512698048"


def _check_missing_assignee(tasks: list[dict]) -> list[dict]:
    return [
        _issue_row(t, "Geen assignee")
        for t in tasks
        if not t.get("assignees") and not is_container_task(t)
    ]


def _check_missing_estimate(tasks: list[dict]) -> list[dict]:
    return [
        _issue_row(t, "Geen uren-schatting")
        for t in tasks
        if not t.get("time_estimate") and not is_container_task(t)
    ]


def _check_missing_dates(tasks: list[dict]) -> list[dict]:
    issues = []
    for t in tasks:
        if is_container_task(t):
            continue
        missing = []
        if not t.get("start_date"):
            missing.append("start date")
        if not t.get("due_date"):
            missing.append("due date")
        if missing:
            issues.append(_issue_row(t, f"Ontbreekt: {', '.join(missing)}"))
    return issues


def _check_time_on_archived(
    client: ClickUpClient, space_id: str
) -> list[dict]:
    """Vind taken in gearchiveerde lijsten waar uren op staan."""
    issues = []
    for folder in client.get_folders(space_id):
        for lst in client.get_lists(folder["id"], archived=True):
            try:
                tasks = client.get_all_tasks_in_list(lst["id"], include_closed=True)
            except Exception:
                continue
            for t in tasks:
                spent = t.get("time_spent") or 0
                if spent > 0:
                    issues.append({
                        "task_name": t["name"],
                        "project": folder["name"],
                        "list": lst["name"],
                        "uren": round(client.ms_to_hours(spent), 1),
                        "url": t.get("url", ""),
                        "probleem": "Uren op gearchiveerde lijst",
                    })
    return issues


def _check_parent_task_hours(tasks: list[dict], client: ClickUpClient) -> list[dict]:
    """Vind hoofdtaken (zonder parent) waar direct uren op geschreven zijn."""
    issues = []
    for t in tasks:
        if t.get("parent"):
            continue
        spent = t.get("time_spent") or 0
        if spent <= 0:
            continue
        subtask_ids = [
            st.get("id") for st in t.get("subtasks", [])
        ] if "subtasks" in t else []
        if subtask_ids:
            issues.append({
                **_issue_row(t, "Uren op hoofdtaak (heeft subtaken)"),
                "uren": round(client.ms_to_hours(spent), 1),
            })
    return issues


def _check_gripp_mismatch(
    client: ClickUpClient, space_ids: dict[str, str]
) -> list[dict]:
    """
    Vergelijk Overview/Projects (met Gripp Number) met actieve folders in Delivery.
    Detecteer mismatches in open/gearchiveerd status.
    """
    issues = []

    overview_projects = []
    page = 0
    while True:
        tasks = client.get_tasks(OVERVIEW_PROJECTS_LIST, page=page, include_closed=True)
        if not tasks:
            break
        overview_projects.extend(tasks)
        page += 1

    delivery_id = space_ids.get("delivery")
    if not delivery_id:
        return issues

    active_folders = {f["name"] for f in client.get_folders(delivery_id)}
    archived_folders = {f["name"] for f in client.get_folders(delivery_id, archived=True)}

    for proj in overview_projects:
        proj_name = proj["name"]
        status = (proj.get("status", {}).get("status") or "").lower()
        gripp_nr = client.extract_custom_field(proj, "Gripp Number")

        is_clickup_active = status not in ("complete", "completed", "done", "closed")

        if is_clickup_active:
            list_url = client.extract_custom_field(proj, "List")
            if not list_url:
                issues.append({
                    "project": proj_name,
                    "gripp_nr": gripp_nr or "—",
                    "probleem": "Actief project zonder gekoppelde lijst in Delivery",
                })

    return issues


def _issue_row(task: dict, probleem: str) -> dict:
    status = (task.get("status", {}).get("status") or "").capitalize()
    assignees = ", ".join(
        a.get("username", a.get("email", "?")) for a in task.get("assignees", [])
    )
    return {
        "task_name": task["name"],
        "project": task.get("_folder_name") or task.get("_list_name", ""),
        "list": task.get("_list_name", ""),
        "status": status,
        "assignee": assignees or "—",
        "url": task.get("url", ""),
        "probleem": probleem,
    }


def render(client: ClickUpClient, space_ids: dict[str, str]):
    st.header("🧹 Hygiëne Dashboard")

    st.sidebar.markdown("### Controles")
    selected_spaces = st.sidebar.multiselect(
        "Spaces voor taak-checks",
        options=[k for k in space_ids if k != "overview"],
        default=["delivery"],
        key="hyg_spaces",
    )
    check_archived = st.sidebar.checkbox(
        "Controleer gearchiveerde lijsten", value=False, key="hyg_archived"
    )
    check_gripp = st.sidebar.checkbox(
        "Controleer Gripp/ClickUp mismatch", value=True, key="hyg_gripp"
    )
    max_folders = st.sidebar.slider(
        "Max folders per space", 5, 50, 15, key="hyg_max_folders"
    )

    with st.spinner("Taken ophalen..."):
        all_tasks = []
        for space_key in selected_spaces:
            sid = space_ids.get(space_key)
            if not sid:
                continue
            folders = client.get_folders(sid)[:max_folders]
            for folder in folders:
                lists = client.get_lists(folder["id"])
                for lst in lists:
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
        st.warning("Geen taken gevonden met de huidige instellingen.")
        return

    st.info(f"{len(all_tasks)} taken geladen uit {len(selected_spaces)} space(s)")

    # ── Checks uitvoeren ────────────────────────────────────
    missing_assignee = _check_missing_assignee(all_tasks)
    missing_estimate = _check_missing_estimate(all_tasks)
    missing_dates = _check_missing_dates(all_tasks)
    parent_hours = _check_parent_task_hours(all_tasks, client)

    archived_hours = []
    if check_archived:
        with st.spinner("Gearchiveerde lijsten controleren..."):
            for space_key in selected_spaces:
                sid = space_ids.get(space_key)
                if sid:
                    archived_hours.extend(_check_time_on_archived(client, sid))

    gripp_mismatches = []
    if check_gripp:
        with st.spinner("Gripp/ClickUp mismatch controleren..."):
            gripp_mismatches = _check_gripp_mismatch(client, space_ids)

    # ── Samenvatting ────────────────────────────────────────
    col1, col2, col3 = st.columns(3)
    col1.metric("Zonder assignee", len(missing_assignee))
    col2.metric("Zonder schatting", len(missing_estimate))
    col3.metric("Zonder datums", len(missing_dates))

    col4, col5, col6 = st.columns(3)
    col4.metric("Uren op gearchiveerd", len(archived_hours))
    col5.metric("Uren op hoofdtaken", len(parent_hours))
    col6.metric("Gripp mismatches", len(gripp_mismatches))

    total = (
        len(missing_assignee) + len(missing_estimate) + len(missing_dates)
        + len(archived_hours) + len(parent_hours) + len(gripp_mismatches)
    )

    if total == 0:
        st.success("Geen hygiëne-problemen gevonden!")
        return

    st.divider()

    # ── Tabs ────────────────────────────────────────────────
    tab_labels = [
        f"Assignee ({len(missing_assignee)})",
        f"Schatting ({len(missing_estimate)})",
        f"Datums ({len(missing_dates)})",
        f"Gearchiveerd ({len(archived_hours)})",
        f"Hoofdtaken ({len(parent_hours)})",
        f"Gripp ({len(gripp_mismatches)})",
    ]
    tabs = st.tabs(tab_labels)

    _render_tab(tabs[0], missing_assignee, "Taken zonder assignee")
    _render_tab(tabs[1], missing_estimate, "Taken zonder uren-schatting")
    _render_tab(tabs[2], missing_dates, "Taken zonder datums")
    _render_tab(tabs[3], archived_hours, "Uren op gearchiveerde lijsten", extra="uren")
    _render_tab(tabs[4], parent_hours, "Uren op hoofdtaken", extra="uren")
    _render_tab(tabs[5], gripp_mismatches, "Gripp/ClickUp mismatches", columns=["project", "gripp_nr", "probleem"])


def _render_tab(
    tab,
    issues: list[dict],
    title: str,
    extra: str | None = None,
    columns: list[str] | None = None,
):
    with tab:
        if not issues:
            st.info(f"Geen problemen gevonden: {title}")
            return

        df = pd.DataFrame(issues)

        if columns:
            available = [c for c in columns if c in df.columns]
            rename = {"project": "Project", "gripp_nr": "Gripp Nr.", "probleem": "Probleem"}
        else:
            base = ["task_name", "project", "list", "probleem"]
            if extra and extra in df.columns:
                base.insert(3, extra)
            available = [c for c in base if c in df.columns]
            rename = {
                "task_name": "Taak", "project": "Project", "list": "Lijst",
                "probleem": "Probleem", "uren": "Uren",
            }

        st.dataframe(
            df[available].rename(columns=rename),
            hide_index=True,
            use_container_width=True,
        )

        csv = df[available].to_csv(index=False)
        st.download_button(
            f"📥 Export {title}", csv,
            f"hygiene_{title.lower().replace(' ', '_')}.csv", "text/csv",
            key=f"dl_{title}",
        )
