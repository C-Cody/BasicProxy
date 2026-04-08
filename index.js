// Copyright (c) 2024 iiPython

// List of domains
// Would of preferred to use JSON, but CF doesn't allow `require("fs")`
const domains = [
    "apis",
    "assetdelivery",
    "avatar",
    "badges",
    "catalog",
    "chat",
    "contacts",
    "contentstore",
    "develop",
    "economy",
    "economycreatorstats",
    "followings",
    "friends",
    "games",
    "groups",
    "groupsmoderation",
    "inventory",
    "itemconfiguration",
    "locale",
    "notifications",
    "points",
    "presence",
    "privatemessages",
    "publish",
    "search",
    "thumbnails",
    "trades",
    "translations",
    "users"
]

// Export our request handler
export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname.split(/\//);

        if (!path[1].trim()) 
            return new Response(JSON.stringify({ message: "Missing ROBLOX subdomain." }), { status: 400 });

        if (!domains.includes(path[1])) 
            return new Response(JSON.stringify({ message: "Specified subdomain is not allowed." }), { status: 401 });

        const headers = new Headers(request.headers);
        const roblosecurityHeader = headers.get("x-roblosecurity");
        const roblosecurityBase64Header = headers.get("x-roblosecurity-base64");
        headers.delete("host");
        headers.delete("roblox-id");
        headers.delete("user-agent");
        headers.delete("x-roblosecurity");
        headers.delete("x-roblosecurity-base64");
        headers["user-agent"] = "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

        if (roblosecurityBase64Header) {
            headers.set("cookie", `.ROBLOSECURITY=${atob(roblosecurityBase64Header)}`);
        } else if (roblosecurityHeader) {
            headers.set("cookie", `.ROBLOSECURITY=${roblosecurityHeader}`);
        }


        const init = {
            method: request.method,
            headers,
        };

        if (request.method !== "GET" && request.method !== "HEAD") {
            init.body = await request.text();
        }

        return fetch(`https://${path[1]}.roblox.com/${path.slice(2).join("/")}${url.search}`, init);
    }
};
