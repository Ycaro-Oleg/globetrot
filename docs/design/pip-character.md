# Pip character brief and Rive handoff

**Status: draft for product-owner approval.** This is a commissioning brief and a proposed engineering contract, not a signed agreement or an approved asset. Issue #9 remains open until the owner approves it and the final asset/contract are verified.

## The avatar in the app today

At the owner's request, Pip appears in the app as an [open-bot-avatar](https://github.com/DominikScholz/open-bot-avatar) (MIT, no dependencies, pinned to an exact version in `apps/web`): a round globe body with two eyes, in airmail blue with cream eyes, which the runtime animates (volume, blinking, moods, gaze). The definition and the component are `PIP_AVATAR` and `PipAvatar` in `apps/web/app/app/_components/pip-avatar.tsx`.

- **The look (the handoff v2 "Meu Pip").** Each person dresses their own Pip: `hat` (straw, helmet, cap, none), `outfit` (scarf, floral shirt, explorer vest, none), `bag` (trolley, backpack, vintage) and `bagColor` (amber, cyan, pink). The options and the default (straw hat, no outfit, amber trolley) live in `@globetrot/domain` (`PIP_HATS`, `DEFAULT_PIP_LOOK`, `toPipLook`); the artwork comes from the handoff's `Pip.dc.html`. The look is drawn in two SVG layers around the live avatar (bag behind, outfit and hat in front) and moves with it every frame: the bag with the body's motion, the outfit and hat with the face, so they tilt, hop and turn together. Below 40 px the bag is left out. The look and a name are stored in the preferences and edited on the profile ("My Pip", `/app/profile`); every `PipAvatar` reads the saved look from `PipLookProvider` in the signed-in shell unless it is given one.
- **Where:** the visa celebration on the board (mood `happy`), the Pip page (follows the pointer), and the "Ask Pip" button, floating button and More entry (still frames).
- **Behaviour:** the server renders a still frame; the browser mounts the live avatar over it. Reduced motion (the app's Motion setting or the system's) keeps it calm. It is always decorative (`aria-hidden`): the text next to it carries the meaning.
- **Moods map to the brief's states** for now: `idle` for idle, `thinking` for research and draft, `happy` for deliver and celebrate. The six commissioned Rive poses below remain the plan for the final art; whether they replace this avatar is the owner's decision (#9).

## The character

Pip is Globetrot's optional travel-planning companion: a friendly little globe with a tourist hat and suitcase. Pip should feel curious, capable and reassuring, with expressive eyes and a simple silhouette legible at small sizes. The reference in [the handoff](../../design/reference/claude-design-v1/README.md#pip-ai-companion) and [placeholder poses](../../design/reference/claude-design-v1/atlas/pip.js) establish the visual direction; the SVG is a placeholder, not final art.

The round globe is airmail blue with mint land shapes, dark ink outlines, a stamp-red hat and a marigold suitcase. The case may have small travel-sticker details. Keep the face and hat recognizable when props are simplified. Use rounded, outlined shapes and a solid, graphic look consistent with the existing design; avoid photorealism, gradients that obscure the face, or country-specific identity cues. Do not put words, letters, flags, logos, prices, official-looking visas or culturally specific travel requirements in the artwork.

### Palette

Values below are the initial brand primitives; the approved design tokens remain authoritative when finalized. Provide versions that read on both cream and dark surfaces without relying on a background baked into the asset.

| Role | Token / color |
|---|---|
| Globe | Airmail blue `#2B45C4` |
| Land | Mint `#9AD8BF` (fill, never text) |
| Hat and small accents | Stamp red `#E0401F` |
| Suitcase / stamp | Marigold `#F5B31C` |
| Outline / eyes | Ink `#1D1A35` |
| Paper prop | Cream `#FFF5E1` or white `#FFFFFF` |
| Map prop | Note `#FFE08A` |

## Required poses

All six states must have a clearly identifiable still frame and an animation. Props are visual cues, never confirmation that a real-world action occurred.

| State and exact input name | Direction | Loop / exit |
|---|---|---|
| `idle` | Gentle bob, look, blink and optional hat tip; suitcase nearby. | Subtle loop; interruptible. |
| `research` | Unfold and inspect a map. Curious and attentive. | Subtle loop; interruptible. |
| `draft` | Arrange or fan postcards to suggest a proposal in progress. | Subtle loop; interruptible. |
| `deliver` | Ride a paper plane to present a draft. | Short entrance, then a stable hold; interruptible. |
| `celebrate` | Raise a stamp with restrained confetti. | Short entrance, then a stable hold; interruptible. |
| `unsure` | Map and questioning expression; supportive, not alarming. | Subtle loop or stable hold; interruptible. |

Use the prototype's idle hop of approximately 2.8 seconds as a pacing reference, not a rigid timing requirement. Avoid flashing, rapid oscillation and motion needed to understand the state. Confetti must remain inside the artboard's safe area and must not obscure neighboring controls.

## Proposed state-machine contract

The handoff requires the six exact input names above but does not specify input types. The following is the proposed implementation contract to validate with the illustrator and engineering before production:

- One artboard named `Pip`, one state machine named `PipStateMachine`.
- Six **Boolean** inputs named exactly `idle`, `research`, `draft`, `deliver`, `celebrate`, `unsure`. Exactly one is true at a time. Initial state: `idle=true`, others false.
- The host sets the previous input false and the next input true together before advancing the machine. The machine must allow any state to transition to any other state without waiting for a loop or entrance animation to finish. If inputs are invalid, the host resets to idle; the artwork should not produce an irreversible transition.
- `deliver` and `celebrate` animate once on entry and hold their recognizable final pose while their input remains true. Re-entering after a different state replays the entrance; leaving immediately interrupts it. Other states loop gently or hold as described.
- The host owns the mapping from application status to pose, lifecycle, timing, announcements and retry logic. Animation itself must not apply changes, signal a successful booking, initiate network calls, display generated claims or make product decisions.
- Validate names, Boolean input types, initial state, all 30 directed state changes, interruption and re-entry against the exported `.riv` in the actual web runtime. Do not infer a successful export from the editor preview.

If the Rive runtime cannot apply a one-hot update without an intermediate frame, engineering and the illustrator must agree on an equivalent atomic adapter or a revised input contract before implementation; do not silently rename inputs.

## Sizes, motion and accessibility

- Export vector art that works from a **24 px** button glyph through a **190 px** celebration; also inspect at 32, 48, 96 and 150 px on both themes. At 24 px prioritize the face and hat; do not rely on tiny map lines, stickers or facial details.
- Keep the artboard stable across states, including the plane and confetti, to avoid layout shifts. Supply transparent backgrounds and a generous safe area for props.
- Supply a static SVG fallback for each state, matching the final Rive composition. When either the operating system requests reduced motion **or** the in-app Motion preference is Reduced, the host uses the corresponding static pose and does not autoplay the Rive animation.
- Pip is decorative when adjacent text already describes the status: mark the rendered asset hidden from assistive technology. Status announcements come from localized UI text in a polite live region; the existing celebration pattern uses an assertive announcement where appropriate. No meaning may depend solely on animation, facial expression or color.
- No user-facing text in the art. UI copy is localized independently in en and pt-BR.

## Deliverables and acceptance

1. Editable Rive source and exported `.riv`, with the artboard, state machine and inputs above; list editor/runtime versions and any runtime or feature dependencies.
2. Six transparent static SVG fallback poses and a contact sheet showing all poses at 24, 48, 96 and 190 px on cream and dark backgrounds.
3. Asset inventory with dimensions, color values, font use (prefer none), external materials, license and attribution requirements; include any editable source artwork.
4. Optimized exported `.riv` **under 150 KB**, measured as the actual file's bytes before compression. If the budget cannot be met, flag it for a product/engineering decision; do not silently degrade accessibility or remove a state.
5. Engineering validation: load on web and a representative mobile device, exercise every transition and reduced-motion fallback, inspect clipping at each size and confirm no layout shift. Check the asset renders in light and dark without an opaque background.
6. Owner approves the visual character, the six poses and final deliverables before the issue is closed.

## Commissioning and rights to agree

The following are requirements to negotiate, not terms already agreed: worldwide, perpetual rights for Globetrot to use, reproduce, modify, animate, distribute and sublicense the character and deliverables in the product, marketing and future formats; access to editable sources; explicit treatment of exclusivity, attribution, third-party assets, fonts and any AI-assisted material; and a written warranty that the illustrator has authority to grant those rights. The owner and illustrator must agree on compensation, milestones, revisions, delivery dates, ownership or license structure, and cancellation terms in a signed contract.

## References

- [Prototype handoff and pose descriptions](../../design/reference/claude-design-v1/README.md#pip-ai-companion)
- [Prototype Pip SVG](../../design/reference/claude-design-v1/atlas/pip.js)
- [Design system and motion](design-system.md)
- [AI business rules](../product/business-rules.md#ai-pip)
- [AI provider ADR](../architecture/adr/0007-ai-provider-abstraction.md)
