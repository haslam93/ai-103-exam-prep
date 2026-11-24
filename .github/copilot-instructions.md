# Instructions for coding agents

This repository is a free study app for Microsoft Exam AI-103 (Developing AI Apps and Agents on Azure). It builds to one self-contained HTML page and is published with GitHub Pages.

- Content lives in `content/`. The app shell lives in `src/`. Build and check scripts live in `scripts/`. There are no dependencies.
- Read `docs/AUTHORING.md` before you touch `content/`. Its rules are binding: ground every fact in a Microsoft Learn page you fetched, write original questions, write for the era of the outline in `content/exam-snapshot.json`, keep one defensible answer, and keep question ids stable.
- Use the Microsoft Learn documentation tools to verify product names, SDK methods, parameters, role names, limits and defaults. Do not rely on memory.
- Never add real exam questions or text from practice-test vendors.
- After any change run `node scripts/build.mjs` and fix every problem it reports, then run `node scripts/era-check.mjs`.
- For an issue labelled `exam-update`, follow "When Microsoft changes the outline" in `docs/AUTHORING.md` and open a pull request. Do not push to `main`.
- For an issue labelled `broken-links`, replace each broken or moved URL with the current Learn page that supports the same fact. If no page supports it any more, re-verify the question and fix or remove it.
- For an issue labelled `question-error`, verify the report against Microsoft Learn before you change a key. Say in the pull request which page settled it.
