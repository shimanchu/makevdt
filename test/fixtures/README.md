# CLI regression baseline

These fixtures record the output of unmodified `main` at commit
`320f4d7cf9ffc8585f21f72b991a027e0e44d543`.
They preserve existing behavior; they do not establish VDT format correctness.

Inputs are synthetic and self-contained:

- `image_0001.png` through `image_0003.png`: 256×240, 8-bit RGB PNGs.
  For frame `f` (1–3), pixel `(x, y)` is
  `((3*x + 41*f) % 256, (5*y + 23*f) % 256, ((x ^ y) + 67*f) % 256)`.
- `audio.pcm`: 1,950 bytes; byte `i` is `(37*i + 11) % 256`.
  This is a deterministic ADPCM byte stream for serialization tests,
  not a recording intended for listening.

Both cases invoke the real CLI with `-p image_ -n 3 -a audio.pcm`:

| Expected output | Additional arguments |
| --- | --- |
| `resize-default.vdt` | `-t 5` (default resize, audio rate 4, no poster or comment) |
| `poster-no-resize.vdt` | `-t 5 --adpcm-rate 4 --no-resize --poster-image image_0003.png -c '回帰テスト ABC'` |

Run `npm ci` then `npm test` with Node.js 18 or newer. The test uses the
existing TypeScript dependency to transpile the CLI into a temporary directory,
executes it as a separate process, and compares the entire output with the
saved VDT. Temporary files are removed after the test. No parent-directory
assets or additional test libraries are required.

The test never rewrites expected files. If an intentional behavior change
requires new baselines, generate them separately with the CLI using the inputs
and arguments above, review the binary changes, and update these files and the
baseline commit together. Do not regenerate baselines simply to make a failing
test pass. These two cases do not cover every option or malformed input.
