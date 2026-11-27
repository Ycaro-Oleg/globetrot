# 0030. Miles in the savings answer

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26; the value ranges are the owner's to review)
- Date: 2026-11-27

## Context
Many Brazilian travellers pay part of a trip with loyalty miles (Smiles, LATAM Pass, Azul, and the banks' Livelo and Esfera), and the savings answer ignored them: "you can go in July" was wrong for someone sitting on 100 000 miles. Miles have no fixed price; what they buy depends on the route, the date and the programme.

## Decision
- **Balances per programme** (`miles_balance`) for Smiles, LATAM Pass, Azul Fidelidade, Livelo and Esfera, whole miles, a zero balance not kept.
- **A typical value range** in reais per thousand miles per programme (`MILES_VALUES`), researched on 2026-11-26 from MilhasBot (Sep 2026), Viagem Black (Apr 2026) and Cartão e Milhas: Smiles R$16–22, LATAM Pass R$23–28, Azul R$13–17, Livelo R$23–30, Esfera R$22–33. Always shown with the date and sources, as an estimate.
- **Putting miles towards a trip** (`trip_miles`): the person chooses how many of each programme go to a trip, never more than the balance. Removing a balance removes it from trips.
- **The answer with miles:** the middle of the range, converted into the trip's currency at the recorded reference rates (ADR-0020), comes off what is left to save (the person's own part on a shared trip, the trip's otherwise), giving "counting 60 000 miles (about R$1.140), R$4.860 is left: you have it by April 2027". A trip in a currency without a reference rate shows the balances without the answer.
- The card is folded for people without miles, and never assumes a person is Brazilian.

## Alternatives considered
- **Live miles prices from a provider:** no reliable public API; a researched range is honest and enough for planning.
- **Booking with miles inside Globetrot:** out of scope; the product never books.

## Consequences
- The ranges must be reviewed now and then (owner-dependent, like the suggested-plan costs).
- Miles are personal: members of a shared trip each put their own.
