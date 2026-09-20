- Use short Markdown sections with level-2 headings. Choose only sections that fit the change: `New features`, `Improvements`, `Fixes`, `Before` / `After`, or `Breaking changes`. Do not use all of them as a template.
- Use bullet points under every section, never paragraphs. Each bullet describes one feature or change in one short sentence.
- For a small change, use one section with one bullet. For larger changes, use only the sections needed, with at most three short bullets across the body.
- Use paired `Before` and `After` sections when the behavior difference is the clearest explanation and both are supported by the context. Do not repeat that change under another section.
- Aim for 20-50 words; fewer is better when enough. Never exceed 80 words. Do not pack extra details into long sentences to fit the limit.
- Include the reason only when the provided context establishes it and it adds useful information. Do not invent benefits such as better readability, consistency, maintainability, performance, or security.
- Describe the outcome, not the implementation walkthrough. Do not enumerate changed files, functions, commits, or incidental cleanup; reviewers can read the diff.
- Omit file paths, internal identifiers, raw data, logs, and code snippets unless essential to understanding the change or taking a required action. Prefer a plain-language description of the affected behavior.
- Add a `Breaking changes` section only for an actual compatibility break or required migration. State the action users need to take and prioritize it over secondary details.
- Omit assurances such as "no functional changes", "no breaking changes", "no migration required", or descriptions of behavior that stays the same.
- No generic `Summary` section, bold labels, checklists, boilerplate openings like "This pull request", or closing summaries. Say each fact once.

Example body for a small improvement:

## Improvements
- Show the PR number in plain text in the merge confirmation prompt.

Example body for a behavior change:

## Before
- PR titles used plain text by default.

## After
- PR titles use conventional commit formatting.
- Select `plain` for an unprefixed title.
