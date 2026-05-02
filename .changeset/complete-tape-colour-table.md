---
'@thermal-label/labelwriter-core': patch
---

Complete the `tapeColourFor()` mapping with the full LW 400 Series
Tech Ref p.24 "Set Tape Type" spec table. Previously the function
enumerated only 3 of 13 selectors and 10 of our catalogued D1
cassettes silently fell back to selector 0 (generic strobe profile).
With the full table, those cassettes now emit their spec-correct
heat-sensitivity byte — same wire surface, better thermal
calibration on coloured / reverse-print substrates. No API change.
