# 0029. Referrals: a free trip pass for bringing a friend who pays

- Status: Accepted (part of the gap plan the owner approved on 2026-11-26)
- Date: 2026-11-27

## Context
Travel is planned with and talked about among friends, and the trip pass (ADR-0023) is a natural reward: it costs Globetrot nothing until it is used, and it is worth something real to the person who earns it. Rewarding sign-ups alone invites fake accounts; rewarding a first payment does not.

## Decision
- **One code per account** (`referral_code`), eight letters and digits from random bits, made the first time the person opens their plan page. Their link is the site with `?ref={code}`.
- **Keeping the code:** a visit through a link keeps only the code in a first-party cookie for 30 days (`globetrot.ref`); the first signed-in page hands it to the new account and forgets it.
- **Claiming:** an account can name who sent it once, within 7 days of signing up, never itself (`referral`). An unknown code changes nothing and does not say whether codes exist.
- **Reward:** the friend's first payment (an active subscription or a trip pass, from the payment webhook) marks the referral rewarded and gives the referrer one free trip pass credit (`pass_credit`, unique per referred account), once.
- **Using it:** on any of their own trips, from the trip's pass card ("Use my free pass"); it becomes a trip pass like a bought one, with the same validity.
- Audit records claims, rewards and use with no personal values.

## Alternatives considered
- **Credits or discounts:** a discount needs Stripe coupons and reduces revenue on the friend's side; a pass rewards the person who spread the word.
- **Rewarding sign-ups:** easy to game.

## Consequences
- The plan page shows the link and how many friends joined and how many free passes are left.
- A referred person who never pays never triggers a reward.
