# The worklets `isObject()` crash — investigation

**Status: cause found upstream; fix applied, not yet verified on device.**

It is a known bug in `react-native-worklets` 0.10.0, and this project was on exactly
the affected pair — reanimated 4.5.0 with worklets 0.10.0
([reanimated#9776](https://github.com/software-mansion/react-native-reanimated/issues/9776),
duplicate of [#9751](https://github.com/software-mansion/react-native-reanimated/issues/9751)).

When a call is scheduled with `scheduleOnRN` — what `runOnJS` compiles to — and the
remote function is released before that task runs, the `registry.delete(remoteId)` task
can run *before* the call task. The callback is freed while its invocation is still
pending, and the pending task then reads freed memory.
[PR #9789](https://github.com/software-mansion/react-native-reanimated/pull/9789)
replaces the JS-side registry, which "cannot keep both the actual callback and the
cached serialized callback value alive without a memory cycle", with a lifetime tied to
TurboModule `invalidate()`. Merged 2026-07-01, released in **worklets 0.10.1**.

The rest of this document is the investigation that preceded that discovery. It is kept
because most of it was wasted effort with an identifiable cause, and that is worth more
than the conclusion.

## The lesson

**Search for a known upstream issue before theorising.** One web search found this in
under a minute. It was run only after five failed attempts and hours of work, and every
one of those attempts was an attempt to out-reason a library bug.

The symptoms all pointed at "upstream, and timing-dependent" from the start: a crash
inside `libworklets` with no frame in application code, that vanished under `__DEV__`,
and that moved when instrumentation was added. Nothing about that profile suggested an
application bug, and it was treated as one anyway.

A second, narrower lesson: **`remoteFunctionRegistry` never evicting was true and
irrelevant.** That fact was used to rule out the callback as the freed object, without
checking whether the *native* `SerializableRemoteFunction` wrapper had a lifetime of its
own. It does, and that is precisely what was being freed. A correct observation about
one layer was used to dismiss a different layer.

---

## What the crash is

The app dies mid-game with no JS error and no red screen — the process is simply gone.

Two faces, one bug:

| build | signal | where |
|---|---|---|
| release (CI APK) | `SIGSEGV`, null deref | `libhermesvm+0xcb950` ← `libworklets+0x9cdd8` ← `Task::execute` |
| dev client | `SIGABRT`, assertion | `jsi.h:2014 Value::getObject(IRuntime&): assertion "isObject()" failed` ← `libworklets` |

Both on the `mqt_v_js` thread, both under
`RuntimeScheduler_Modern::executeTask`. The release build compiles the assertion out
and dereferences the bad value instead — which is the *only* reason these looked like
two different bugs, and why the crash was reported fixed when it was not.

So: **worklets calls `.getObject()` on a `jsi::Value` that is not an object.** A
serializable fails to unpack on the JS side.

## It predates the current work

First `SIGSEGV` observed 14:59 on `7508aff` — before any of the cluster-depth or
wordmark work. `7508aff` fixed a *different* crash with the same assertion (a
`runOnJS` closure carrying `preparedById`); this one survived it.

## Ruled out

- **The `runOnJS` callback itself.** `remoteFunctionRegistry` is a `Map<number, Function>`
  that never evicts, so the target cannot be collected.
- **The `runOnJS` arguments.** Every call site passes numbers only.
- **`FloatingPiece`'s closure.** It captured the whole `prepared` object — confirmed by
  running the babel plugin and reading the emitted `_closure` — and that is a genuine
  defect worth its fix (`da1ec8d`) plus its guard test. But the crash is unchanged with
  it fixed, so it was not the cause. `worklet-closures.test.ts` now proves no worklet in
  `puzzle-board.tsx` or `use-board-camera.ts` captures a Skia-bearing object.

## The loop that makes this cheap

The crash **does not reproduce with `__DEV__ = true`** — ~96 grabs on an ordinary dev
bundle, nothing. That fits a lifetime bug that dev masks by holding extra references
(worklets keeps dev-only bookkeeping, and `freezeObjectInDev` changes object handling).

It *does* reproduce when Metro serves a production-mode bundle to the dev client:

```
APP_VARIANT=development npx expo start --dev-client --port 8081 --no-dev --minify
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW \
  -d "puzzled-dev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  com.puzzled.app.dev
```

That gives release-like semantics *and* the assertion, on a ~2 minute cycle instead of
a ~25 minute CI build. `app.config.js` gives the development profile its own package id
so this installs alongside the real app and never touches its save.

## Why bisecting has not worked yet

**The oracle is unreliable.** Observed: two crashes at exactly 8 grabs, then roughly 500
grabs across many runs with none.

That flakiness produced one false result already. Disabling `GlowRing` "survived 60
grabs" and looked like a hit — but the control, with `GlowRing` back **on**, also
survived 60. A bisect arm means nothing until the control fails.

**Instrumentation may suppress it.** Adding `console.log` breadcrumbs either side of
every `runOnJS` gave 7 clean runs (~390 grabs). `console.log` from a worklet is itself a
cross-runtime call that serializes its arguments, so it perturbs the machinery under
test. Treat breadcrumb runs as suspect.

## Candidates, untested

- **Gesture memo churn.** `gesture` is rebuilt on `looseHitTestData` and
  `trayIds.length`, both of which change on *every* placement — so a fresh set of
  serialized worklets is built the instant each drag ends, while the previous gesture
  may still be in flight.
- **Missing `cancelAnimation` on unmount.** `GlowRing` runs `withTiming` on a
  `useSharedValue` with no cleanup and is keyed by `snapFlash.id`, so each snap unmounts
  the previous ring mid-animation while its completion worklet is pending. `trayScroll`'s
  timing effect has the same shape.
- **Skia host objects reaching the UI runtime as *props* rather than closures.**
  `FloatingPiece` mounts and unmounts on every grab and its subtree holds `SkPath` and
  `SkImage` while its `Group` carries an animated `transform`. The closure guard does
  not cover this path.

## How each dead end is explained by the real cause

Worth keeping, because each one looked like evidence at the time:

| observation | why it happened |
|---|---|
| Fixing `FloatingPiece`'s closure changed nothing | Real defect, unrelated cause |
| `cancelAnimation` on GlowRing changed nothing | Same |
| Flaky: 2 crashes at 8 grabs, then ~600 clean | It is a race between two scheduled tasks |
| Never reproduced under `__DEV__` | Dev bookkeeping holds an extra reference |
| `console.log` breadcrumbs suppressed it | Logging from a worklet perturbs scheduling order |
| Human play crashed far more than scripted input | Real touch produces denser, more overlapping `runOnJS` traffic |

## What to verify

The bump to worklets 0.10.1 is committed but **unverified on device** — it is a native
change, so it needs a build. The pre-fix baseline to compare against: the release build
crashed twice at 8 grabs, and normal human play crashed within ~2 minutes, repeatedly.

Because the crash is a race, a single clean run proves nothing. Run the stress
repeatedly and compare rates, and prefer a few minutes of ordinary play — which
historically triggered it far more reliably than scripted input ever did.
