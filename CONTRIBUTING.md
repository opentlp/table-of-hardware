# Adding a printer

Each printer has a page at `packages/hardware/devices/<brand>/<id>.md` in the
[OpenTLP monorepo](https://github.com/opentlp/opentlp): YAML front matter holding
the structured record, then Markdown prose underneath. Copy an existing page,
edit it, open a pull request.

The front matter feeds the table and the JSON export, and the schema governs it.
The body is the wiki — protocol notes, quirks, anything a field cannot hold.
Start its headings at `##`; the page title is generated.

```bash
npm install
npm run catalogue:validate
```

## The rule

**Every field is a claim someone can check.**

If you do not know a value, leave the field out. A blank cell reads as
"unknown" — which is true. A guessed one reads as fact, and one wrong fact costs
more trust than ten missing ones.

A partial entry is welcome. Brand, model, how it connects, and where you got that
is enough to open a pull request.

## A minimal entry

```markdown
---
id: acme_lp42
brand: Acme
model: LP42

connectivity:
  ble:
    name_pattern: "^LP42$"
    name_examples: [LP42]

sources:
  - kind: user-report
    note: Name observed in a Bluetooth scan.
---

## Not yet recorded

Protocol; print width; resolution; mechanism.
```

## A full one

```yaml
id: acme_lp42
brand: Acme
model: LP42
aliases: [Widgetco W42]      # same hardware, different sticker
rebadge_of: originalco_x9    # id of the entry this one is a copy of
manufacturer: Original Co.

protocol:
  family: tiny               # devices sharing a family share driver code
  variant: prefixed
  packet_prefix: 12 51 78    # lowercase hex, space separated
  vendor_app: com.example.printapp

print:
  width_dots: 384
  width_mm: 48
  media_width_mm: 58
  dpi: 203
  media: [continuous, gap]
  colour: monochrome

mechanism:
  cutter: true                # is there one at all
  head_to_cutter_dots: 66
  backfeed: false             # does it retract to the head
  print_speed_mm_s: 20
  media_widths_mm: { min: 20, max: 50 }
  paper_drm: none             # none | circumventable | strict | unknown

connectivity:
  ble:
    service_uuid: 0000ae30-0000-1000-8000-00805f9b34fb
    write_uuid: 0000ae01-0000-1000-8000-00805f9b34fb
    notify_uuid: 0000ae02-0000-1000-8000-00805f9b34fb
    name_pattern: "^(LP42|W42)$"
    name_examples: [LP42, W42]
  usb:
    vid: "0483"
    pid: "5740"
    class: printer

power:
  battery_mah: 1200
  battery_cell: "18650"
  connector: usb-c

hardware:
  mcu: YC3121-D
  dimensions_mm: { width: 90, height: 74, depth: 35 }
  weight_g: 250
  certification:
    - authority: fcc
      id: 2A2AI-LP42
      url: https://fcc.report/FCC-ID/2A2AI-LP42/
      holder: Original Co.

reports: [battery, charging, media, faults]

support:
  cat-printer:
    level: listed              # named by the project, not necessarily tested
    driver: generic
  niimblue:
    level: works
    notes: Printing confirmed by the user report below.

status: verified

sources:
  - id: captured-2026-03
    kind: protocol-capture
    note: BLE capture from the vendor app, 2026-03.
    covers: [protocol, connectivity.ble, print.width_dots]
  - id: upstream-model-list
    kind: oss-project
    url: https://github.com/example/project
    licence: Apache-2.0
    retrieved: 2026-03-14
    covers: [support.cat-printer]
```

## Fields worth getting right

**`id`** — `<brand>_<model>`, lowercase, and permanent. Other projects key on it,
so it is never renamed or reused. The filename must match.

**`rebadge_of`** — point it at the entry this printer is a copy of. Rebadging is
rampant in this market and recording it is most of the value here: it turns a
list of stickers back into a list of machines. Use `aliases` for names the *same*
entry is sold under, `rebadge_of` when there is a separate entry for the original.

**`protocol.family`** — a slug shared by every device driven by the same code
(`tiny`, `niimbot`, `esc-pos`, `tspl`, `zpl`, `brother-raster`). If you know the
family, you have told a reader more than every spec field combined.

**`protocol.vendor_app`** — the Android package of the manufacturer's own app.
Unglamorous, and in practice the best single predictor of which protocol a
printer speaks, because the app ships the firmware's own driver. The brand on the
case is not.

**`connectivity.ble.name_pattern`** — a regular expression matched against the
advertised name. This is what software actually matches on, so it is worth more
than the model number.

A regex rather than a prefix list because prefixes do not describe the real
rule: `P12` and `P12_` differ by firmware, `LY01`–`LY05` and `LY10`–`LY11` speak
different dialects despite the shared stem, and a prefix match on `D11` also
catches `D110`. Anchor it unless partial matching is meant, and keep it portable
— JavaScript, Python and Dart all consume this, so no lookbehind and no named
groups.

Add `name_examples` with names you have actually seen. The validator checks each
one against the pattern, so a wrong expression is caught by the data; they also
make the table searchable, since nobody types a regex into a search box.

**`mechanism`** — cutter, head-to-cutter distance, backfeed, accepted media
widths, and whether the printer refuses third-party consumables. These decide
whether a label comes out usable, and none of them can be read off the protocol;
somebody has to look at the machine.

`cutter` is a yes/no: whether there is one at all, not what kind. State it even
when the answer is no — product photography routinely shows a cutter the shipped
hardware does not have.

**`reports`** — what the printer volunteers about itself. The difference between
hardware you can build a decent interface for and hardware you can only write to
and hope. List only what has been seen coming back.

**`status`** — how far to trust the entry as a whole:

| | |
|---|---|
| `verified` | Somebody printed from it, or captured its traffic |
| `reported` | Credible second-hand account |
| `unverified` | Transcribed from a catalogue, or inferred |

Most entries are `unverified`. That is fine and it is the default. `verified`
requires a source of kind `protocol-capture`, `user-report` or `vendor-doc` — the
validator enforces this.

**`support`** — only **free and open source** projects. A column in this matrix
reads as a recommendation, and the database does not exist to route people
towards paid software. Add a project to `packages/hardware/data/projects.json` before referencing
it; the validator rejects unknown slugs.

Use `listed` when a project's model table or README names the printer. Use
`works` only when a source records successful output, and `partial` when output
was produced but a specific function is missing or wrong. Source code containing
a model name proves implementation intent, not that anybody tested the hardware.

**`sources`** — required, at least one. Say where each claim came from and what
kind of evidence it is. A retailer listing and a protocol capture are not the
same weight, and the table should not present them as though they were.

Give a source an `id` and add `covers` as its field scope when that scope has
been checked. A broad path such as `print` covers its recorded children; use a
specific path such as `mechanism.cutter` when the source establishes only that
fact. Older entries without `covers` remain valid while they are audited, but a
consumer should not treat those claims as field-level verified evidence.

**`indicators`** — the lights, and what each colour means. Steady and flashing
usually mean different things on the same colour, so record both. This is one of
the most searched-for facts about a cheap printer and one of the least
documented; the manual is a folded sheet, if it exists.

**`documentation`** — link to deeper external write-ups rather than pasting them
in. Teardowns and firmware notes belong on the wikis that maintain them.

**`artwork`** — an SVG line drawing of the printer, beside the page. More use
than it sounds: a shape confirms "yes, that is the one on my desk" faster than
any specification row, and a drawing stays legible in both themes where a
photograph does not.

Draw it from the actual device. A plausible-looking printer that is not the
printer is worse than no picture: the whole point is that a reader recognises
their own machine, and a wrong shape makes them doubt the rest of the page. The
same rule applies here as to every other field — if you have not seen it, leave
it out.

Unlike everything else here, a drawing is a creative work and **is**
copyrightable, so `licence` is required. Contribute your own, or something
already free — not a photograph traced from a shop listing. Everything is
sanitised at build time: scripts, event handlers, animation and external
references are stripped, so submit inert artwork.

A drawing may also declare what it can be told to do:

```yaml
artwork:
  file: acme_lp42.svg
  licence: CC0-1.0
  hooks:                       # custom properties the drawing reads
    cutter: { class: cutter, property: --printer-cutter-mm, units_per_mm: 1.35 }
    led: { property: --printer-led }
    body: { property: --printer-body }
  variants:                    # colourways the model is sold in
    - id: white-red
      label: White, red cutter
      colours: { printer-body: "#ffffff", printer-cutter: "#a94f51" }
  lamps:                       # what colour to draw for each indicator state
    - hook: led
      unlit: "#5f5f5f"
      states: { green: "#37d067", blue: "#3d8bff", red: "#ff3b2f" }
  animations:                  # how the mechanism moves
    - id: cut
      label: Cut
      part: cutter
      travel_mm: -6
      duration_ms: 700
```

`lamps` and `animations` are properties of the *drawing*, not of the machine:
they say what to render, and they change when the artwork is redrawn. What a
colour *means* goes under `indicators`; the two join on the state name, and the
validator warns when one has no partner.

Durations are how long the real mechanism takes. Deliberately no easing and no
keyframes — whether to animate at all, how fast, and what to do under a
reduced-motion preference belongs to whatever renders it.

## Adding a protocol family

Wire formats live in `packages/hardware/families/<slug>.md`, one per protocol, in the same page
format. Devices point at one through `protocol.family`.

This is where driver-authoring detail belongs: packet framing, the checksum's
polynomial and initial value, bit order, compression settings, flow control, and
the command table. State every checksum parameter — a CRC named only by its
width is not reproducible, and a wrong guess produces plausible-looking bytes.

If the protocol has golden vectors anywhere — known inputs and the exact bytes
they must produce — record them under `conformance`. They are the only way to
prove an implementation correct without the hardware in front of you.

## Adding protocol details

Bytes on the wire are facts about a device and are welcome here.

Do not paste code from another project, whatever its licence, and do not copy
prose or photographs from a documentation site — several are share-alike, and
those terms would travel to everyone who uses this database. Record the fact,
cite the page.

## Licence of contributions

Data goes into the public domain under CC0-1.0; code is MIT. Opening a pull
request means you are willing to release your contribution on those terms.
