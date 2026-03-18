"""
Financieel Dashboard

1. Welke opdrachten zijn te veel gepland? (MT-akkoord nodig)
2. Welke opdrachten zijn niet of te weinig gepland? (<50%)
3. Geplande waarde vs. Werkelijk geschreven uren (85% signalering)

Container-taken (Task type = Container) worden overal uitgefilterd.
"""

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from api.clickup_client import ClickUpClient
from config import HOUR_DANGER_THRESHOLD, HOUR_WARNING_THRESHOLD
from utils.calculations import (
    calculate_ohw,
    get_burn_percentage,
    get_status_color,
    get_status_emoji,
    get_status_label,
    is_container_task,
)

OVERVIEW_PROJECTS_LIST = "901512698048"


def _load_overview_projects(client: ClickUpClient) -> list[dict]:
    all_projects = []
    page = 0
    while True:
        tasks = client.get_tasks(
            OVERVIEW_PROJECTS_LIST, page=page, include_closed=True
        )
        if not tasks:
            break
        all_projects.extend(tasks)
        page += 1
    return all_projects


def _build_project_records(
    overview_projects: list[dict], client: ClickUpClient, progress_bar
) -> list[dict]:
    records = []
    total = len(overview_projects)

    for i, proj in enumerate(overview_projects):
        progress_bar.progress(
            (i + 1) / total,
            text=f"Project {i+1}/{total}: {proj['name'][:40]}...",
        )

        signed_offer = client.extract_custom_field(proj, "Signed offer value")
        planned_budget_overview = client.extract_custom_field(proj, "Planned task budget")
        gripp_number = client.extract_custom_field(proj, "Gripp Number")
        list_url = client.extract_custom_field(proj, "List")
        total_budget = client.extract_custom_field(proj, "Total task budget")
        budget_left = client.extract_custom_field(proj, "Budget left")

        client_rel = client.extract_custom_field(proj, "Client")
        client_name = ""
        if isinstance(client_rel, list) and client_rel:
            client_name = client_rel[0].get("name", "")

        opdrachtwaarde = float(signed_offer) if signed_offer else 0.0
        geplande_waarde = float(total_budget or planned_budget_overview or 0)

        list_id = client.extract_list_id_from_url(list_url) if list_url else None

        sum_planned_hours = 0.0
        sum_actual_hours = 0.0
        sum_budget = 0.0
        sum_spent = 0.0
        task_count = 0

        if list_id:
            try:
                tasks = client.get_all_tasks_in_list(list_id, include_closed=True)
                for t in tasks:
                    if is_container_task(t):
                        continue

                    est_ms = t.get("time_estimate") or 0
                    spent_ms = t.get("time_spent") or 0
                    sum_planned_hours += client.ms_to_hours(est_ms)
                    sum_actual_hours += client.ms_to_hours(spent_ms)

                    task_budget = client.extract_custom_field(t, "Budget")
                    task_spent = client.extract_custom_field_by_names(
                        t, "Spent task budget", "Spent task budget (ruben)"
                    )
                    if task_budget:
                        sum_budget += float(task_budget)
                    if task_spent:
                        sum_spent += float(task_spent)

                    task_count += 1
            except Exception:
                pass

        if geplande_waarde == 0 and sum_budget > 0:
            geplande_waarde = sum_budget

        actual_value = sum_spent if sum_spent > 0 else 0
        burn_pct = get_burn_percentage(geplande_waarde, actual_value)
        ohw = calculate_ohw(opdrachtwaarde, 0, actual_value) if opdrachtwaarde > 0 else 0

        plan_pct = (geplande_waarde / opdrachtwaarde * 100) if opdrachtwaarde > 0 else 0.0

        records.append({
            "project": proj["name"],
            "client": client_name,
            "gripp_nr": gripp_number or "",
            "opdrachtwaarde": opdrachtwaarde,
            "geplande_waarde": geplande_waarde,
            "actual_value": actual_value,
            "planned_hours": round(sum_planned_hours, 1),
            "actual_hours": round(sum_actual_hours, 1),
            "burn_pct": burn_pct,
            "burn_pct_display": round(burn_pct * 100, 1),
            "plan_pct": round(plan_pct, 1),
            "status_color": get_status_color(burn_pct),
            "status_emoji": get_status_emoji(burn_pct),
            "status_label": get_status_label(burn_pct),
            "ohw": round(ohw, 2),
            "budget_left": float(budget_left) if budget_left else 0,
            "task_count": task_count,
            "has_list": bool(list_id),
        })

    return records


