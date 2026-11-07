# Usability study 01: prototype evaluation

**Status: protocol prepared; no sessions conducted and no findings yet.** Issue #8 remains open. Do not report the acceptance thresholds as met until five eligible people complete the study and results are synthesized.

## Research questions and decision

Can people who rarely travel internationally understand how to build a three-stop trip, interpret the budget answer, and review a Pip change list on desktop and phone? Use findings to prioritize changes to the board, budget and proposal flow before production UI work. The study tests the reference prototype, not the reliability of the eventual app, real pricing, live AI or real bookings.

## Participants and setup

- Recruit five adults who rarely travel internationally; include both English and pt-BR speakers. Record the actual language mix, device and relevant experience without names. Do not substitute agents or project team members for the five participants.
- One moderated session per person, approximately 35–45 minutes. Use a participant's own phone when practical; otherwise use an actual phone with touch, plus a desktop or laptop. Record device and browser. Do not present desktop emulation as a phone test.
- Use a freshly reset instance of [the prototype](../../../design/reference/claude-design-v1/Globetrot%20-%20App.html), served via HTTP as described in [the reference README](../../../design/reference/claude-design-v1/README.md). Record the tested commit, viewport and any setup deviations. Prototype data is local and simulated; never enter real financial, account or travel information.
- The prototype's copy is English. For pt-BR sessions, the moderator can provide a neutral translation of task prompts and, on request, read interface text aloud in Portuguese without explaining controls. Log each translation request and any resulting help separately. These sessions cannot establish that a future pt-BR UI fits or is understandable; that requires a localized build.
- Ask for informed permission before taking notes or recording. Recording is optional; do not collect names, account details, passport details or exact home addresses in the results. Store recordings separately with restricted access and a defined deletion date agreed with the participant. Do not commit recordings or identifying notes to Git.

## Moderator script

1. Say: “We are testing the design, not you. Some information here is simulated. Please think aloud; you can stop or skip a question at any time.”
2. Ask when they last planned an international trip, what device they normally use, and which language they prefer. Avoid coaching.
3. Start from the same reset state. Ask the tasks below in order. Let the participant work without hints. After a sustained impasse, offer one neutral prompt (“What would you try next?”); if a specific instruction is needed, record the first intervention and continue without counting the task as unaided.
4. After the desktop tasks, repeat the relevant interaction on a phone with a reset instance. Do not count a repeated or coached phone attempt as a new participant or as the first-attempt primary outcome.
5. Close with: “What was confusing? What would you expect to happen next? What would you change?” Do not defend the design.

### Tasks and observation

| Task prompt (translate neutrally for pt-BR) | Observe without coaching | Primary measure |
|---|---|---|
| “Imagine you want to plan a trip with three stops. Start a trip and arrange the places in the order you want.” | Can they find the starting path, add/select three distinct stops, see the route and reorder a stop? Note whether they use the map or a list. | **Unaided three-stop success:** starts a trip, reaches three distinct stops and demonstrates their intended order without a task-specific hint. If the prototype cannot support a step, record blocked and explain; do not count it as success. |
| “Find the estimated cost for one stop. What does the mark beside the amount mean?” | Record route, interpretation of estimated vs confirmed/paid and any confusion about simulated values. | Correctness and problems, descriptive only. |
| “Find out when you could afford the trip. In your own words, what does this answer mean?” | Record their explanation before asking follow-up questions; ask what the monthly saving amount and departure date mean if they were not mentioned. | **Answer comprehension:** correctly explains the projected readiness date and that it depends on the stated monthly saving rate; identifies a late result as after departure when shown. Do not require exact wording. |
| “Ask Pip for a suggestion, inspect it and decide which changes, if any, to apply.” | Can they distinguish proposal from applied changes, inspect/uncheck items and understand the effect before applying? | Descriptive only: record actions, explanations and any mistaken belief that a booking or price is real. |
| “On the phone, find the board, add or select a stop, then find the budget and return to the board.” | Observe touch targets, map/list alternative, bottom sheet and navigation; record the actual device. | Descriptive only; mark blocked if the phone or a required interaction is unavailable. |

For the two threshold outcomes, record **pass**, **fail**, or **blocked** per participant, and note first help and reason. A blocked case is not a pass; do not replace it with an easier task after seeing results. The study meets a threshold only when at least 4 of the five eligible participants independently pass. Report blocked cases explicitly and rerun or revise the study if the prototype prevents a fair test.

## Session record template

Use participant codes P01–P05 only. Keep raw notes outside the repository until anonymized.

| ID | Language | Desktop / real phone | Three-stop (pass/fail/blocked) | Budget explanation (pass/fail/blocked) | First help / issue | Notable quote, anonymized |
|---|---|---|---|---|---|---|
| P01 | — | — | Not run | Not run | — | — |
| P02 | — | — | Not run | Not run | — | — |
| P03 | — | — | Not run | Not run | — | — |
| P04 | — | — | Not run | Not run | — | — |
| P05 | — | — | Not run | Not run | — | — |

## Synthesis after five sessions

- Report passes, failures and blocked counts for each primary outcome as `n/5`, including the actual language and device mix and any moderator translation. State whether each 4/5 threshold was met.
- Group observed problems by behavior, not by participant opinion alone. List up to the five highest-priority issues with evidence (participant codes and observed task), frequency, severity and a proposed change. Explicitly label hypotheses and disagreements.
- Prioritize blocked core tasks and misleading estimates or proposal behavior ahead of cosmetic friction. Do not extrapolate a five-person qualitative study to a population.
- Record prototype limitations, protocol deviations and any untested condition. Link follow-up work after it exists. Keep findings marked **not yet collected** until the sessions actually happen.

## Current findings

No participant sessions have been conducted. Thresholds, issue rankings and recommendations based on participant behavior are therefore **not yet available**.
