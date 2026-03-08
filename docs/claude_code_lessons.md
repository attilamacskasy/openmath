# Lessons Learned from Using Claude Code

## 1. .gitignore for .claude/
Add `.claude/` to your `.gitignore`. The worktrees and `launch.json` are local dev config and should not be committed to the repository.

## 2. VSCode + Worktrees
- When you open a worktree folder in VSCode, you're editing an isolated copy, not the main branch.
- After merging a PR:
  - In your main VSCode window (`C:\Users\attila\Desktop\Code\openmath`), run `git pull` to get the merged changes.
  - The worktree at `.claude/worktrees/mystifying-feynman` can be deleted—it served its purpose.
  - For future sessions, Claude Code will create a new worktree automatically.
- **Best practice:** Work in your main repo VSCode. Claude Code uses worktrees behind the scenes so it doesn't interfere with your working directory. You don't need to open worktree folders in VSCode.

## 3. Credit Consumption
- **Claude Code (this tool):**
  - Uses Opus 4.6 — the most capable and most expensive model.
  - Pricing: $15 / million input tokens, $75 / million output tokens.
  - Sessions involving project exploration, multiple file reads, preview server interactions, screenshots, and iterative debugging can be token-heavy.
  - A session like this (diagnosing, fixing, PR) typically costs $5–15 depending on context length.
- **GitHub Copilot:**
  - Copilot Pro uses various models. Opus 4.6 in Copilot is 3x premium requests as noted.
  - Claude Code is billed by actual token usage, not "requests."
  - Claude Code's advantage: the preview loop (seeing actual rendering), which Copilot chat can't do.
- **To check your usage:**
  - Look at your Anthropic dashboard or Claude Code billing page for exact numbers.

---

*Summary: Add `.claude/` to `.gitignore`, work in your main repo VSCode, and monitor credit usage for cost control.*
