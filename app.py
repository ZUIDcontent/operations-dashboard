"""
ZUID ClickUp Dashboards

1. Financieel Dashboard — Opdrachtwaarde, geplande waarde, OHW, signalering
2. Hygiëne Dashboard  — Datakwaliteit en consistentie checks
3. PM Board           — Deadline monitoring en urgentie
"""

import streamlit as st

from api.clickup_client import ClickUpClient
from dashboards import financial, hygiene, pm_board

st.set_page_config(
    page_title="ZUID Dashboards",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)


@st.cache_resource
def get_client():
    return ClickUpClient()


@st.cache_data(ttl=300)
def get_space_ids(_client: ClickUpClient) -> dict[str, str]:
    return _client.find_space_ids()


def main():
    client = get_client()

    with st.sidebar:
        st.markdown(
            "<h1 style='color: #FF6B35; margin-bottom: 0;'>ZUID</h1>"
            "<p style='color: #888; margin-top: 0;'>ClickUp Dashboards</p>",
            unsafe_allow_html=True,
        )
        st.divider()

    try:
        space_ids = get_space_ids(client)
    except Exception as e:
        st.error(f"Kan geen verbinding maken met ClickUp: {e}")
        st.info(
            "Controleer CLICKUP_API_TOKEN en CLICKUP_TEAM_ID in Streamlit Secrets (Cloud) of `.env` (lokaal)."
        )
        return

    if not space_ids:
        st.warning("Geen ZUID spaces gevonden (Growth, Delivery, Operations, Overview).")
        return

    with st.sidebar:
        st.success(f"{len(space_ids)} spaces verbonden")
        for name, sid in sorted(space_ids.items()):
            st.caption(f"{name.capitalize()}: `{sid}`")
        st.divider()

    page = st.sidebar.radio(
        "Dashboard",
        ["📊 Financieel", "🧹 Hygiëne", "📋 PM Board"],
        key="nav",
    )

    with st.sidebar:
        st.divider()
        if st.button("🔄 Cache legen & herladen"):
            st.cache_data.clear()
            st.rerun()
        st.divider()
        st.caption("ZUID — ClickUp Dashboards v1.0")

    if page == "📊 Financieel":
        financial.render(client, space_ids)
    elif page == "🧹 Hygiëne":
        hygiene.render(client, space_ids)
    elif page == "📋 PM Board":
        pm_board.render(client, space_ids)


if __name__ == "__main__":
    main()
