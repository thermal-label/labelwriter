[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / PRINT\_STATUS\_LOCK\_NOT\_GRANTED

# Variable: PRINT\_STATUS\_LOCK\_NOT\_GRANTED

> `const` **PRINT\_STATUS\_LOCK\_NOT\_GRANTED**: `5` = `5`

Print-status byte 0 sub-state values per spec p.13-14:
  0..3 — sub-states once the lock is granted to the active host
         (0=idle, 1=printing, 2=error, 3=cancel)
  4    — printer just woke from standby
  5    — status reply *before* the lock is granted to the active
         host (i.e. the lock is held by someone else, or the
         printer hasn't decided yet)

`LOCK_NOT_GRANTED = 5` is the load-bearing one — it tells the
caller "your `ESC A 1` request did not give you the lock; another
host is in charge."