def render(client: ClickUpClient, space_ids: dict[str, str]):
    st.header("📊 Financieel Dashboard")

    with st.spinner("Projecten ophalen uit Overview..."):
        overview_projects = _load_overview_projects(client)

    if not overview_projects:
        st.warning("Geen projecten gevonden in Overview/Projects.")
        return

    st.sidebar.markdown("### Filters")
    only_with_value = st.sidebar.checkbox(
        "Alleen projecten met opdrachtwaarde", value=False, key="fin_only_value"
    )
    only_active = st.sidebar.checkbox(
        "Alleen actieve projecten (met taken)", value=True, key="fin_only_active"
    )
    max_projects = st.sidebar.slider(
        "Max projecten laden", 5, len(overview_projects),
        min(30, len(overview_projects)), key="fin_max",
    )

    projects_to_process = overview_projects[:max_projects]

    progress = st.progress(0, text="Data ophalen...")
    records = _build_project_records(projects_to_process, client, progress)
    progress.empty()

    df = pd.DataFrame(records)

    if only_with_value:
        df = df[df["opdrachtwaarde"] > 0]
    if only_active:
        df = df[df["task_count"] > 0]

    if df.empty:
        st.info("Geen projecten met de huidige filters.")
        return

    # ── KPI's ───────────────────────────────────────────────
    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Projecten", len(df))
    col2.metric("Opdrachtwaarde", f"€{df['opdrachtwaarde'].sum():,.0f}")
    col3.metric("Werkelijk besteed", f"€{df['actual_value'].sum():,.0f}")
    col4.metric("Totaal OHW", f"€{df['ohw'].sum():,.0f}")

    st.divider()

    # ── 1a. Te veel gepland ─────────────────────────────────
    st.subheader("🔴 Te veel gepland — MT-akkoord nodig")
    st.caption("Opdrachten waar de geplande waarde hoger is dan de opdrachtwaarde.")

    df_with_order = df[df["opdrachtwaarde"] > 0]
    overgepland = df_with_order[df_with_order["geplande_waarde"] > df_with_order["opdrachtwaarde"]].copy()

    if overgepland.empty:
        st.success("Geen opdrachten met overschrijding.")
    else:
        overgepland["overschrijding"] = overgepland["geplande_waarde"] - overgepland["opdrachtwaarde"]
        overgepland = overgepland.sort_values("overschrijding", ascending=False)

        st.error(f"**{len(overgepland)} opdracht(en) overschrijden de opdrachtwaarde**")

        st.dataframe(
            overgepland[[
                "project", "client", "opdrachtwaarde", "geplande_waarde",
                "overschrijding", "plan_pct",
            ]].rename(columns={
                "project": "Project",
                "client": "Klant",
                "opdrachtwaarde": "Opdracht (€)",
                "geplande_waarde": "Gepland (€)",
                "overschrijding": "Overschrijding (€)",
                "plan_pct": "% gepland",
            }),
            hide_index=True,
            use_container_width=True,
        )

    st.divider()

    # ── 1b. Niet of te weinig gepland ───────────────────────
    st.subheader("⚠️ Niet of te weinig gepland (<50%)")
    st.caption("Opdrachten met een opdrachtwaarde maar minder dan 50% gepland.")

    ondergepland = df_with_order[df_with_order["plan_pct"] < 50].copy()
    ondergepland = ondergepland.sort_values("plan_pct", ascending=True)

    if ondergepland.empty:
        st.success("Alle opdrachten zijn voldoende gepland (≥50%).")
    else:
        niet_gepland = ondergepland[ondergepland["geplande_waarde"] == 0]
        weinig_gepland = ondergepland[ondergepland["geplande_waarde"] > 0]

        if not niet_gepland.empty:
            st.warning(f"**{len(niet_gepland)} opdracht(en) helemaal niet gepland (0%)**")
            st.dataframe(
                niet_gepland[[
                    "project", "client", "opdrachtwaarde", "task_count",
                ]].rename(columns={
                    "project": "Project",
                    "client": "Klant",
                    "opdrachtwaarde": "Opdracht (€)",
                    "task_count": "Taken",
                }),
                hide_index=True,
                use_container_width=True,
            )

        if not weinig_gepland.empty:
            st.info(f"**{len(weinig_gepland)} opdracht(en) minder dan 50% gepland**")
            st.dataframe(
                weinig_gepland[[
                    "project", "client", "opdrachtwaarde", "geplande_waarde", "plan_pct",
                ]].rename(columns={
                    "project": "Project",
                    "client": "Klant",
                    "opdrachtwaarde": "Opdracht (€)",
                    "geplande_waarde": "Gepland (€)",
                    "plan_pct": "% gepland",
                }),
                hide_index=True,
                use_container_width=True,
            )

    st.divider()

    # ── 2. Gepland vs Werkelijk (urensignalering) ───────────
    st.subheader("📈 Geplande waarde vs. Werkelijk geschreven uren")
    st.caption(
        f"🟢 Op schema (<{int(HOUR_WARNING_THRESHOLD*100)}%) · "
        f"🟠 Let op (>{int(HOUR_WARNING_THRESHOLD*100)}%) · "
        f"🔴 Overschrijding (>{int(HOUR_DANGER_THRESHOLD*100)}%)"
    )

    df_active = df[df["actual_value"] > 0].sort_values("burn_pct", ascending=False)
    if not df_active.empty:
        color_map = {"green": "#4CAF50", "orange": "#FF9800", "red": "#F44336"}

        fig = go.Figure()
        fig.add_trace(go.Bar(
            name="Geplande waarde",
            y=df_active["project"],
            x=df_active["geplande_waarde"],
            orientation="h",
            marker_color="#90CAF9",
        ))
        fig.add_trace(go.Bar(
            name="Werkelijk besteed",
            y=df_active["project"],
            x=df_active["actual_value"],
            orientation="h",
            marker_color=[color_map[c] for c in df_active["status_color"]],
        ))
        fig.update_layout(
            barmode="group",
            height=max(400, len(df_active) * 35),
            xaxis_title="€",
            margin=dict(l=250),
        )
        st.plotly_chart(fig, use_container_width=True)

    # ── Volledige tabel ─────────────────────────────────────
    st.subheader("📋 Totaaloverzicht")

    display_cols = [
        "status_emoji", "project", "client", "opdrachtwaarde",
        "geplande_waarde", "actual_value", "plan_pct", "burn_pct_display",
        "status_label", "ohw", "planned_hours", "actual_hours",
    ]
    display_df = df[display_cols].copy().sort_values("burn_pct_display", ascending=False)

    st.dataframe(
        display_df.rename(columns={
            "status_emoji": "🚦",
            "project": "Project",
            "client": "Klant",
            "opdrachtwaarde": "Opdracht (€)",
            "geplande_waarde": "Gepland (€)",
            "actual_value": "Besteed (€)",
            "plan_pct": "% gepland",
            "burn_pct_display": "Burn %",
            "status_label": "Status",
            "ohw": "OHW (€)",
            "planned_hours": "Gepland (u)",
            "actual_hours": "Geschreven (u)",
        }),
        hide_index=True,
        use_container_width=True,
    )

    csv = display_df.to_csv(index=False)
    st.download_button("📥 Export CSV", csv, "financieel_dashboard.csv", "text/csv")
