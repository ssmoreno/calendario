# SS design

SS is a monochrome personal instrument. It uses a black canvas, white information, measured borders, and physical readouts instead of conventional dashboard cards. Geist Sans carries interface copy and Geist Mono is reserved for time, duration, status, and keyboard metadata.

The authenticated home has two regions. Today dominates the left side with a live countdown, the next event, a timezone-aware day timeline, and the remaining event rows. The next event is the only inverted row. Selecting any row opens its full Google Calendar details without changing the schedule layout.

Future days form a narrow rail on the right. Each day is one compact row with an event count, and only one day expands at a time. This keeps the next two weeks available without giving every event equal visual weight. Today shows at most five rows before naming what remains, and an expanded future day shows at most five events for the same reason.

The Agent replaces the future rail. Opening it widens that region from 336 to 442 pixels while the today instrument remains visible. The panel stays mounted when closed so a running turn can finish, and the global Ask SS control indicates that work. The transcript supports streaming text, approvals, clarification prompts, cancellation, and conversation reset. On narrow screens it becomes a bottom sheet over the day instead.

The palette is grayscale in both appearance modes. Dark is the default and the signature Machined expression. Light mode keeps the same hierarchy by inverting the material system rather than introducing color. Calendar color categories remain functional preferences, but render as distinct grayscale values.

The same squared SS mark, control geometry, monochrome surfaces, and type system carry through login and settings. Focus rings use the current foreground color, reduced-motion preferences suppress transitions, and every essential state is conveyed by copy or shape rather than color alone.

At 820 pixels and below, the calendar becomes a vertical document: today first, then future days. At 560 pixels, the hero stacks, event metadata tightens, and secondary header status yields to the two primary controls. The page may scroll vertically, but it must never scroll horizontally.

Calendar and Library are peer views selected from the squared control beside the SS mark; the active view is the only inverted segment. Library presents saved links as a card catalog: four labelled drawer fronts show category counts, one drawer opens at a time, and its ruled index cards reveal anchored details without leaving the view. The same shell and summoned Agent persist while moving between views.
