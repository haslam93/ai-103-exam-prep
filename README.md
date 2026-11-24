# AI-103 Exam Prep

Free practice exams, cheat sheets and flashcards for Microsoft Exam AI-103, *Developing AI Apps and Agents on Azure* (Microsoft Certified: Azure AI Apps and Agents Developer Associate).

**Open the app: https://haslam93.github.io/ai-103-exam-prep/**

[![Build and deploy](https://github.com/haslam93/ai-103-exam-prep/actions/workflows/deploy.yml/badge.svg)](https://github.com/haslam93/ai-103-exam-prep/actions/workflows/deploy.yml)
[![Exam watch](https://github.com/haslam93/ai-103-exam-prep/actions/workflows/exam-watch.yml/badge.svg)](https://github.com/haslam93/ai-103-exam-prep/actions/workflows/exam-watch.yml)
[![Link check](https://github.com/haslam93/ai-103-exam-prep/actions/workflows/link-check.yml/badge.svg)](https://github.com/haslam93/ai-103-exam-prep/actions/workflows/link-check.yml)

The app is one self-contained page. There is nothing to install and no account, and your progress stays in your browser.

## What's in it

- **Mock exam.** 63 questions in 120 minutes, weighted like the official outline. Sections lock behind you, a solution series makes each answer final, and the case study comes last, which is how candidates describe the real exam. You get a score, a breakdown by skill area and objective, and a list of the answers you were confident about and got wrong.
- **Practice.** More than 200 original questions in the formats the exam uses: single and multiple answer, Yes/No grids, drop-down completion over Python and JSON, and ordering. Each one has an explanation and a link to the Microsoft Learn page behind it. You can check your answer or reveal it.
- **Rapid review.** Decision tables, trigger phrases ("when the question says X, pick Y"), current SDK snippets, and a map of what to type into Learn search during the exam.
- **Era traps.** The exam follows the outline dated April 16, 2026, and Microsoft Learn has renamed and retired things since then. This table lists where current knowledge can cost you points.
- **Flashcards and exam intel.** Format, timing and the topics candidates say came up, with links to the sources.

## How it stays current

| Workflow | Runs | What it does |
| --- | --- | --- |
| [Exam watch](.github/workflows/exam-watch.yml) | Daily | Compares the official [study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103) with the snapshot this content is aligned to. When Microsoft changes the outline, it opens an issue that lists the objectives that were added and removed. |
| [Build and deploy](.github/workflows/deploy.yml) | On every push to `main`, and daily | Validates every question, builds the page and publishes it to GitHub Pages. |
| [Link check](.github/workflows/link-check.yml) | Weekly | Requests every Microsoft Learn reference in the content and opens an issue for pages that are gone or have moved. |
| [Validate](.github/workflows/validate.yml) | On every pull request | Runs the same validation as the build, so a broken question can't be merged. |

A banner at the top of the app shows when the content last changed, which outline it matches, and when that outline was last checked. If Microsoft changes the outline, the banner says so until the content catches up.

Detecting a change is automatic. Rewriting questions is not. Someone has to read the new outline and update the content through a pull request, by hand or with a coding agent. [docs/AUTHORING.md](docs/AUTHORING.md) has the steps.

## Accuracy

Every question, cheat sheet and flashcard was written against Microsoft Learn pages and links to its source. The questions are original. None is a real exam item, and candidate reports were used only for format and topic emphasis.

The product changes quickly, so mistakes are possible. Each explanation has a **Report a problem with this question** link that opens a prefilled issue. Please include the Learn page that supports your point.

## Use it offline

Open the app and save the page (Ctrl+S). The saved file works without a connection.

## Run it locally or contribute

You need Node.js 20 or later. There are no dependencies.

```
node scripts/build.mjs         # validates the content and writes dist/index.html
node scripts/check-exam.mjs    # compares the live study guide with the snapshot
node scripts/check-links.mjs   # checks every reference URL
node scripts/era-check.mjs     # flags vocabulary newer than the exam outline in question text
```

| Path | Holds |
| --- | --- |
| `content/questions/` | The question bank, with the cheat sheet, trigger phrases and flashcards for each slice of the outline |
| `content/cases.json` | Case studies and solution series for the mock exam |
| `content/site.json` | Skill areas and objectives, exam intel, and the era-traps tables |
| `content/exam-snapshot.json` | The study-guide outline the content is aligned to |
| `src/` | The app shell: one HTML template, one stylesheet and plain JavaScript |
| `scripts/` | The build and the checks that the workflows run |

Corrections and new questions are welcome. Read [docs/AUTHORING.md](docs/AUTHORING.md) first: it covers the question format and the rules, the main one being that every fact must come from a Microsoft Learn page you can link to.

## Disclaimer

This project is not affiliated with or endorsed by Microsoft. Microsoft and Azure are trademarks of the Microsoft group of companies. Use the [official study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103) and Microsoft Learn as the authority on what the exam covers.
