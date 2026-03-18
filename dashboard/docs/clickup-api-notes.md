# ClickUp API – notities

## Rechten beperken: geen uren schrijven op “complete” taken

**Vraag:** Is het mogelijk via de API rechten te beperken zodat op een taak met status “complete” geen uren meer geschreven kunnen worden?

**Antwoord:** **Nee.** De ClickUp API ondersteunt geen per-taak of per-status uitschakelen van time tracking. Rechten en ClickApps (zoals Time Tracking) worden op **workspace-** of **space-**niveau ingesteld, niet op taakniveau. Er is geen endpoint om time-trackingrechten te koppelen aan een specifieke taak of status.

**Praktisch alternatief:**  
- Afspraken in het team: uren alleen schrijven zolang de taak niet op “complete” staat.  
- Eventueel een **feature request** bij ClickUp om time tracking te blokkeren voor taken in bepaalde statussen (bijv. “complete” / “afgesloten”).

Referentie: [ClickUp API – Time Tracking](https://developer.clickup.com/reference/tracktime), workspace permissions.
