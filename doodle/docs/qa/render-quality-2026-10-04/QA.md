# Rendering quality comparison

Owner approved up to $0.06 for three fresh gpt-image-1-mini requests with no retries. Each used the same Detailed bookshop prompt, 1024 square size and one image. No production setting or live app deployment changed.

All three requests completed. Provider reported 596 input text tokens per image and 272, 1056 and 4160 output image tokens respectively. Generation times were 9369, 12744 and 27956 milliseconds. The token-rate estimate totals $0.047480; published per-image output estimates plus the measured prompt input total $0.055576. Billing invoice reconciliation was not performed.

The original provider PNGs are retained. The unchanged production paper-correction helper corrected MEDIUM and HIGH. It returned LOW untouched with uncertain status because its dense shaded image did not meet the conservative background criteria. No drawing edits or regeneration were performed.

Visual judgment for this single sample: LOW is heavily textured and muddy; MEDIUM has stronger legible contours but dense hatching; HIGH has better spacing, lighter shading and more coherent overall proportions. HIGH is the provisional quality recommendation. One independent sample per setting is insufficient to establish a universal improvement or typical latency.

The browser gallery distinguishes rendering quality from the app detail selector. It supports side-by-side viewing, readable single-image viewing, original PNG comparison and full-resolution links. Current URL: https://doodle-layout-review-f9qmvr963-codenamez.vercel.app/render-quality.html

The image-only gallery is on the separate codenamez Hobby preview project. Desktop and 390 px rendered previews were inspected. All three PNGs loaded at 390 px without horizontal overflow. Single HIGH view and original switching were checked at 320 px, with no horizontal overflow. Browser viewport overrides are reset after verification. This gallery is actual generator-output evidence, not Play-installed end-to-end or deployed-backend validation.
