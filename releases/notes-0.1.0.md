Context Evidence Ledger0.1.0: original supported-hook recorder and independent desktop/browser viewer.

- Correlates reported reads, edits and compaction boundaries by hashed turn identity.
- Keeps raw prompt/content text out of the recorder's log.
- Verifies sequence/hash consistency before displaying a timeline and canary coverage observations.
- Rejects inconsistent logs and renders user-supplied filenames as text.
- Includes a self-contained Windows desktop package, recorder source and synthetic example.

12 Node core/process/concurrency tests,8 browser behavior checks and packaged renderer/isolation smoke pass. Real Cursor-host integration remains unverified. Reported pre-read events do not prove completed reads or model use; final context and compaction semantic changes remain unknown. Hash chains require an independent expected head to detect a whole rewrite or tail truncation. This is not a modified Cursor binary or a permission/security gate.
