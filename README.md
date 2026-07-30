# You've Already Lived Through It

An interactive narrative visualization about extreme temperature days, built
with D3.

| | |
|---|---|
| **Student** | Jonathon Green |
| **Course** | CS 416, Data Visualization |
| **Term** | Summer 2026 |
| **Instructor** | John Hart |
| **Assignment** | Final Project, Narrative Visualization |
| **Live site** | https://jgreen01.github.io/climate-you-lived-through-it/ |
| **Repository** | https://github.com/jgreen01/climate-you-lived-through-it |

The essay answering the seven required questions begins at
[Essay](#essay) below.

**Libraries.** D3 v7 only, plus the two permitted additions, d3-annotation and
topoJSON Client. All three are vendored under `js/lib/`. No other library,
framework, or high-level visualization tool is used.

The site opens with a short written introduction, then an interactive world
map. Every dot on that map is one of 166 real cities. Pick yours (or start with
the featured city) and follow a short, personalized story: how many extreme
days your city already gained since the 1980s, how many more are locked in for
the next twenty years, and how far the two possible 2080s diverge depending on
the emissions path the world takes.

**Data.** Historical counts (1980 to 2024) are *measured*, from the Open-Meteo
Historical Archive (daily maximum and minimum temperatures per city, averaged
over the 1980s and over 2015 to 2024). Future counts are *modeled*, from the
World Bank Climate Change Knowledge Portal (CMIP6, 0.25 degree, median
ensemble), for a moderate path (SSP2-4.5) and a high-emissions path (SSP5-8.5),
delta-method bias-corrected against the model's own recent baseline. Four
metrics are available: hot days (at or above 30C), hot nights (at or above
26C), dangerous heat (at or above 40C), and freezing days (below 0C).

**Running locally.** The site is fully static, no build step. `make serve`
starts a local webserver; `make test` runs the Playwright suite. `make data`
and `bake_grid.py` regenerate the baked JSON from the source APIs.

---

# Essay

## Messaging

**Climate change is not only a distant, abstract threat. The rise in extreme
days is something you have already lived through in your own city, more of it
is already locked in no matter what we do, and the size of the damage after
that is still a choice.**

The message is carried in a unit anyone can picture, the number of extreme days
in an average year, rather than degrees of global average warming. A figure
like "1.5C above pre-industrial" is precise but meaningless to most people; it
takes training to feel anything from it. The goal of this piece is to make
climate change feel real and concrete, not an abstraction that only scientists
and engineers can interpret, so the data is put in terms of something everyone
already understands: a year, and how many of its days cross a line. Miami
already went from 38.1 hot days a year in the 1980s to 91.2 today. Chicago is
committed to roughly doubling its hot days again by 2045, from 20 to 40,
whatever is decided now. And by the 2080s Chicago's two possible futures stand
31 days apart, 85 against 54, which is the part still open to us.

## Narrative Structure

A **drill-down story**. A short written introduction opens it, stating the
message and naming the four metrics, giving the reader a reason to care and
enough curiosity about their own city to want to look it up. From there, the
map is one overview holding 166 cities. The reader picks one, and that single
choice determines the whole four-scene story that follows.

The city dropdown on the story scenes lets the reader jump to a different city
without returning to the map, a convenience for exploring and comparing cities
more quickly rather than a second drill-down. The reader can also switch among
the four metrics at any time: hot days, hot nights, dangerous heat, and
freezing days. Together, the city and metric selections let the reader explore
different climates and kinds of extreme days in a free-form way, comparing the
different time ranges on the story scenes or the whole century at once on the
closing line chart.

## Visual Structure

**The visual structure of each scene.** Every scene shares one template: title,
one-line subtitle, metric buttons, the chart in a bordered box, a navigation
row, and a fixed footnote separating measured years from modeled ones. Holding
that constant means the chart is the only thing that changes, which lets the
eye compare scenes instead of relearning the page. Three forms fill that box:
the world map on scene 0, a pair of **waffle years** side by side on scenes 1
to 3, and the century line chart on scene 4.

**How it makes the data understandable.** The three forms are matched to their
jobs using Cleveland and McGill's ordering of elementary perceptual tasks,
which ranks position along a common scale most accurate and shading least. The
map encodes magnitude as shading, the weakest rank, so it is used only to
locate a city and read the broad pattern, never to extract a value, which is
itself the argument for drilling down. The line chart sits at the opposite end,
encoding its values as position along a common scale, which is why it suits the
final synthesis.

The waffle year carries the middle three scenes, and because it is not a
standard chart type it needs the most justification. It is the form that serves
the goal behind the whole piece: a chart someone with no training and no
particular level of education could read. A year is 365 days, and everyone
already owns that denominator, so filling in the days that cross a threshold
needs no explaining. That fixed ceiling is also what makes the difference felt
rather than merely read. Across a pair of waffles the reader watches the
colored days advance while the ordinary ones give way, both happening inside
the same 365 that cannot grow, and it is seeing how little grey is left that
carries the urgency.

The waffle gives more than one route to the same quantity. The block of color
is an area judgment, which the ordering places mid-pack, but every waffle is
the same 365-cell grid, so the boundary where color turns to grey also falls at
a comparable position within a fixed frame, a far more accurate task. Each
column is three seven-day bands, grouped in threes, so the grid carries its own
ruler: Miami's 91 hot days are not "about a quarter of the year" but thirteen
countable weeks. A viewer who only glances gets the area impression, one who
looks carefully gets the position and the count, and the printed figure removes
any remaining ambiguity.

**How it makes the scene navigable.** Nothing moves, so no instructions are
needed. Controls hold their position from scene to scene, Back and Next name
their destination ("See the 2080 fork"), breadcrumb dots mark position in the
sequence, and each scene fits one screen, since a comparison the reader has to
scroll between is not really a comparison.

**How it directs attention.** Each scene has one figure to carry, and the
template makes it hard to miss: threshold days in saturated accent color
against inert grey, the day count printed beside each block, the selected city
drawn larger than its neighbours, and on the line chart the wedge between the
two futures shaded so "the choice" becomes a visible area. Color reinforces
this on the map, where a sequential magma ramp carries magnitude through
lightness rather than hue. That keeps it readable for colorblind viewers, and
lightness reads poorly for exact quantities but well for the ordinal question
the map actually asks, whether one region is worse off than another.

**How the scenes connect.** The scenes hand off by construction rather than by
transition effect. "Now" is the right-hand waffle of scene 1 and the left-hand
waffle of scene 2, so the panel just read becomes the baseline of the next
question and visibly carries the argument from measured past into committed
future. The closing line chart then replots every quantity the waffle scenes
established onto one axis, so the reader meets those values a second time as a
single shape.

## Scenes

A short written introduction precedes five scenes, ordered to build the
argument.

0. **"Now find your city."** The map: the overview and entry point,
   establishing the global pattern before any argument is made.
1. **"You've already lived through it."** The 1980s against the most recent
   decade, both measured. First, because proving the change is already real is
   the strongest opening.
2. **"The next 20 years are already decided."** Now against roughly 2045, so
   that having accepted the past, the viewer sees the near future is already
   committed.
3. **"Two futures: the gap is the choice."** The low-emissions 2080s against
   the high-emissions 2080s. The logical center: the far future splits, and the
   distance between outcomes is the point.
4. **"The century ahead, and the fork in it."** One chart carrying the shared
   past forward and forking into both futures, shaded between. Last, because it
   synthesizes the three earlier comparisons into one image.

The order runs measured past, committed near future, undecided far future,
synthesis. A scene is defined by the time spans it compares, not by which
extreme day is counted, so changing the city or the metric refills these same
five scenes with different numbers and never changes the sequence.

## Annotations

**The template, and why.** One template throughout: **a bold headline figure
with a short descriptor, anchored to the mark it labels and always visible,
never waiting for a mouseover.** Each scene turns on a single number, and the
template exists to make that number impossible to miss without requiring the
reader to hover, click, or know to look. On a waffle it is the day count ("20
days") in the metric's accent color, with the era named beneath it. On the line
chart it is both endpoint labels ("If we don't act: 85 days / high emissions"
and "If we act: 54 days / low emissions") in each fork's color, plus the shaded
wedge between them, a second annotation that is non-textual: it calls out the
gap by drawing it.

**How they support the messaging.** Each callout carries one beat of the
message. In scene 1 the pair of counts is the evidence that the change has
already happened, which is why both numbers are measured and labeled with their
decades. In scene 2 the 2045 figure is the locked-in claim, and its descriptor
says so in words ("already locked in, regardless of policy") so the number
cannot be mistaken for a prediction that policy could still avert. In scene 3
the two counts are the choice, and their labels name it as one ("If we act",
"If we don't"); scene 4 restates that gap as the shaded wedge. Read the bold
figures alone, in order, and the argument still holds: for Chicago's hot days,
14 then 20, 20 then 40, 54 against 85.

**Whether they change within a scene.** They change by parameter rather than by
time. Switching city or metric recomputes every callout, so the annotations
always describe the current subject rather than a remembered one; nothing
changes on a timer or on scroll. The map's hover tooltip is treated as
free-form exploration rather than annotation, which is why the load-bearing
annotations never depend on a mouseover.

## Parameters

- **`scene`** (0 to 4): which scene shows. Selects the render function and the
  navigation labels.
- **`city`**: which of the 166 cities the story is about, carried across every
  scene.
- **`metric`**: which extreme day is counted (hot days, hot nights, dangerous
  heat, freezing days). Re-tells the story at a different threshold and changes
  the accent color.
- **`baseline`**: on the map only, whether change is measured since the 1980s
  or since today.

A state is one combination of these four values and nothing else is
remembered, so the five scenes, 166 cities, four metrics and two map baselines
enumerate every view the piece can show. The reader arrives in the opening
state, scene 0 with Chicago as the featured city, hot days as the metric, and
map change measured since today. One render step reads all four and
rebuilds the scene: it clears the chart, sets the title and navigation from
`scene`, then calls that scene's draw function, which reads `city` and `metric`
(and `baseline` on the map). Every scene is a pure function of these values, so
a trigger only has to change a parameter and request a re-render.

## Triggers

- **Back and Next** change `scene` by one, labeled with their destination; Next
  loops back to the map on the last scene.
- **Breadcrumb dots** set `scene` directly, each with a hover label, the
  current one highlighted.
- **Arrow keys** change `scene`, a keyboard equivalent.
- **Clicking a city dot** sets `city` and enters its first story scene, the
  core drill-down move.
- **The city dropdown** sets `city` on any non-map scene.
- **The metric buttons** set `metric`, the active one visibly selected.
- **The "Change since" toggle** sets `baseline`, the active option a filled
  pill.
- **Hovering the map** is the free-form trigger: over a dot, a tooltip with the
  city's name and projected change; anywhere, magnification of the area beneath
  the cursor.

Free-form exploration is concentrated on the map on purpose. Scene 0 is where
the reader's task is choosing, so hovering is rewarded there: a fisheye spreads
the city dots apart so one can be picked out of a dense cluster like Europe or
Southeast Asia, and a circular lens magnifies the terrain beneath the cursor.
Neither changes any parameter; both exist so the drill-down trigger stays
usable on a crowded map. The story scenes carry at most a plain hover tooltip
on a waffle cell and otherwise hold still, leaving the always-visible
annotations to make the argument. Exploration therefore feeds the drill-down
rather than competing with it: it helps the reader pick a storyline, and then
it gets out of the way.

Affordances keep every option visible without instructions, so the reader never
has to work out what is clickable. Back and Next are labeled with their
destination rather than a bare direction; the active metric and the active map
baseline are drawn in a selected state, so the current parameter values are
never ambiguous; Back is visibly disabled on the first scene, marking the start
of the sequence; each breadcrumb dot carries a hover label naming its scene;
the city dots take a pointer cursor and grow under the fisheye, advertising
that they respond; and the introduction ends in a "Find your city" button that
delivers the reader to the map.

## Reference

Cleveland, W. S., and McGill, R. (1984). "Graphical Perception: Theory,
Experimentation, and Application to the Development of Graphical Methods."
*Journal of the American Statistical Association*, 79(387), 531-554.
