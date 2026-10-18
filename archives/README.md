# Original project archive

`legacy-canvas/` contains all 35 original files, preserved byte for byte from the working tree at the start of the October 17, 2026 review. The latest source commit was `d5edd10` (August 20, 2025). The seven existing modified files differed from HEAD only by CRLF line endings; those exact working-tree bytes are retained.

`legacy-canvas.manifest.json` records the source commit, byte sizes, and SHA-256 checksums. Run `node scripts/verify-archive.mjs` from the repository root to verify the snapshot.

Treat this directory as historical source. Make game changes in `remake/`. Its asset preparation script reads the archive and writes generated files only within the new project. Git history remains at the repository root.
