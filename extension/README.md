# Coherence — Browser Extension (Phase 0)

A diff-checking, thread-weaving, zero-trust knowledge tool that turns scrolling into sense-making. **A ruler, not a judge.**

## What It Does

- Right-click any highlighted text → **"Save to Coherence"**
- Stores snippets locally in your browser — no cloud, no accounts
- Runs lightweight semantic similarity against past snippets using char n-gram vectors
- When you find something similar but contradictory, a subtle badge nudges you
- Click to see a split-screen comparison with decoherence scores and conflict highlights

## Quick Start (Load Locally)

1. Open `chrome://extensions/` or `firefox://addons/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select this `extension/` directory
4. Done! A ◈ icon appears in your toolbar.

## Project Structure

```
extension/
├── manifest.json           # Extension manifest (MV3)
├── icons/                  # Extension icons (place PNGs here)
├── _locales/en/messages.json  # i18n strings
│
├── background.js           # Service worker: context menus, node indexing
├── content/
│   ├── overlay.js          # Floating FAB button on pages
│   └── overlay.css         # FAB styles
│
├── popup/
│   ├── index.html          # Popup UI
│   ├── popup.css           # Popup styles (dark theme)
│   └── popup.js            # Popup logic, comparison modal
│
├── options/
│   ├── index.html          # Settings page
│   └── options.js          # Settings logic, export/import
│
├── services/
│   ├── indexeddb.js        # IndexedDB wrapper (node storage + vectors)
│   └── crossCheck.js       # Diff engine: similarity, stance detection, threading
│
└── utils/
    ├── vectorizer.js       # Char trigram embedding + cosine similarity
    └── nodeFactory.js      # Node object creation from selection data
```

## Architecture

### Capture
Selection text → node object with source URL, author, surrounding context

### Index
Text → character trigram frequency vector (26³ dimensional). Lightweight, zero dependencies. Future: swap to ONNX all-MiniLM-L6-v2 via @xenova/transformers.

### Cross-Check
Cosine similarity scan against existing nodes. Stance flag detection (contrasting word pairs, numeric conflicts, date mismatches). Decoherence score = inverse similarity modulated by stance flags.

### Thread Building
BFS graph of nodes connected above 75% threshold. Each thread is a chain of related claims across time and sources.

## Similarity Thresholds

| Threshold | Use Case          | Effect                     |
|-----------|-------------------|----------------------------|
| 95%       | Almost identical  | Near-duplicates            |
| 85%       | Default           | Same topic, possible contradiction |
| 75%       | Thread building   | Broad topic clustering     |

## Data Policy

- All data stays in your browser's IndexedDB
- No analytics, no telemetry, no network calls to external services
- Export/import via JSON files for backup and sharing
- "Clear all" is always one click away

## Building (Optional)

No build step required for development. For production:

```bash
# Zip the extension for Chrome Web Store / Firefox Add-ons
zip -r coherence-extension.zip manifest.json background.js content/ popup/ options/ services/ utils/ icons/ _locales/

# Or with esbuild for future TypeScript migration
npm run build
```

## Roadmap

- [x] Phase 0: Browser extension (this code)
- [ ] On-device AI model (all-MiniLM-L6-v2 via ONNX)
- [ ] Thread visualization in popup
- [ ] Export/import as "Coherence Packages" (encrypted JSON)
- [ ] Mobile companion app (React Native / Flutter)
- [ ] Local Wi-Fi sync between browser and mobile
- [ ] Public DHT relay for anonymous contradiction patterns

## License

MIT — code is public, auditable, and forkable. As the directive says: no moderation, no identity, no advertising. Ever.
