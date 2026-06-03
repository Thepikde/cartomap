# Cartomap — Landing Page (`cartomap.thepik.de`)

Self-contained static landing page. **One file, no build step, no dependencies** —
all CSS, the favicon and the small copy-to-clipboard script are inlined in `index.html`.

## Deploy to All-inkl (manual FTP)

1. **Subdomain anlegen** — im All-inkl **KAS**:
   `Domain → Subdomains → Neu` → `cartomap.thepik.de`.
   Dokumentenwurzel auf einen eigenen Ordner setzen, z. B. `/cartomap.thepik.de/`.
2. **SSL aktivieren** — beim Subdomain-Eintrag das kostenlose **Let's-Encrypt-Zertifikat**
   einschalten → die Seite läuft sauber über `https://`.
3. **Hochladen** — per FTP/SFTP (z. B. FileZilla) `index.html` in den Dokumentenwurzel-Ordner legen.
   Das war's — fertig.

> Bei jeder Änderung einfach `index.html` neu hochladen (überschreiben).
> Eine Landingpage ändert sich selten, daher ist manuelles Hochladen hier völlig okay.

## Lokale Vorschau

```bash
open index.html            # macOS: im Standardbrowser öffnen
```

## Später (optional)

- **og:image** ergänzen (1200×630 PNG) für schönere Link-Vorschauen in Slack/Discord/X.
- **Auto-Deploy** via GitHub Action (SFTP) oder DNS → Vercel/GitHub Pages, falls die Seite
  doch häufiger wächst.
