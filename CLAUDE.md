# create-barako-app

Generates a Next.js project on the barakoCMS stack. The README is the usage guide; this file is the
working agreement for anyone changing code here, person or agent.

## How work is done here

This repository follows the [lean agent](https://github.com/arnelirobles/lean-agent).

- Search open issues before filing. If one covers the area, add to its Covers list instead.
- One ticket is one agent pass, written agent-ready: Goal, Where, Covers, Done when, Risks,
  Constraints, Out of scope.
- Scripts, not instructions: the CI workflow generates a project, brings the stack up and seeds it,
  which is the check; run its steps rather than the one you have in mind. Anything reasoned through
  twice becomes a script.
- A bug fix ships with a test that failed before the fix.
- Every change gets an adversarial review by a separate agent, and findings go back to the agent
  that wrote the change.
- After a batch merges, run the retro and propose method changes with evidence.
