# You've Already Lived Through It

An interactive narrative visualization about extreme temperature days, built
with D3.

**Live site:** https://jgreen01.github.io/climate-you-lived-through-it/

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

Most climate visualizations show a global average line climbing across a
century, which is easy to hold at arm's length. This one reframes the same
science in a unit a person can picture: the number of extreme days in an
average year. Miami averaged 38.1 hot days a year in the 1980s and 91.2 today,
more than double, an increase no single year announced, because year-to-year
variability hides a trend that a decade-scale comparison states plainly.
Looking forward, Chicago's 2080s fork is about 31 hot days wide (85 under high
emissions against 54 under low), close to an extra month of summer.

The four metrics build outward from personal experience to global consequence.
Hot days and hot nights are ones anyone can relate to; Panama City rises from 7
hot nights a year today to a projected 362. Freezing days counter the
assumption that warming is only a story about hot places: Potosí, Bolivia falls
from 145.8 freezing days in the 1980s to about 16, or to zero, depending on the
path taken. Dangerous heat, at or above 40C, asks whether some places stay
livable as they are lived in today: Laredo goes from 5.9 such days a year to a
projected 101, and Dubai from 68.4 to about 172.

## Narrative Structure

A **drill-down story**, preceded by a short linear introduction. The
introduction is a non-interactive written article stating the message and
previewing the four metrics, so the message reaches every reader before
exploration begins, in the spirit of a martini glass's stem. After it, the map
is the overview: clicking a city dot descends into that city's fixed four-scene
story.

The map is deliberately the first scene, not a reward at the end, because a
drill-down gives an overview and lets the user choose where to descend. One
fair objection is that the city dropdown and metric buttons appear on every
scene, which resembles an interactive slideshow. What keeps it a drill-down is
that scene 0 is not a step in any city's story but a global overview across 166
cities, categorically different from scenes 1 to 4, which always follow one
city in a fixed order. Choosing a city is the drill; the dropdown and
breadcrumbs are a convenience layer on that backbone.

## Visual Structure

**The structure of each scene.** Every scene shares one template: title,
one-line subtitle, metric buttons, the chart in a bordered box, a navigation
row, and a fixed footnote separating measured years from modeled ones. Holding
that constant means the chart is the only thing that changes, which lets the
eye compare scenes instead of relearning the page. Only three forms ever fill
the box: the world map, the **waffle year**, and the century line chart.

**How it makes the data understandable and the scene navigable.** The three
forms are matched to their jobs using Cleveland and McGill's ordering of
elementary perceptual tasks, which ranks position along a common scale most
accurate and shading least. The map encodes magnitude as shading, the weakest
rank, so it is used only to locate a city and read the broad pattern, never to
extract a value, which is itself the argument for drilling down. The closing
line chart sits at the opposite end, encoding its values as position along a
common scale, which is why it suits the final synthesis.

The waffle year carries the middle three scenes, and because it is not a
standard chart type it needs the most justification. Most climate communication
is pitched at people who already know how to read it: anomaly curves against a
pre-industrial baseline, concentrations in parts per million, warming as a
global average. Each asks the reader to hold an abstraction before the number
means anything, which quietly excludes most people. I wanted a chart that
someone with no training and no particular level of education could read, one a
child could make sense of unaided. A year is 365 days, and everyone already
owns that denominator. Filling in the days that cross a threshold, and printing
the count beside them, turns a statistical abstraction into a tangible amount
of lived experience.

Accessibility here does not cost accuracy, because the waffle offers more than
one perceptual route to the same quantity. Read as a shape, the growing colored
block is an area judgment, which the ordering places mid-pack. But because
every waffle is the same 365-cell grid, the boundary where color turns to grey
falls at a comparable position within a fixed frame, a far more accurate task,
and the two waffles sit side by side so the comparison happens in one frame
rather than against a remembered one. The cells are structured rather than
poured into a block: each column is three seven-day bands, grouped in threes,
so the grid carries its own ruler. Miami's 91 hot days are not "about a quarter
of the year" but thirteen countable weeks. A viewer who only glances gets the
area impression; one who looks carefully gets the position and the count; the
printed figure removes any remaining ambiguity. (Cells are drawn as lenses
rather than squares so the pale gaps never run straight, which would otherwise
produce the Hermann grid illusion in a lattice this dense.)

Navigation needs no instructions because nothing moves: controls hold their
position from scene to scene, Back and Next name their destination ("See the
2080 fork"), breadcrumb dots mark position in the sequence, and each scene fits
one screen, since a comparison the reader has to scroll between is not really a
comparison.

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

0. **The map ("Now find your city").** The overview and entry point,
   establishing the global pattern before any argument is made.
1. **Then and now.** The 1980s against the most recent decade, both measured.
   First, because proving the change is already real is the strongest opening.
2. **The locked-in future.** Now against roughly 2045, so that having accepted
   the past, the viewer sees the near future is already committed.
3. **The fork.** The moderate against the high-emissions 2080s. The logical
   center: the far future splits, and the distance between outcomes is the
   point.
4. **The century line.** One chart carrying the shared past forward and forking
   into both futures, shaded between. Last, because it synthesizes the three
   earlier comparisons into one image.

The order runs measured past, committed near future, undecided far future,
synthesis.

## Annotations

One template throughout: **a bold headline figure with a short descriptor,
anchored to the mark it labels and always visible, never waiting for a
mouseover.** On each waffle it is the day count ("20 days") in the metric's
accent color with the era named beneath. On the line chart it names both endpoints ("If we don't
act: 85 days / high emissions" and "If we act: 54 days / low emissions") in
each fork's color, and the shaded wedge between them is a second, non-textual
annotation calling out the gap. Where a city's two futures land on the same
count, as Chicago's dangerous-heat days do at zero and zero, the two labels
separate to a minimum spacing while their markers stay on the true values, so
the annotation never collides with itself and never misreports the data. The
template makes the one figure carrying each scene's point impossible to miss,
with no interaction required.

Annotations change within a scene by parameter rather than by time: switching
city or metric recomputes every callout, so they always describe the current
subject. The map's hover tooltip is treated as free-form exploration rather
than annotation, which is why the load-bearing annotations never depend on a
mouseover.

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
enumerate every view the piece can show. One render step reads all four and
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

The magnification uses two techniques. A true geometric fisheye of the map was
impractical, since its contours hold thousands of path vertices that would need
recomputing on every mouse movement, so the fisheye is applied only to the city
dots, where it is cheap and separates dense clusters like Europe and Southeast
Asia. The map surface instead gets a conventional magnifier, a live scaled copy
inside a circular lens that follows the cursor. Because the dots move and the
terrain does not, hovered cities appear to lift slightly above the map, which
was not the goal but makes the interaction feel tactile.

Affordances keep the options visible without instructions: labeled buttons,
highlighted pills, hover labels on the breadcrumbs, a pointer cursor on the
dots, and the introduction's "Find your city" button.

## Reference

Cleveland, W. S., and McGill, R. (1984). "Graphical Perception: Theory,
Experimentation, and Application to the Development of Graphical Methods."
*Journal of the American Statistical Association*, 79(387), 531-554.
