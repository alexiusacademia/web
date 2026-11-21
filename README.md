# web

Web servers in [Tessel](https://tessel-lang.syncster.dev) programs: routes
with values in the path, middleware, forms, uploads, cookies, signed
sessions, folders of static files and HTML templates. It's built on
Tessel's own HTTP server (`serveHTTP`), with nothing else to install.

```tessel
import web

struct Item {
    id: Int
    name: String
}

fn main() {
    var items = [Item(id: 1, name: "Tea")]

    var router = web.Router()
    router.use(web.logger())
    router.get("/") { r in web.html("<h1>Shop</h1>") }
    router.get("/items") { r in web.json(items) }
    router.get("/items/:id") { r in
        for item in items {
            if "{item.id}" == r.param("id") {
                return web.json(item)
            }
        }
        web.status(404)
    }
    router.post("/items") { r in
        let sent: Item? = web.readJson(r)
        if let item = sent {
            items.append(item)
            return web.json(item, status: 201)
        }
        web.status(400, "send an item as JSON")
    }
    router.files("/static", folder: "public")

    let server = web.serve(router, port: 8080)
    if server == -1 {
        print("can't serve: port 8080 is taken")
        return
    }
    print("Serving at http://127.0.0.1:8080/")
}
```

```text
$ curl http://127.0.0.1:8080/items
[{"id":1,"name":"Tea"}]
$ curl -d '{"id": 2, "name": "Coffee"}' http://127.0.0.1:8080/items
{"id":2,"name":"Coffee"}
$ curl http://127.0.0.1:8080/items/2
{"id":2,"name":"Coffee"}
$ curl -d 'oops' http://127.0.0.1:8080/items
send an item as JSON
```

and the server prints a line for each request:

```text
Serving at http://127.0.0.1:8080/
127.0.0.1 GET /items 200 23 B 0.03 ms
127.0.0.1 POST /items 201 24 B 0.02 ms
```

`examples/notes` is a whole small site: pages from templates with a
layout, a form, signing in with a session, a JSON API and a stylesheet.

## Using it

Add it to a project (Tessel 0.23.1 or later):

```sh
tessel add web
```

then `import web`. (`app` is a word Tessel keeps for apps, so call the
router something else, like `router`.)

## Routes

```tessel
var router = web.Router()
router.get("/users/:id") { r in web.text("user {r.param("id")}") }
router.post("/users") { r in … }
router.later("GET", "/slow") { r, reply in
    request(url: "https://example.com/data") { answer in
        reply(web.text(answer.text))
    }
}
```

| Method | |
|---|---|
| `get`, `post`, `put`, `patch`, `delete(pattern) { r in … }` | Answers requests with that method whose path fits the pattern. A `get` route answers HEAD requests too. |
| `any(pattern) { … }` | Any method. |
| `add(method, pattern) { … }` | Another method (`"PROPFIND"`). |
| `later(method, pattern) { r, reply in … }` | A handler that answers later: it calls `reply` when the answer is ready, after a request of its own, a timer or `background` work. |
| `use(middleware)` | Middleware for every request, in the order added. |
| `mount(prefix, router)` | Another router's routes under a prefix (`"/api"`). Its middleware runs only for its routes. |
| `files(prefix, folder:, options:)` | A folder of files: see [Files](#files). |
| `notFound { r in … }` | What answers when no route fits (a plain 404 by default). |

A pattern's parts can be `:name` (one part of the path) or, at the end,
`*name` (the rest of the path, slashes and all). The values are decoded:
`/users/ann%20lee` gives `r.param("id")` = `"ann lee"`. When several routes
fit, fixed text wins over `:name`, and `:name` over `*name`, part by part,
so `/users/new` goes to its own route before `/users/:id`, whatever the
order they were added in, and `/docs` before `/docs/*rest`. A trailing
slash doesn't matter.

A path that fits only routes of other methods gets a 405 with an `Allow`
header, and an OPTIONS request gets the same `Allow` with a 204.

`web.serve(router, port:, host:)` starts the server and returns its id
(for `tcpPort` and `stopHTTP`), or -1 if it can't listen. `port: 0` takes
any free port. The server listens on this computer only unless
`host: "0.0.0.0"`. It speaks HTTP/1.1, not HTTPS: on the internet, put it
behind a server that does HTTPS, like Caddy or nginx.

## Requests

A handler gets a `web.Request`:

| Field or method | |
|---|---|
| `method`, `path`, `query` | `"GET"`, `"/users/3"`, `"page=2"`. The path is still encoded (`%20`), but tidied as the router sees it: `//a` is `/a`, and `/%61dmin` is `/admin`, so a check in middleware like `r.path.hasPrefix("/admin")` can't be got round. |
| `headers`, `header(name)` | Names in lowercase; `header` takes any case. |
| `body`, `text()` | The body as `Data`, and as text. |
| `param(name)`, `params` | Values from the pattern. |
| `queryValue(name)`, `queryValues(name)`, `queryDict()` | The query, decoded. |
| `form()` | The fields of a form: urlencoded or multipart. |
| `parts()`, `file(name)` | The parts of a multipart body, and an uploaded file: `name`, `fileName`, `contentType`, `data`. |
| `cookies()`, `cookie(name)` | The cookies the browser sent. |
| `accepts(type)` | Whether the Accept header takes a type. |
| `contentType()` | `"application/json"`, without parameters. |
| `values` | Notes left by middleware (`values["user"]` from `basicAuth`). |
| `session` | The session's values (with `sessions`). |
| `ip`, `secure` | The client's IP address, and whether it used HTTPS (behind a proxy, with `proxy()`). |
| `remote`, `received` | The connection's `"ip:port"`, and when the request came. |

`web.readJson(r)` reads the body as JSON into your type:
`let item: Item? = web.readJson(r)` is `nil` if it isn't JSON of that shape.

## Responses

| Function | |
|---|---|
| `web.text(text, status:)` | Plain text. |
| `web.html(html, status:)` | A page. |
| `web.json(value, status:)` | Any value as JSON: a struct, a list, a dictionary. |
| `web.bytes(data, type:, status:)` | Bytes with a content type. |
| `web.redirect(to, status:)` | 302 by default; 303 after a form, 301 or 308 for good. |
| `web.status(code, message)` | A status with its reason as the body (`"Not Found"`), or a message. |
| `web.file(path, request, maxAge:, download:)` | A file, with caching and ranges. |
| `web.page(templates, name, data, layout:)` | A page from templates. |

and a `web.Response` (`status`, `headers`, `body`) changes with
`withHeader(name, value)`, `withStatus(code)`,
`withCookie(name, value, maxAge:, path:, domain:, httpOnly:, secure:, sameSite:)`,
`withoutCookie(name)` and `withSession(values)`. Cookies are `HttpOnly`
and `SameSite=Lax` unless you say otherwise.

## Middleware

```tessel
router.use(web.logger())
router.use(web.cors(origins: ["https://example.com"]))
router.use(web.onRequest { r in
    if r.header("x-api-key") != "secret" {
        return web.stop(web.status(401))
    }
    web.next(r)
})
router.use(web.onResponse { r, res in res.withHeader("X-Served-By", "web") })
```

Middleware has a `before`, which sees each request first and passes it on
(`web.next(request)`, changed or not) or answers it (`web.stop(response)`),
and an `after`, which can change each answer before it's sent. The
befores run in the order the middleware was added, the afters in the
opposite order. `web.onRequest` and `web.onResponse` make middleware with
one of the two; `web.Middleware(before:, after:)` has both.

| Middleware | |
|---|---|
| `logger()` | Prints `127.0.0.1 GET /users/3 200 512 B 0.12 ms` for each request. |
| `cors(origins:, methods:, headers:, credentials:, maxAge:)` | Lets pages of other sites call the server, and answers preflight requests. |
| `basicAuth(realm:) { user, password in … }` | Asks for a name and password; the name goes in `values["user"]`. Only over HTTPS. |
| `sessions(secret:, cookie:, maxAge:, secure:, sameSite:, store:)` | Sessions, in a signed cookie or on the server. |
| `csrf(secret:, cookie:, field:, header:, secure:)` | A token that forms must send back, so other sites can't post them. |
| `rateLimit(requests:, seconds:, key:)` | A 429 for a client that asks too often. |
| `proxy(trusted:)` | The client's real address and HTTPS behind a proxy. |
| `compress(minimum:)` | gzip for text, HTML, CSS, JavaScript, JSON, XML and SVG, for clients that take it. |
| `securityHeaders(contentSecurityPolicy:)` | `nosniff`, no framing, a strict referrer policy, and a CSP if given. |
| `bodyLimit(bytes)` | A 413 for bigger bodies. |

## Sessions

```tessel
router.use(web.sessions(secret: environment("SESSION_SECRET") ?? ""))
router.post("/login") { r in
    let form = r.form()
    if !passwordIsRight(form["name"] ?? "", form["password"] ?? "") {
        return web.redirect("/login?wrong", status: 303)
    }
    web.redirect("/", status: 303).withSession(["user": form["name"] ?? ""])
}
router.get("/") { r in web.text("Hello, {r.session["user"] ?? "stranger"}") }
router.post("/logout") { r in web.redirect("/", status: 303).withSession([:]) }
```

The session's values are kept in the cookie itself, signed with HMAC-SHA256
with a key made from the secret for sessions only, so they can't be
changed without the secret (but they can be read: never put a password
in them). The secret must be at least 16 characters; keep
it out of the code, and changing it ends every session. A session lasts
`maxAge` seconds (two weeks) from when it was last saved. `web.sign`,
`web.unsign` and `web.hmac` are there for signing values of your own.

### Sessions on the server

With a `store`, the values stay on the server and the cookie holds only a
signed random id, which changes each time the session is saved (so an id
seen before signing in is worthless after). Sessions can then be any
size, and ended from the server:

```tessel
let sessions = try web.databaseStore("sessions.db")      // or web.memoryStore()
router.use(web.sessions(secret: environment("SESSION_SECRET") ?? "", store: sessions))

// Sign Ann out everywhere, say after a password change:
print(sessions.removeWhere { s in s["user"] == "ann" })
```

`web.memoryStore()` keeps them in memory (they end with the program);
`web.databaseStore(path, table:)` keeps them in SQLite, so they last
when the server restarts. A store is a struct of functions (`load`,
`save`, `remove`, `removeWhere`, `count`), so a store for another
database is a matter of filling them in.

## Passwords

```tessel
let hash = web.hashPassword("tessel")       // keep this, not the password
print(hash)
print(web.checkPassword("tessel", hash))
print(web.checkPassword("Tessel", hash))
```

```text
pbkdf2_sha256$600000$P3ujVETxQdM88ub2ljfseQ$3PJETzwCefEwcVjefG5ElQtlKuaN0jTsohN3c6LqnKM=
true
false
```

The hash is PBKDF2-HMAC-SHA256 with 600,000 rounds and a random salt,
written the way Django writes it (so Django's hashes check too). It takes
about half a second on purpose, so stolen hashes are slow to guess. A
server answers one request at a time, so in a handler use the versions
that work on another thread:

```tessel
login.later("POST", "/login") { r, reply in
    let form = r.form()
    let hash = hashFor(form["name"] ?? "")
    web.checkPasswordLater(form["password"] ?? "", hash) { ok in
        if ok {
            reply(web.redirect("/", status: 303).withSession(["user": form["name"] ?? ""]))
        } else {
            reply(web.redirect("/login?wrong", status: 303))
        }
    }
}
```

`web.hashPasswordLater(password) { hash in … }` is the same for making
one. `web.randomToken()` gives 43 random characters for a reset link or an
API key, and `web.pbkdf2(password:salt:iterations:length:)` is there for
keys of your own.

## Forms from other sites (CSRF)

A page on another site can post a form to yours, and the browser sends
your cookies with it. `web.csrf` stops that: each browser gets a token
in a signed cookie, and a POST, PUT, PATCH or DELETE without the same
token in the form (`_csrf`) or a header (`X-CSRF-Token`) gets a 403.

```tessel
router.use(web.csrf(secret: environment("CSRF_SECRET") ?? ""))
router.get("/") { r in web.html("<form method=\"post\">{web.csrfField(r)}<button>Go</button></form>") }
```

In a template, pass `web.csrfField(r)` in the data and write `{{{csrf}}}`
in each form; from JavaScript, send `web.csrfToken(r)` as the
`X-CSRF-Token` header. Use it for the pages and forms of a site, not for
an API that other programs call (mount the two as separate routers).

## Rate limits

```tessel
var login = web.Router()
login.use(web.rateLimit(requests: 5, seconds: 60))     // per IP address
```

A client that asks more often gets a 429 with `Retry-After`; answers say
how many are left (`RateLimit-Remaining`). `key:` counts by something
else than the IP address: `key: { r in r.header("x-api-key") ?? "" }`.
The counts are in memory, for one server.

## Running it for real

The server speaks plain HTTP and answers one request at a time, and a
mistake in a handler that stops the program (an index outside a list,
say) stops the server. So, on the internet:

1. **Put it behind a proxy that does HTTPS**, like Caddy, with the server
   on its default host, `127.0.0.1`, so only the proxy can reach it. A
   `Caddyfile`:

   ```text
   example.com {
       reverse_proxy 127.0.0.1:8080
   }
   ```

   and `router.use(web.proxy())` first, so `r.ip` is the visitor's address
   (not the proxy's) and `r.secure` says they used HTTPS. Cookies then
   want `secure: true` (`sessions`, `csrf`, `withCookie`).
2. **Have the system start it again** if it stops, with systemd on Linux
   (`/etc/systemd/system/myapp.service`, then
   `systemctl enable --now myapp`):

   ```text
   [Unit]
   Description=My Tessel site
   After=network.target

   [Service]
   ExecStart=/srv/myapp/myapp
   WorkingDirectory=/srv/myapp
   Environment=SESSION_SECRET=… CSRF_SECRET=…
   Restart=always
   User=myapp

   [Install]
   WantedBy=multi-user.target
   ```

3. **Keep long work off the server's thread**: `background` for
   computing, `later` routes for answers that wait, and
   `checkPasswordLater` for passwords.
4. **Use `csrf`, `sessions` with `secure: true`, `rateLimit` on sign-in,
   and `securityHeaders`.** `examples/notes` has all of them.

Bodies up to 64 MB are read whole into memory, and answers are sent
whole: there's no streaming and no WebSocket server yet.

## Files

```tessel
router.files("/static", folder: "public")
router.files("/", folder: "site", options: web.FileOptions(maxAge: 3600))
router.get("/report") { r in web.file("report.pdf", r, download: "Report 2026.pdf") }
```

`/static/css/site.css` sends `public/css/site.css`, with its content type,
`ETag` and `Last-Modified`: a browser that has the file already gets a
304 and no bytes. A `Range` request gets only those bytes (206), so video
plays and downloads resume. A folder's address sends its `index.html`
(and `/docs` is sent to `/docs/` first). Names with `..`, encoded slashes
and hidden files (`.env`, `.git`) aren't sent, nor on Windows device names
(`CON`, `NUL`), short names (`GITIGN~1`) and names ending in a dot.
Symbolic links in the folder are followed. Other methods than GET and
HEAD get a 404.

| `FileOptions` | |
|---|---|
| `index` | The file for a folder's address (`"index.html"`; `""` for none). |
| `maxAge` | Seconds browsers may keep a file without asking (0: they ask each time, and get a 304 if it's the same). |
| `dotFiles` | Whether hidden files can be sent (`false`). |

`web.contentType(path)` gives the type for a file name.

## Templates

`views/shop.html`:

```html
<h1>{{title}}</h1>
<ul>
  {{#each items}}
  <li>{{name}}: ${{price}}{{#if @first}} (new){{/if}}</li>
  {{else}}
  <li>Nothing for sale</li>
  {{/each}}
</ul>
```

`views/layout.html`:

```html
<!doctype html>
<title>{{title}}</title>
{{{body}}}
```

```tessel
import web

struct Item {
    name: String
    price: Float
}

struct Shop {
    title: String
    items: [Item]
}

fn main() {
    let pages = try web.loadTemplates("views")
    let shop = Shop(title: "Tea & <coffee>", items: [Item(name: "Green tea", price: 3.5), Item(name: "Espresso", price: 2.25)])
    print(web.render(pages, "shop", shop, layout: "layout"))
}
```

prints

```html
<!doctype html>
<title>Tea &amp; &lt;coffee&gt;</title>
<h1>Tea &amp; &lt;coffee&gt;</h1>
<ul>
  <li>Green tea: $3.5 (new)</li>
  <li>Espresso: $2.25</li>
</ul>
```

In a handler, `web.page(pages, "shop", shop, layout: "layout")` is the
same page as an answer.

The templates are written like Mustache and Handlebars templates, and give
what Handlebars gives (checked on 3,000 templates):

| Tag | |
|---|---|
| `{{name}}` | A value, with HTML's special characters escaped (`&`, `<`, `>`, `"`, `'`, `` ` `` and `=`). |
| `{{{html}}}`, `{{& html}}` | A value as it is. |
| `{{user.name}}`, `{{items.0}}`, `{{items.count}}` | A field, an item, a count. |
| `{{#if x}} … {{else if y}} … {{else}} … {{/if}}` | False, `nil`, 0, `""` and an empty list are false. |
| `{{#unless x}} … {{/unless}}` | The opposite. |
| `{{#each items}} … {{else}} … {{/each}}` | Each item of a list (or value of an object), with `{{this}}`, `{{@index}}`, `{{@first}}`, `{{@last}}`, `{{@key}}`. |
| `{{#each items as \|item i\|}}` | With names for the item and its index. |
| `{{#with user}} … {{/with}}` | Names looked up in a value. |
| `{{> row}}`, `{{> row item}}` | Another template, with the same value or another. |
| `{{! note }}`, `{{!-- note --}}` | A comment. |
| `{{~name~}}`, `{{~#if x}}` | `~` takes away the spaces and line breaks on that side of the tag. |
| `{{^}}` | The same as `{{else}}`. |
| `{{@root.title}}` | A name in the data given to the template, from anywhere. |
| `\{{name}}` | The text `{{name}}`. |

A name is looked up in the innermost value first, then outwards, so the
page's `title` works inside `each`; `../name` starts one level out (this is
Handlebars with `compat: true`, or Mustache). A name that isn't there
shows nothing. A list shows its items with commas; numbers show as
Tessel's `toJson` writes them (`2.0` for a `Float`). There are no helpers:
`{{eq a b}}` is a mistake the templates report, so work such values out in
Tessel and pass them in. A line with only a block tag (or a
comment or partial) leaves no blank line behind.

The data is any value `toJson` takes. `web.loadTemplates(folder, extension:)`
reads a folder and its subfolders (`views/users/row.html` is
`"users/row"`); `web.parseTemplates(["name": text])` makes them from
texts. Both give a failure with the file and line for a mistake like an
unclosed `{{#if}}`. In a Tessel string, `{` starts a value, so a template
written in the code is `"\{\{name}}"`.

## Testing a server

`web.call(router, method, path, body:, headers:)` runs a request through a
router without a network, and gives the answer:

```tessel
import web

fn routes() -> web.Router {
    var router = web.Router()
    router.get("/hello/:name") { r in web.text("Hello, {r.param("name")}!") }
    router
}

test "greets by name" {
    let answer = web.call(routes(), "GET", "/hello/Ann%20Lee")
    expect(answer?.status == 200)
    expect(answer?.text() == "Hello, Ann Lee!")
}

test "other paths are not found" {
    expect(web.call(routes(), "GET", "/bye")?.status == 404)
}
```

```text
$ tessel test .
ok    greets by name  (6 ms)
ok    other paths are not found  (6 ms)

2 passed, 0 failed, in 0.01 s
```

It's `nil` for a `later` route; `router.handle(request) { answer in … }`
runs those.

## Speed

On an M-series Mac, with ApacheBench (`ab -k -c 20`) against
`examples/notes`: about 90,000 requests a second for the JSON API, 45,000
for a page from templates, and 34,000 for the stylesheet.

## Tests

```sh
tessel run tests
```

runs about 3,400 checks: the router, requests and responses, the
middleware, signing (RFC 4231 and values from Python's `hmac`), password
hashes (RFC 7914 and hashes from Python's `hashlib`), CSRF, rate limits,
proxies, session stores, files, templates, and a real server over TCP.
They pass on macOS, and on Linux (ARM64 and x64) with Tessel's Linux
release, where the library was also run behind Caddy over HTTPS. The
templates are compared with Handlebars 4.7.8 on 3,000 cases (most of
them made at random), saved in `tests/templates.json` by `tools/oracle`
(`npm install && node oracle.js`). Run them from the library's folder.

## What's where

| File | |
|---|---|
| `router.tsl` | `Router`, routes and patterns, middleware chains, `serve`, `call`. |
| `request.tsl` | `Request`: query, forms, multipart, cookies. |
| `response.tsl` | `Response` and the functions that make one; cookies. |
| `middleware.tsl` | The ready-made middleware, sessions too. |
| `security.tsl` | Random tokens, passwords, CSRF, rate limits, proxies. |
| `stores.tsl` | Session stores: memory and SQLite. |
| `sign.tsl` | HMAC, `sign` and `unsign`. |
| `files.tsl` | Folders and files: types, caching, ranges. |
| `template.tsl` | Reading and showing templates. |
| `value.tsl` | Data as templates see it (read from JSON). |

## Licence

MIT. See `LICENSE`.
