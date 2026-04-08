const ALLOWED_SUBDOMAINS = new Set([
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
    "users",
]);

const FORWARDED_COOKIE_RULES = [
    {
        subdomain: "trades",
        pathPattern: /^\/v2\/users\/[^/]+\/tradableItems$/i,
    },
];

const DEFAULT_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

function json(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=UTF-8",
            ...extraHeaders,
        },
    });
}

function normalizePathSegments(pathname) {
    return pathname
        .split("/")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
}

function getUpstreamTarget(url) {
    const segments = normalizePathSegments(url.pathname);
    const subdomain = segments[0];

    if (!subdomain) {
        return {
            error: json({ message: "Missing Roblox subdomain in path." }, 400),
        };
    }

    if (!ALLOWED_SUBDOMAINS.has(subdomain)) {
        return {
            error: json({ message: "Specified Roblox subdomain is not allowed." }, 401),
        };
    }

    const upstreamPath = `/${segments.slice(1).join("/")}`;
    return {
        subdomain,
        upstreamUrl: `https://${subdomain}.roblox.com${upstreamPath}${url.search}`,
        upstreamPath,
    };
}

function shouldForwardCookie(subdomain, upstreamPath) {
    return FORWARDED_COOKIE_RULES.some(
        (rule) => rule.subdomain === subdomain && rule.pathPattern.test(upstreamPath),
    );
}

function decodeBase64(value) {
    try {
        return atob(value);
    } catch (error) {
        throw new Error(
            `Invalid x-roblosecurity-base64 header: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

function buildForwardHeaders(request, subdomain, upstreamPath) {
    const headers = new Headers(request.headers);
    const roblosecurityHeader = headers.get("x-roblosecurity");
    const roblosecurityBase64Header = headers.get("x-roblosecurity-base64");

    headers.delete("host");
    headers.delete("roblox-id");
    headers.delete("user-agent");
    headers.delete("x-roblosecurity");
    headers.delete("x-roblosecurity-base64");
    headers.set("user-agent", DEFAULT_USER_AGENT);

    if (!shouldForwardCookie(subdomain, upstreamPath)) {
        return headers;
    }

    if (roblosecurityBase64Header) {
        headers.set("cookie", `.ROBLOSECURITY=${decodeBase64(roblosecurityBase64Header)}`);
        return headers;
    }

    if (roblosecurityHeader) {
        headers.set("cookie", `.ROBLOSECURITY=${roblosecurityHeader}`);
    }

    return headers;
}

async function buildRequestInit(request, headers) {
    const init = {
        method: request.method,
        headers,
        redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
        init.body = await request.text();
    }

    return init;
}

async function proxyRequest(request) {
    const url = new URL(request.url);
    const target = getUpstreamTarget(url);
    if (target.error) {
        return target.error;
    }

    const headers = buildForwardHeaders(request, target.subdomain, target.upstreamPath);
    const init = await buildRequestInit(request, headers);

    try {
        const upstreamResponse = await fetch(target.upstreamUrl, init);
        return upstreamResponse;
    } catch (error) {
        return json(
            {
                message: error instanceof Error ? error.message : String(error),
                upstreamUrl: target.upstreamUrl,
            },
            502,
        );
    }
}

export default {
    async fetch(request) {
        try {
            return await proxyRequest(request);
        } catch (error) {
            return json(
                {
                    message: error instanceof Error ? error.message : String(error),
                },
                500,
            );
        }
    },
};
