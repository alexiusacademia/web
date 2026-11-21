# web's website

The page for the web library, live at https://web-package.syncster.dev.

Author: Alexius Academia · Date: 2026-11-21

A static page: no build step, no dependencies. Netlify deploys this folder
by itself whenever `main` is pushed to GitHub.

```
index.html          # the page; its example outputs were printed by running them
styles.css          # csv's website's design, in red (#c93045, #ff7a8a when dark)
assets/share.png    # the picture shown when a link to the site is shared (1200 × 630)
assets/favicon.svg
netlify.toml        # no build; HTML isn't cached
```

To look at it locally: `python3 -m http.server 8000 -d website`, then
http://localhost:8000/.

If an example changes, run it with the library and copy its output in. The
servers in the examples were run on other ports and their answers fetched
with the `curl` commands shown; `share.png` is an HTML page of the hero's
code and answer, saved with headless Chrome at 1200 × 630.
