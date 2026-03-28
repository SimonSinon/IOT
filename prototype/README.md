# SynchroTower GitHub Pages Demo

This folder contains a static, browser-only version of the **full SynchroTower prototype**.

## Local Preview

Open `docs/index.html` directly in a browser, or run a simple static server:

```bash
cd docs
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Publish to GitHub Pages

1. Push this repository to GitHub.
2. In GitHub repo settings, open **Pages** and set source to **GitHub Actions**.
3. Push to `main` (or run the workflow manually).
4. Site URL will be:
   - `https://<your-username>.github.io/<repo-name>/`

## Notes

- This demo is static (no Flask server required).
- Data and AI responses are simulated in `docs/assets/app.js`.
- Visitors can navigate all major prototype modules:
  - Executive Overview
  - Procurement
  - Warehouse Manager
  - Production Planner
  - AI Recommendations
  - AI Agent Ops
  - Demand Intelligence
  - Safety Stock
  - SKU Master
