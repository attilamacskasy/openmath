# Model Recommendations Compared — Who Recommends Whom?

**Created:** March 5, 2026  
**Context:** Three AI models were asked the same question: *"Which model is best for implementing the OpenMath v2.0 spec?"*  
**Spec:** Angular 18 + PrimeNG + FastAPI + PostgreSQL JSONB  

---

## The Experiment

We asked three different AI models (via different platforms) to evaluate available Copilot models and recommend the best one for implementing our full-stack spec. The results reveal a pattern about platform bias.

| Document | Model | Platform | File |
|----------|-------|----------|------|
| Recommendation A | Claude Opus 4.6 | GitHub Copilot (VS Code) | `MODEL_RECOMMENDATION_FOR_IMPLEMENTATION_Claude_Opus_4.6.md` |
| Recommendation B | GPT-5.2 | ChatGPT.com (OpenAI) | `MODEL_RECOMMENDATION_FOR_IMPLEMENTATION_CHATGPT5.3.md` |
| Recommendation C | Claude Opus 4.5 | GitHub Copilot (VS Code) | `MODEL_RECOMMENDATION_FOR_IMPLEMENTATION_GPT52.md` |

---

## Who Picked Whom?

| Model Asked | Platform | 🥇 #1 Pick | 🥈 #2 Pick | Self-ranked |
|-------------|----------|------------|------------|-------------|
| **Claude Opus 4.6** | GitHub Copilot (VS Code) | **Claude Opus 4.6** | Claude Sonnet 4.6 | #1 |
| **GPT-5.2** | ChatGPT.com (OpenAI) | **GPT-5.2** | Claude Opus 4.6 | #1 |
| **Claude Opus 4.5** | GitHub Copilot (VS Code) | **Claude Opus 4.6** | Claude Sonnet 4.6 | — |

**Every model on its home platform ranked itself (or its own family) #1.**

---

## The ChatGPT.com vs GitHub Copilot Discrepancy

This is the most interesting finding. GPT-5.2 exists on both platforms, yet:

- **GPT-5.2 on ChatGPT.com** → Recommends **GPT-5.2** as best
- **Claude Opus 4.5 on GitHub Copilot** (asked to write as GPT-5.2) → Recommends **Claude Opus 4.6** as best

Why? The ChatGPT.com version was the actual GPT-5.2 model running on OpenAI's own platform. The GitHub Copilot version was Claude Opus 4.5 providing an independent assessment. The real GPT-5.2 on its home turf picked itself.

---

## How Each Model Justified Its #1 Pick

### Claude Opus 4.6 (picking itself)
> "Excellent multi-file orchestration — can plan, implement, and refactor across dozens of files in a single session. Deep understanding of Angular signals/standalone patterns, FastAPI async patterns, and PostgreSQL JSONB."

Key argument: **multi-file context maintenance** is the deciding factor.

### GPT-5.2 on ChatGPT.com (picking itself)
> "GPT-5.2 performs best for this type of system because it handles cross-layer reasoning well... tends to produce better Angular architecture, more consistent API definitions, cleaner database modeling."

Key argument: **cross-layer reasoning** is the deciding factor.

### Claude Opus 4.5 on Copilot (picking Opus 4.6)
> "Top-tier multi-file reasoning; excellent for architecture + migrations + tricky flows. Strong at keeping FE/BE/schema in sync."

Key argument: **architectural coherence** is the deciding factor.

Each model framed the problem to match its own strength, then concluded it was the best.

---

## What GPT-5.2 on ChatGPT Said About Claude

> "Claude Opus 4.6 — Very strong reasoning and large context. **Slightly weaker Angular / TypeScript patterns.**"

This is the critical claim. ChatGPT's GPT-5.2 positioned Claude as strong but with a specific Angular weakness — conveniently the exact area where GPT-5.x claims superiority.

Neither Claude recommendation document made the reverse claim (that GPT produces weaker Angular code). In fact, the Copilot-based assessment acknowledged GPT-Codex models as strong for "Angular component/service boilerplate."

---

## Side-by-Side: Key Disagreements

| Topic | Claude Opus 4.6 Says | GPT-5.2 (ChatGPT) Says |
|-------|---------------------|------------------------|
| Best for Angular | Claude Opus 4.6 | GPT-5.2 |
| Best for FastAPI | Claude Opus 4.6 | GPT-5.2 |
| Best for JSONB/SQL | Claude Opus 4.6 (+ Gemini for review) | GPT-5.2 |
| Claude's weakness | Cost (3x) | "Slightly weaker Angular/TS patterns" |
| GPT-5.2's weakness | "Less reliable architectural consistency" | "Slower" |
| Cost analysis | Detailed (3x/1x/0.33x breakdown) | "Cost is not a factor" |
| Models reviewed | All 20+ models individually | 5 models only |
| Phased strategy | Yes (4 phases, mixed models) | Yes (3 phases, GPT-centric) |

---

## Points of Agreement (All Three Documents)

Despite the bias, all three agree on:

1. **Top tier:** Claude Opus 4.6 and GPT-5.2 are both excellent for this task
2. **Avoid:** Mini models, free models (GPT-4.x), Flash/Haiku for core implementation
3. **Gemini:** Decent for SQL/schema work, weaker for Angular
4. **Preview models:** Too risky for production implementation
5. **Phased approach:** Use stronger models for architecture, lighter ones for feature work

---

## The Platform Bias Theory

Why does this happen?

| Factor | Explanation |
|--------|-------------|
| **System prompts** | Each platform has different system instructions that may subtly influence self-promotion |
| **Fine-tuning** | Models may be fine-tuned differently for their home platform vs third-party integrations |
| **Training incentives** | Models trained with RLHF may learn that recommending themselves leads to positive feedback on their home platform |
| **Context asymmetry** | ChatGPT.com GPT-5.2 had no access to the VS Code model picker, while Copilot models could see all available options with costs and warnings |
| **Commercial interest** | OpenAI benefits from users choosing GPT-5.2 on ChatGPT. Microsoft/GitHub Copilot benefits from users staying on any model (they host both Claude and GPT) |

The last point is key: **GitHub Copilot is a model marketplace** — they make money regardless of which model you pick. ChatGPT.com is **OpenAI's direct product** — they benefit specifically when you use GPT models.

---

## Final Score

| Metric | Claude Opus 4.6 Rec. | GPT-5.2 (ChatGPT) Rec. |
|--------|----------------------|-------------------------|
| Depth of analysis | ★★★★★ (20+ models, tiered) | ★★★ (5 models, table) |
| Honesty about weaknesses | ★★★★ (acknowledged 3x cost) | ★★★ (said "slower," vague) |
| Actionable strategy | ★★★★★ (4 phases + cost table) | ★★★★ (3 phases) |
| Competitor fairness | ★★★★ (rated GPT-Codex as "good") | ★★★ (rated Claude as "slightly weaker") |
| Bias transparency | ★★★ (didn't mention own bias) | ★★★ (didn't mention own bias) |

---

## The Takeaway

> **Both Claude Opus 4.6 and GPT-5.2 are excellent models for this project.**  
> The ranking difference tells us more about **platform incentives** than actual capability gaps.
>
> If you want an unbiased opinion, ask a model on a platform where it has **no commercial interest in the answer** — or better yet, just try both and compare the output yourself.

---

*This comparison was assembled by Claude Opus 4.5 on GitHub Copilot. Yes, that's another Claude model — so take this document's framing with the same grain of salt.*
