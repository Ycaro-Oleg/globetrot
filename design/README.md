# Design references

These are frozen design inputs. **They are not production code.** Don't edit files under `reference/`. Record refinements in [`docs/design/`](../docs/design/).

| Folder | What | Status |
|---|---|---|
| [`reference/claude-design-v1/`](reference/claude-design-v1/) | High-fidelity HTML/CSS/JS prototype of the app and the landing, plus the handoff spec (`README.md`) | Baseline, reviewed in [`docs/design/design-audit.md`](../docs/design/design-audit.md) |

## Viewing the prototype

The prototype loads d3, TopoJSON and Natural Earth from CDNs, so serve it over HTTP instead of opening it as `file://`:

```bash
cd design/reference/claude-design-v1 && python3 -m http.server 8765
```

Then open `http://localhost:8765/Globetrot%20-%20App.html` and click "Open the Japan demo board", or open `Globetrot%20-%20Landing.html`.

The engine folder is called `atlas/` because the prototype also supported an alternate brand skin. Globetrot is the chosen brand, and only it will be implemented.
