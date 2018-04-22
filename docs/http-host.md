---
id: http-host
title: HttpHost
sidebar_label: Virtual Hosting
---

`simpleS` allows having multiple HTTP hosts on the same server.

## HttpHost Instance

```js
server.host(name[, options])
```

| Argument   | Type                    | Default       |
|:----------:|-------------------------|---------------|
| `name`     | `string`                | N/A, required |
| `options`  | `simples.RouterOptions` | `null`        |
| **return** | `simples.HttpHost`      |               |

---

#### `.host(name)`
Get the host with the provided name or create a new one with default router options

#### `.host(name, options)`
Create a host with the provided name, on creation set the provided router options, will return an existing host if the name is already used and will ignore options in this case

---

## Usage

```js
const server = simples(); // server and the main host in the same time

const exampleHost = server.host('example.com'); // host for example.com

const otherHost = server.host('*.example.com'); // host with a wild card
```