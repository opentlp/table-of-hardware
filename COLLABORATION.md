# Working together

OpenTLP is intended to connect existing thermal-printer projects, not replace
them. Applications, protocol libraries, and hardware documentation answer
different questions and can remain independently maintained.

## A collaboration proposal for thermal-label

[thermal-label](https://github.com/thermal-label) has broad protocol and device
research. OpenTLP Studio provides a visual application and a direct path from a
driver to people with physical printers. OpenTLP ToH can be the shared catalogue
between them.

This is a proposal for discussion. It does not describe an existing partnership
or a package dependency.

The first useful boundary is data and conformance, not a runtime dependency:

1. Map thermal-label model records to OpenTLP ToH fields, retaining a source and
   evidence scope for every imported claim.
2. Cross-link protocol documentation instead of copying prose or code.
3. Publish shared golden byte vectors for framing, checksums, compression, and
   status decoding where the protocol permits hardware-free testing.
4. Let each implementation run those vectors in its own test suite.
5. Consider a package adapter only after the relevant thermal-label packages are
   published, their continuous integration is green, and their public API has a
   versioned release.

This keeps both implementations usable on their own while making their factual
work cumulative.

## What each project can contribute

| OpenTLP | thermal-label |
|---|---|
| A visual application with browser, desktop, and command-line entry points | Broad model and protocol-family research |
| Hardware reports from people trying real print jobs | Protocol research and experimental package implementations |
| A CC0 hardware catalogue with field-level provenance | Existing protocol notes and test vectors |
| A self-contained driver contract in OpenTLP Core | Independent implementations for cross-checking wire output |

## Licensing and provenance

OpenTLP ToH accepts device and protocol facts under CC0-1.0. OpenTLP code is
MIT. External code, prose, artwork, or compiled databases are not copied merely
because they are publicly accessible.

An imported record must name its source, licence where applicable, retrieval
date, and the fields that source establishes. A linked project retains its own
licence and authorship. Protocol implementations should be independently
written from documented facts and wire captures unless compatible code reuse is
deliberately agreed and recorded.

## A practical first exchange

- Compare the two model registries and identify exact matches, rebrands, and
  conflicting claims.
- Add thermal-label as a documented software project in the support matrix.
- Select one shared printer family and exchange golden input/output vectors.
- Ask users in both communities to validate the same short hardware checklist.
- Review the results together before designing a permanent package boundary.

Discussion can happen in the [OpenTLP Discord](https://discord.gg/yksFD2rcPw)
or in issues in the relevant repository.
