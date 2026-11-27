# 0025. Money between the people planning a trip

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26)
- Date: 2026-11-27

## Context
With trip members (ADR-0024) the next question a group asks is about money: how much is my part, am I on track to have it, and who owes whom after someone paid the hotel. The trip's savings (`trip_savings`) belong to the trip as a whole; they cannot say who set what aside.

## Decision
- **Parts:** the trip's total (the same total the budget shows) is split equally between the owner and the members, or in custom parts in basis points that add up to 10 000, set by the owner. The leftover minor units of a division go to the first people, so parts always add up to the total exactly (`memberShares`).
- **Each person's savings:** `trip_person_money` keeps each person's set-aside and monthly amounts (and their custom part) in the trip's currency. Anyone on the trip may change their own; the answer is "you have your part by {month}" at their monthly amount.
- **Who paid:** a cost may name who paid it (`expense.paid_by`, the owner or a member; it becomes null if that person's account is deleted).
- **Settling up:** only costs marked paid count, never the rough guess. Each person's balance is what they paid minus their part of what was paid; the largest debt is paired with the largest credit until everyone is even (`settleUp`), which needs at most one payment fewer than the people. Paid costs nobody is named on stay out, and the screen says how much.
- The money card shows on the Money screen only when someone else plans the trip; a solo trip looks as before. Progress is shown in words and bars, never colour alone.

## Alternatives considered
- **Splitting each cost separately (who was in on each dinner):** more exact, much more to enter; the trip-level parts cover the common case.
- **Per-person budgets instead of parts:** loses the single total the group plans against.

## Consequences
- Moving money between people is outside Globetrot: the settling says who pays whom; paying happens elsewhere.
- Parts are re-read on every request, so adding or removing a member changes everyone's part at once.
