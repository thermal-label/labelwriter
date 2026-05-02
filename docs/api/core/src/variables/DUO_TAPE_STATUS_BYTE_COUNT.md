[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / DUO\_TAPE\_STATUS\_BYTE\_COUNT

# Variable: DUO\_TAPE\_STATUS\_BYTE\_COUNT

> `const` **DUO\_TAPE\_STATUS\_BYTE\_COUNT**: `8` = `8`

Status response shape for the LabelWriter Duo's tape engine.

Per LW 450 Series Tech Ref Appendix B p.25, `ESC A` returns
**8 bytes** of status. Only byte 0 carries data on current Duo
firmware ("the LabelWriter Duo printer only uses the first byte");
bytes 1-7 are reserved for future use. We capture all 8 in
`rawBytes` for forward compat but only branch on byte 0.

Bit layout of byte 0:
  bit 6 (CASSETTE) — 1 = cassette inserted, 0 = no cassette
  bit 4 (CJ)       — 1 = cutter jammed (blade may be exposed!)
  bit 2 (GE)       — 1 = general error (motor stalled / tape jam)
  bits 0,1,3,5,7   — ignored
