# Snowman

A free app on FreeAppStore: an interactive US snow map (states, counties and
ski resorts) built on d3-geo + TopoJSON data under `web/public/`.

- Subdomain: `snowman.freeappstore.online`
- Dev: `pnpm install && pnpm dev`
- Build: `pnpm build` · Tests: `pnpm test`
- Data: `build_counties.py` / `find_snow.py` regenerate the JSON under `web/public/`
- Deploy: `git push origin main` (auto-deploys to R2 via GitHub Actions)

Free, MIT-licensed, no tracking. For platform conventions, read
https://freeappstore.online/skills.md
before writing or changing anything (same guide, source form:
https://raw.githubusercontent.com/freeappstore-online/freeappstore/main/SKILLS.md).
