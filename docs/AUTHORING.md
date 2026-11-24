# Writing and updating content

Everything a learner sees comes from `content/`. The app shell in `src/` rarely needs to change.

| File | Holds |
| --- | --- |
| `content/site.json` | Skill areas and objectives (copied from the study guide), the one-evening plan, exam intel, and the era-traps tables |
| `content/questions/*.json` | The question bank, one file per slice of the outline, each with its cheat sheet, trigger phrases, Learn lookup map and flashcards |
| `content/cases.json` | Case studies and Yes/No solution series used by the mock exam |
| `content/exam-snapshot.json` | The study-guide outline this content is aligned to. Only `scripts/check-exam.mjs --update` writes it |

Run `node scripts/build.mjs` after every change. It validates each question and fails with a list of problems.

## Rules

1. **Ground every fact in Microsoft Learn.** Fetch the page; don't rely on memory for product names, SDK methods, parameters, role names, limits or defaults. Each question's `ref` must be a Learn page that supports the keyed answer.
2. **Write original questions.** Never add a recalled exam question or text from a practice-test vendor.
3. **Write for the exam's era.** The exam follows the outline in `content/exam-snapshot.json`, and Learn keeps changing after that date. A keyed answer must be correct for the outline's era, and ideally today as well. Use the outline's vocabulary in stems and options, and put newer names in the explanation ("Since July 2026 the docs call this ..."). Never make an answer depend on something that changed after the outline date, and never use a later retirement as the reason a distractor is wrong. `node scripts/era-check.mjs` flags newer vocabulary in visible question text.
4. **One defensible answer.** After drafting, re-read the item as a sceptical expert. If another option can be defended from the docs, fix the stem or the option.
5. **Test decisions, not definitions.** Scenario, constraints, then "What should you do?". Distractors are real services, parameters or roles that fail on one stated constraint.
6. **Don't refer to options by letter or position.** The app shuffles them. Refer to options by their content.
7. **Keep ids stable.** Progress in learners' browsers is keyed by question id. Add new ids; don't renumber.

## Question format

Common fields: `id`, `objective` (for example `"2.1"`), `type`, `difficulty` (1 to 3), `hot` (true when candidates report the topic), `stem`, optional `code`, `explanation`, `ref: { title, url }`, `tags`.

| `type` | Extra fields |
| --- | --- |
| `single` | `options` (4), `answer: [index]` |
| `multi` | `options` (5 or 6), `answer: [two or three indices]`. The stem says how many to choose |
| `yesno` | `statements: [{ text, answer: true or false }]`, usually three |
| `dropdown` | Placeholders `[[1]]`, `[[2]]` in `code` or `stem`, and `blanks: [{ options, answer: index }]` in the same order |
| `order` | `items` in the correct order, optional `distractors` that are not part of the solution |

Indices are zero-based. Text is plain, with backticks for inline code. Keep code blocks under about 18 lines.

Explanations run two to five sentences: why the key is right, and why the most tempting distractors are wrong.

A question file also carries `cheatsheet` sections (`kind` is `table`, `bullets` or `code`, each with an optional `note` and a `ref`), `triggers` (`when`, `pick`, `why`), `lookup` (`topic`, `search`, `url`) and `flashcards` (`front`, `back`).

## When Microsoft changes the outline

The exam-watch workflow opens an issue labelled `exam-update` that lists the added and removed lines.

1. Read the change log table in the [study guide](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-103).
2. Update the skill areas, objectives and weights in `content/site.json`.
3. For each changed objective, re-check the affected questions, cheat sheets, triggers and flashcards against current Learn pages. Add questions for new objectives and remove or rewrite ones for objectives that were dropped.
4. Move rows in the era-traps tables (`deltas` in `content/site.json`) that the new outline makes obsolete.
5. Run `node scripts/check-exam.mjs --update`, then `node scripts/build.mjs` and `node scripts/era-check.mjs`.
6. Open a pull request. When it merges, the site rebuilds and the warning banner clears.

## Reviewing a file

`node scripts/dump.mjs q content/questions/d2a-1.json` prints a compact, readable listing of a file's questions with the keys marked. `node scripts/dump.mjs cheats <file>` prints its cheat sheet and triggers.
