---
id: http-router
title: HttpRouter
sidebar_label: Routing
---

## HttpRouter Instance

```js
host.router(location, [options])
```

| Argument   | Type                    | Default       |
|:----------:|-------------------------|---------------|
| `location` | `string`                | N/A, required |
| `options`  | `simples.RouterOptions` | `null`        |
| **return** | `simples.HttpRouter`    |               |

---

#### `.router(location)`
Get the router with the provided location or create a new one with default router options

#### `.router(location, options)`
Create a router on the provided location, on creation set the provided router options, will return an existing router if the name is already used and will ignore options in this case

---