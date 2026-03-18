# ZUID ClickUp Dashboards

Drie dashboards voor projectmanagement bij ZUID, gebouwd met Streamlit en de ClickUp API.

## Dashboards

### 1. Financieel Dashboard
- **Opdrachtwaarde vs. Geplande waarde** — Signaleert wanneer geplande uren de opdrachtwaarde overschrijden (MT-akkoord vereist)
- **Geplande vs. Werkelijke uren** — Rood/oranje/groen signalering bij 85% urenschrijving
- **OHW-berekening** — Onderhanden Werk, gemaximeerd op opdrachtwaarde

### 2. Hygiëne Dashboard
- Taken zonder Assignee
- Taken zonder uren-schatting (Estimate)
- Taken zonder start- of due date
- Uren geschreven op gearchiveerde lijsten of hoofdtaken
- Mismatch tussen ClickUp en Gripp (gearchiveerd/open status)

### 3. PM Board
- Taken met verlopen due dates (categorieën: kritiek >14d, te laat 7-14d, recent <7d)
- Taken met due date in de nabije toekomst
- Filter op assignee, space, en tijdsperiode
- CSV export

## Setup

```bash
# 1. Installeer dependencies
pip install -r requirements.txt

# 2. Configureer environment variables
cp .env.example .env
# Vul je ClickUp API token en Team ID in

# 3. Start de applicatie
streamlit run app.py
```

## Configuratie (.env)

| Variabele | Beschrijving |
|-----------|-------------|
| `CLICKUP_API_TOKEN` | Je ClickUp API token (begint met `pk_`) |
| `CLICKUP_TEAM_ID` | Je ClickUp Workspace/Team ID |
| `GRIPP_API_URL` | Gripp API URL (optioneel) |
| `GRIPP_API_TOKEN` | Gripp API token (optioneel) |

## Projectstructuur

```
├── app.py                      # Hoofdapplicatie (Streamlit)
├── config.py                   # Configuratie & environment variables
├── api/
│   ├── clickup_client.py       # ClickUp API client
│   └── gripp_client.py         # Gripp API client
├── dashboards/
│   ├── financial.py            # Financieel Dashboard
│   ├── hygiene.py              # Hygiëne Dashboard
│   └── pm_board.py             # PM Board
├── utils/
│   └── calculations.py         # Business logic (OHW, signalering)
└── .streamlit/
    └── config.toml             # Streamlit theme configuratie
```

## ZUID ClickUp Structuur

| Space | Doel |
|-------|------|
| **Growth** | Interne projecten met budgetgoedkeuring van Ops manager |
| **Delivery** | Klantwerk — waar omzet wordt gegenereerd |
| **Operations** | Doorlopend intern werk (management, HR, finance) |
| **Overview** | Overzicht van klanten, projecten en schattingen |
