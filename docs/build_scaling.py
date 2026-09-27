"""Generates docs/scaling.html: six stages, each drawn as Render vs AWS lanes on one grid.

Edit the STAGES specs below, then run:  python docs/build_scaling.py
"""

from pathlib import Path

OUT = Path(__file__).with_name("scaling.html")

COLS = ["Client", "Front door", "App servers", "Data & state", "Background & streams"]
COLW, NW, NH, X0 = 184, 136, 46, 16
WIDTH = X0 * 2 + COLW * len(COLS)


# --------------------------------------------------------------------------- #
# SVG generation
# --------------------------------------------------------------------------- #

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


class Lane:
    def __init__(self, name, tagline, nodes, edges, strip, groups=(), rowh=70):
        self.name, self.tagline, self.strip = name, tagline, strip
        self.nodes = {n[0]: n for n in nodes}
        self.edges, self.groups, self.rowh = edges, groups, rowh
        self.rows = max(n[2] for n in nodes) + 1
        self.top_pad = 44 if groups else 32

    def pos(self, key, y0):
        _, c, r, *_ = self.nodes[key]
        return X0 + c * COLW + (COLW - NW) / 2, y0 + self.top_pad + r * self.rowh

    def height(self):
        return self.top_pad + (self.rows - 1) * self.rowh + NH + (22 if self.groups else 14) + 30 + 12

    def render(self, y0):
        out = []
        h = self.height()
        out.append(f'<rect class="lane" x="4" y="{y0}" width="{WIDTH - 8}" height="{h}" rx="10"/>')
        out.append(f'<text class="lane-name" x="16" y="{y0 + 20}">{esc(self.name)}'
                   f'<tspan class="lane-tag" dx="8">{esc(self.tagline)}</tspan></text>')

        for label, c0, r0, c1, r1 in self.groups:
            gx = X0 + c0 * COLW + 8
            gw = (c1 - c0 + 1) * COLW - 16
            gy = y0 + self.top_pad + r0 * self.rowh - 25
            gh = (r1 - r0) * self.rowh + NH + 32
            out.append(f'<rect class="group" x="{gx}" y="{gy}" width="{gw}" height="{gh}" rx="8"/>')
            out.append(f'<text class="group-label" x="{gx + 10}" y="{gy + 15}">{esc(label)}</text>')

        for a, b, label, kind in self.edges:
            out.append(self.edge(a, b, label, kind, y0))

        for key, c, r, title, sub, *flags in self.nodes.values():
            flags = set(flags[0].split()) if flags else set()
            x, y = self.pos(key, y0)
            cls = "node" + (" new" if "new" in flags else "") + (" ghost" if "ghost" in flags else "") \
                + (" warn" if "warn" in flags else "")
            g = [f'<g class="{cls}">']
            if "stack" in flags:
                g.append(f'<rect class="box shadow" x="{x + 6}" y="{y - 6}" width="{NW}" height="{NH}" rx="6"/>')
                g.append(f'<rect class="box shadow" x="{x + 3}" y="{y - 3}" width="{NW}" height="{NH}" rx="6"/>')
            g.append(f'<rect class="box" x="{x}" y="{y}" width="{NW}" height="{NH}" rx="6"/>')
            g.append(f'<text class="t" x="{x + 10}" y="{y + 19}">{esc(title)}</text>')
            g.append(f'<text class="s" x="{x + 10}" y="{y + 35}">{esc(sub)}</text>')
            if "new" in flags:
                g.append(f'<rect class="badge" x="{x + NW - 34}" y="{y - 8}" width="30" height="15" rx="7.5"/>')
                g.append(f'<text class="badge-t" x="{x + NW - 19}" y="{y + 3}" text-anchor="middle">NEW</text>')
            g.append("</g>")
            out.append("".join(g))

        sy = y0 + h - 30 - 12
        out.append(f'<rect class="strip" x="16" y="{sy}" width="{WIDTH - 32}" height="30" rx="6"/>')
        out.append(f'<text class="strip-t" x="28" y="{sy + 19}">{self.strip}</text>')
        return "\n".join(out), h

    def edge(self, a, b, label, kind, y0):
        na, nb = self.nodes[a], self.nodes[b]
        ax, ay = self.pos(a, y0)
        bx, by = self.pos(b, y0)
        is_new = "new" in (nb[5] if len(nb) > 5 else "") or "new" in (na[5] if len(na) > 5 else "")
        if kind == "v":
            if nb[2] > na[2]:
                pts = [(ax + NW / 2, ay + NH), (bx + NW / 2, by - (8 if len(nb) > 5 and "stack" in nb[5] else 0))]
            else:
                pts = [(ax + NW / 2, ay - (6 if len(na) > 5 and "stack" in na[5] else 0)), (bx + NW / 2, by + NH)]
            lx, ly, anchor = pts[0][0] + 7, (pts[0][1] + pts[1][1]) / 2 + 4, "start"
        elif kind == "vh":
            s = (ax + NW / 2, ay + NH) if nb[2] > na[2] else (ax + NW / 2, ay)
            e = (bx + NW, by + NH / 2) if nb[1] < na[1] else (bx, by + NH / 2)
            pts = [s, (s[0], e[1]), e]
            lx, ly, anchor = (s[0] + e[0]) / 2, e[1] - 6, "middle"
        else:
            if nb[1] > na[1]:
                s, e = (ax + NW, ay + NH / 2), (bx, by + NH / 2)
                mx = e[0] - (COLW - NW) / 2
            else:
                s, e = (ax, ay + NH / 2), (bx + NW, by + NH / 2)
                mx = e[0] + (COLW - NW) / 2
            pts = [s, e] if s[1] == e[1] else [s, (mx, s[1]), (mx, e[1]), e]
            lx, ly, anchor = mx, e[1] - 6, "middle"
            if s[1] == e[1]:
                lx = (s[0] + e[0]) / 2
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        (px, py), (ex, ey) = pts[-2], pts[-1]
        if abs(ex - px) > abs(ey - py):
            k = 1 if ex > px else -1
            head = f"{ex:.1f},{ey:.1f} {ex - 7 * k:.1f},{ey - 4:.1f} {ex - 7 * k:.1f},{ey + 4:.1f}"
        else:
            k = 1 if ey > py else -1
            head = f"{ex:.1f},{ey:.1f} {ex - 4:.1f},{ey - 7 * k:.1f} {ex + 4:.1f},{ey - 7 * k:.1f}"
        cls = "edge new" if is_new else "edge"
        lab = f'<text class="elabel" x="{lx:.1f}" y="{ly:.1f}" text-anchor="{anchor}">{esc(label)}</text>' if label else ""
        return f'<g class="{cls}"><path d="{d}"/><polygon points="{head}"/>{lab}</g>'


def figure(stage_id, lanes, aria, caption):
    parts, y = [], 36
    for i, x in enumerate(COLS):
        parts.append(f'<text class="colhead" x="{X0 + i * COLW + COLW / 2}" y="20" text-anchor="middle">{x.upper()}</text>')
    for lane in lanes:
        body, h = lane.render(y)
        parts.append(body)
        y += h + 14
    svg = (f'<svg viewBox="0 0 {WIDTH} {y - 4}" role="img" aria-label="{esc(aria)}" '
           f'xmlns="http://www.w3.org/2000/svg">' + "\n".join(parts) + "</svg>")
    return (f'<figure class="diagram" id="{stage_id}-fig"><div class="scrollx">{svg}</div>'
            f'<figcaption>{caption}</figcaption></figure>')


# --------------------------------------------------------------------------- #
# Node / edge specs.   (key, col, row, title, subtitle, "flags")
# --------------------------------------------------------------------------- #

B = ("b", 0, 0, "Browser", "cat · sparkles · scroll")

STAGES = []

# ---- Stage 1 ------------------------------------------------------------- #
STAGES.append(dict(
    id="s1", n=1, name="One service", users="Today → ~50k users",
    lede="One Python process group behind HTTPS. This is exactly what the repo deploys right now.",
    trigger="You want it online, and nothing else yet.",
    lanes=[
        Lane("RENDER", "you push to git; it runs", [
            B,
            ("edge", 1, 0, "Render edge", "HTTPS · load balancer"),
            ("web", 2, 0, "Web service", "gunicorn 2 × 4 · Django"),
            ("none", 3, 0, "No database", "the page stores nothing", "ghost"),
        ], [("b", "edge", "HTTPS", "h"), ("edge", "web", "proxy", "h")],
            "Render handles: TLS certificates · deploy on <tspan class='k'>git push</tspan> · health checks on /healthz · restarts · logs"),
        Lane("AWS", "you assemble the pieces", [
            B,
            ("dns", 1, 0, "Route 53", "DNS: name → address"),
            ("alb", 1, 1, "ALB + ACM", "HTTPS · health checks"),
            ("task", 2, 1, "ECS Fargate task", "container: gunicorn"),
            ("none", 3, 1, "No database", "the page stores nothing", "ghost"),
        ], [("b", "dns", "DNS", "h"), ("b", "alb", "HTTPS", "h"), ("alb", "task", "forward", "h")],
            "You build: VPC + subnets · security groups · IAM roles · ECR image registry · CI/CD pipeline · CloudWatch logs"),
    ],
    aria="Stage 1. On Render, browser to Render edge to one web service. On AWS, browser to Route 53 and an ALB, then one Fargate task. No database in either.",
    caption="Same job, different amount of assembly. Render’s single <b>edge</b> box does what Route 53, the ALB and the certificate do on AWS. Neither needs a database, because the page stores nothing: the whole story plays out in the visitor’s browser.",
    brief=[
        ("Web service", "The computer that runs your Python and answers requests."),
        ("gunicorn 2 × 4", "Runs 2 copies of the app with 4 threads each, so one slow visitor doesn’t block the other seven."),
        ("HTTPS / TLS", "The padlock. It encrypts traffic and proves the site is really yours."),
        ("Health check", "Something pings <code>/healthz</code> every few seconds. No answer means restart."),
        ("DNS (Route 53)", "The phone book that turns <i>mmagika.com</i> into a server address."),
        ("Load balancer (ALB)", "A receptionist who takes every visitor and walks them to a free server."),
        ("VPC & security groups", "Your private fenced-off network in AWS, and the list of who may talk to whom."),
        ("IAM", "Permission slips: which machine or person is allowed to do what."),
    ],
    changes="""
<p>The app is already built for this stage: config comes from environment variables, logs are one JSON line per request, <code>/healthz</code> answers probes, and deploys are just <code>git push</code>.</p>
<p>The one decision that pays off later: <b>the server remembers nothing</b>. No database, no logins, no sessions, so there’s nothing to scale, back up or lose, and any copy can answer anyone.</p>""",
    render_do=["Connect the repo as a Blueprint (reads <code>render.yaml</code>)", "Render generates <code>SECRET_KEY</code>", "Done: HTTPS URL in about 2 minutes"],
    aws_do=["Create a VPC, public subnets, internet gateway", "ALB, target group, ACM certificate, Route 53 record", "ECR repo + ECS service + task role", "A GitHub Actions pipeline to build and deploy"],
))

# ---- Stage 2 ------------------------------------------------------------- #
STAGES.append(dict(
    id="s2", n=2, name="Many copies", users="~50k → 2M users",
    lede="Run the same service many times and put the page on a CDN, close to users.",
    trigger="CPU sits above ~70% at peak, or one crashed instance takes the whole site down.",
    lanes=[
        Lane("RENDER", "a slider, or autoscaling", [
            B,
            ("edge", 1, 0, "Render edge", "balances across copies"),
            ("cdn", 1, 1, "Edge cache", "index.html near users", "new"),
            ("web", 2, 0, "Web service ×2–10", "autoscale on CPU %", "new stack"),
            ("none", 3, 0, "No shared state", "limits count per copy", "ghost warn"),
        ], [("b", "edge", "/api", "h"), ("b", "cdn", "page", "h"), ("edge", "web", "spread", "h")],
            "Render handles: + spreading traffic over instances · autoscaling (Pro workspaces, up to 100 instances) · edge caching of static files"),
        Lane("AWS", "you wire every hop", [
            B,
            ("cf", 1, 0, "CloudFront + WAF", "CDN · bot & rate rules", "new"),
            ("s3p", 2, 0, "S3 bucket", "index.html origin", "new"),
            ("alb", 1, 1, "ALB", "spans 3 AZs"),
            ("task", 2, 1, "ECS service ×N", "target: CPU 60%", "new stack"),
            ("none", 3, 1, "No shared state", "limits count per copy", "ghost warn"),
        ], [("b", "cf", "HTTPS", "h"), ("cf", "s3p", "page", "h"), ("cf", "alb", "/api/*", "v"), ("alb", "task", "spread", "h")],
            "You build: + auto scaling policies · subnets in 3 Availability Zones · CloudFront behaviours · WAF rules · cache invalidation on deploy"),
    ],
    aria="Stage 2. Render: browser to edge cache for the page and to the edge for the API, which spreads over 2 to 10 web instances. AWS: browser to CloudFront with WAF, which serves the page from S3 and forwards /api to an ALB and an auto-scaled ECS service.",
    caption="Copies only work if any copy can answer anyone. MMagika’s scrolls already allow that. The one thing that breaks is the <b>rate limiter</b> (red): each copy counts on its own, so 10 copies let an attacker guess 10× more magic words. Stage 3 fixes it.",
    brief=[
        ("Horizontal scaling", "More copies of the same server instead of one bigger server."),
        ("Stateless", "The server remembers nothing between requests, so any copy can serve anyone."),
        ("Autoscaling", "A robot that adds copies when they’re busy and removes them when it’s quiet."),
        ("CDN / edge cache", "Copies of your files stored in cities near your users, so the page loads fast everywhere."),
        ("WAF", "A bouncer at the door who blocks obvious bots and floods before they reach your code."),
        ("Availability Zone", "Separate data-centre buildings in one region. If one floods, the others keep serving."),
    ],
    changes="""
<p><b>Code change: make the page cacheable.</b> The ~35 pictures, scripts and styles are already separate files a CDN can cache. Only the HTML is different on each load, because it carries a fresh CSP nonce. Every script is already its own file, so the policy <code>'self'</code> alone is enough; drop the nonce and the HTML can sit on the edge too.</p>
<p>Traffic math: 2M daily users ≈ 160 requests/s on average and ~500/s in the peak hour. Each API call does about 1 ms of work, so a handful of copies is enough. You’re buying <i>resilience</i> here more than raw speed.</p>""",
    render_do=["Set instances to 2+ (never 1 in production)", "Turn on autoscaling: min 2, max 10, CPU 70%", "Serve the page as a cached static asset"],
    aws_do=["Launch template / ECS service across 3 AZs", "Target-tracking scaling policy", "CloudFront with 2 origins: S3 for <code>/</code>, ALB for <code>/api/*</code>", "WAF managed rule groups + rate rules"],
))

# ---- Stage 3 ------------------------------------------------------------- #
STAGES.append(dict(
    id="s3", n=3, name="Shared memory", users="When features need to remember",
    lede="Add a fast shared cache and a real database, reached over a private network.",
    trigger="You want burn-after-reading scrolls, ‘my scrolls’ for signed-in users, abuse reports, or rate limits that hold across copies.",
    lanes=[
        Lane("RENDER", "add two managed services", [
            B,
            ("edge", 1, 0, "Render edge", "balances across copies"),
            ("cdn", 1, 1, "Edge cache", "index.html near users"),
            ("web", 2, 0, "Web service ×N", "autoscaled", "stack"),
            ("pg", 3, 0, "Render Postgres", "scrolls · users · reports", "new"),
            ("kv", 3, 1, "Render Key Value", "Redis-style: limits", "new"),
        ], [("b", "edge", "/api", "h"), ("b", "cdn", "page", "h"), ("edge", "web", "spread", "h"),
            ("web", "pg", "SQL", "h"), ("web", "kv", "INCR", "h")],
            "Render handles: + managed Postgres & Key Value · backups · HA standby (paid) · private network between services in a region"),
        Lane("AWS", "private subnets, pooling, secrets", [
            B,
            ("cf", 1, 0, "CloudFront + WAF", "CDN · bot & rate rules"),
            ("s3p", 2, 0, "S3 bucket", "index.html origin"),
            ("alb", 1, 1, "ALB", "spans 3 AZs"),
            ("task", 2, 1, "ECS service ×N", "private subnets", "stack"),
            ("ec", 3, 0, "ElastiCache", "Valkey: rate limits", "new"),
            ("rds", 3, 1, "RDS Postgres", "Multi-AZ · RDS Proxy", "new"),
        ], [("b", "cf", "HTTPS", "h"), ("cf", "s3p", "page", "h"), ("cf", "alb", "/api/*", "v"), ("alb", "task", "spread", "h"),
            ("task", "ec", "INCR", "h"), ("task", "rds", "SQL", "h")],
            "You build: + private subnets · NAT gateway · Secrets Manager for DB passwords · RDS Proxy (connection pooling) · failover drills"),
    ],
    aria="Stage 3. Web servers now talk to a Postgres database and a Redis-style cache. Render: Render Postgres and Render Key Value. AWS: RDS Postgres Multi-AZ with RDS Proxy, and ElastiCache.",
    caption="Two kinds of memory with two jobs. The <b>cache</b> holds throwaway, super-fast counters (rate limits, ‘opened’ flags). The <b>database</b> holds what must never be lost. A privacy-friendly trick: keep the encrypted message in the link and store only the scroll’s id and state in Postgres.",
    brief=[
        ("Redis / Key Value", "A shared whiteboard in memory. Every copy reads and writes it in under a millisecond, and it’s fine if it’s wiped."),
        ("Postgres", "The filing cabinet. Slower than the whiteboard, but it never forgets and never half-saves."),
        ("Connection pool", "Shared phone lines to the database, so 50 servers don’t each dial 20 lines and jam it."),
        ("Multi-AZ / HA standby", "A twin database in another building that takes over automatically if the first dies."),
        ("Private subnet", "Machines with no public address. Only your own servers can reach them."),
        ("Secrets Manager", "A safe for passwords, instead of pasting them into config files."),
    ],
    changes="""
<p><b>Code change:</b> move the per-visitor tally in <code>site_security/limit_requests_per_visitor.py</code> from memory to Redis <code>INCR</code> + <code>EXPIRE</code>. It’s one small file, so nothing else changes.</p>
<p>Burn-after-reading needs one atomic step: <code>UPDATE scrolls SET opened_at = now() WHERE id = $1 AND opened_at IS NULL</code>. If no row changes, someone else already opened it.</p>
<p>Watch connections: 10 instances × 2 processes × 4 threads = 80 database connections. Pool them (PgBouncer on Render, RDS Proxy on AWS).</p>""",
    render_do=["Create Postgres + Key Value in the same region", "Reference their internal URLs in <code>render.yaml</code> env vars", "Pick an HA-capable Postgres plan"],
    aws_do=["DB subnet group in private subnets", "RDS Multi-AZ + RDS Proxy + parameter groups", "ElastiCache cluster + security group rules", "Secrets Manager + IAM so tasks can read the secrets"],
))

# ---- Stage 4 ------------------------------------------------------------- #
STAGES.append(dict(
    id="s4", n=4, name="Heavy lifting in the back", users="When ‘complex processing’ arrives",
    lede="Slow work moves off the request path into a queue that background workers drain.",
    trigger="New features take seconds, not milliseconds: illustrated scrolls (AI images), read-aloud audio, translation, moderation scans.",
    lanes=[
        Lane("RENDER", "a worker service + external storage", [
            B,
            ("edge", 1, 0, "Render edge", "balances across copies"),
            ("cdn", 1, 1, "Edge cache", "index.html near users"),
            ("web", 2, 0, "Web service ×N", "returns 202 + job id", "stack"),
            ("pg", 3, 0, "Render Postgres", "jobs · status"),
            ("kv", 3, 1, "Render Key Value", "limits + job queue"),
            ("store", 3, 2, "Object storage", "S3 / R2 (external)", "new"),
            ("ai", 4, 0, "AI / GPU API", "external provider", "new"),
            ("wk", 4, 1, "Background worker", "Celery / RQ ×N", "new stack"),
        ], [("b", "edge", "/api", "h"), ("b", "cdn", "page", "h"), ("edge", "web", "spread", "h"),
            ("web", "pg", "SQL", "h"), ("web", "kv", "enqueue", "h"), ("kv", "wk", "dequeue", "h"),
            ("wk", "ai", "infer", "v"), ("wk", "store", "save file", "vh")],
            "Render handles: + worker & cron services on the same git-push deploy. You bring: object storage and any GPU/AI provider"),
        Lane("AWS", "queue, workers, storage all native", [
            B,
            ("cf", 1, 0, "CloudFront + WAF", "also serves results"),
            ("s3p", 2, 0, "S3 bucket", "index.html origin"),
            ("alb", 1, 1, "ALB", "spans 3 AZs"),
            ("task", 2, 1, "ECS service ×N", "returns 202 + job id", "stack"),
            ("ec", 3, 0, "ElastiCache", "Valkey: rate limits"),
            ("rds", 3, 1, "RDS Postgres", "jobs · status"),
            ("sqs", 3, 2, "SQS + DLQ", "job queue", "new"),
            ("s3", 3, 3, "S3", "generated images", "new"),
            ("gpu", 4, 0, "Bedrock / GPU", "model inference", "new"),
            ("wk", 4, 2, "ECS workers ×N", "scale on queue depth", "new stack"),
        ], [("b", "cf", "HTTPS", "h"), ("cf", "s3p", "page", "h"), ("cf", "alb", "/api/*", "v"), ("alb", "task", "spread", "h"),
            ("task", "ec", "INCR", "h"), ("task", "rds", "SQL", "h"), ("task", "sqs", "enqueue", "h"),
            ("sqs", "wk", "poll", "h"), ("wk", "gpu", "infer", "v"), ("wk", "s3", "put", "vh")],
            "You build: + SQS queue & dead-letter queue · worker autoscaling on queue depth · S3 bucket policies · EventBridge schedules for cleanup"),
    ],
    aria="Stage 4. The web tier enqueues a job and answers immediately. Workers pull jobs, call an AI or GPU service, and save the result to object storage. Render uses Key Value as the queue plus a Background Worker; AWS uses SQS with a dead-letter queue and ECS workers.",
    caption="The web server never waits on slow work. It writes a job row, drops a ticket in the queue, and replies <code>202 Accepted</code> with a job id. The browser polls <code>/api/jobs/&lt;id&gt;</code> (or listens on a stream) until a worker marks it done. Workers scale on <b>queue length</b>, not CPU.",
    brief=[
        ("Queue", "The ticket rail in a restaurant kitchen. The waiter pins an order and goes back to guests; cooks take tickets when they’re free."),
        ("Worker", "A server with no website. It only takes tickets and cooks them."),
        ("202 Accepted", "“Got it, working on it.” Not “done”."),
        ("Idempotent", "Cooking the same ticket twice gives one dish, not two. Needed because retries happen."),
        ("Dead-letter queue", "The pile of tickets that failed five times, set aside for a human to look at."),
        ("Object storage (S3)", "A bottomless shared drive for files, each reachable by a URL."),
    ],
    changes="""
<p>Rule of thumb: anything slower than ~300 ms, or anything that calls a third party that might hang, goes to the queue.</p>
<p>Sizing: if 10% of 2M daily seals ask for an illustration at ~5 s each, that’s 1M worker-seconds a day, or about 12 workers busy around the clock (~60 at peak). That’s why they autoscale on <i>queue depth</i>.</p>
<p>Render has no GPUs and no object store. Call an AI API, or a GPU host, from the worker, and write files to S3 or Cloudflare R2.</p>""",
    render_do=["Add a <code>type: worker</code> service to <code>render.yaml</code>", "Use Key Value as the broker (RQ, Celery, Dramatiq)", "Add a <code>type: cron</code> job to purge old files", "Create an S3/R2 bucket; keys in env vars"],
    aws_do=["SQS queue + DLQ + redrive policy", "Worker ECS service, scaling on <code>ApproximateNumberOfMessagesVisible</code>", "S3 bucket behind CloudFront (Origin Access Control)", "Bedrock access or a GPU instance group"],
))

# ---- Stage 5 ------------------------------------------------------------- #
STAGES.append(dict(
    id="s5", n=5, name="Everyone wants to know", users="~5M+ users, several teams",
    lede="Publish every important fact once to an event log. Any number of systems read it independently.",
    trigger="Analytics, moderation, notifications, search and ML all want to react to ‘spell cast’ or ‘scroll opened’, and you’re tired of editing the web app for each one.",
    lanes=[
        Lane("RENDER", "no managed Kafka: rent one", [
            B,
            ("edge", 1, 0, "Render edge", "balances across copies"),
            ("cdn", 1, 1, "Edge cache", "index.html near users"),
            ("web", 2, 0, "Web service ×N", "writes outbox rows", "stack"),
            ("pg", 3, 0, "Render Postgres", "data + outbox table"),
            ("kv", 3, 1, "Render Key Value", "limits + job queue"),
            ("store", 3, 2, "Object storage", "S3 / R2 (external)"),
            ("kafka", 3, 3, "Hosted Kafka", "Confluent / Aiven", "new"),
            ("ai", 4, 0, "AI / GPU API", "external provider"),
            ("wk", 4, 1, "Background worker", "Celery / RQ ×N", "stack"),
            ("cons", 4, 3, "Consumers ×N", "moderate · notify · stats", "new stack"),
            ("wh", 4, 4, "Warehouse", "ClickHouse / BigQuery", "new"),
        ], [("b", "edge", "/api", "h"), ("b", "cdn", "page", "h"), ("edge", "web", "spread", "h"),
            ("web", "pg", "SQL", "h"), ("web", "kv", "enqueue", "h"), ("kv", "wk", "dequeue", "h"),
            ("wk", "ai", "infer", "v"), ("wk", "store", "save file", "vh"),
            ("web", "kafka", "events", "h"), ("kafka", "cons", "consume", "h"), ("cons", "wh", "sink", "v")],
            "Render runs the consumers as worker services. Kafka and the warehouse live outside Render: connect over TLS with SASL credentials in env vars"),
        Lane("AWS", "managed Kafka in your VPC", [
            B,
            ("cf", 1, 0, "CloudFront + WAF", "also serves results"),
            ("s3p", 2, 0, "S3 bucket", "index.html origin"),
            ("alb", 1, 1, "ALB", "spans 3 AZs"),
            ("task", 2, 1, "ECS service ×N", "writes outbox rows", "stack"),
            ("ec", 3, 0, "ElastiCache", "Valkey: rate limits"),
            ("rds", 3, 1, "RDS Postgres", "data + outbox table"),
            ("sqs", 3, 2, "SQS + DLQ", "job queue"),
            ("s3", 3, 3, "S3", "generated images"),
            ("msk", 3, 4, "Amazon MSK", "Kafka · 3 brokers", "new"),
            ("gpu", 4, 0, "Bedrock / GPU", "model inference"),
            ("wk", 4, 2, "ECS workers ×N", "scale on queue depth", "stack"),
            ("cons", 4, 4, "Consumers ×N", "moderate · notify · stats", "new stack"),
            ("lake", 4, 5, "S3 lake + Athena", "via Firehose", "new"),
        ], [("b", "cf", "HTTPS", "h"), ("cf", "s3p", "page", "h"), ("cf", "alb", "/api/*", "v"), ("alb", "task", "spread", "h"),
            ("task", "ec", "INCR", "h"), ("task", "rds", "SQL", "h"), ("task", "sqs", "enqueue", "h"),
            ("sqs", "wk", "poll", "h"), ("wk", "gpu", "infer", "v"), ("wk", "s3", "put", "vh"),
            ("task", "msk", "events", "h"), ("msk", "cons", "consume", "h"), ("cons", "lake", "sink", "v")],
            "You build: + MSK cluster sizing, storage & upgrades · topic ACLs / IAM auth · schema registry (Glue) · Firehose delivery · Athena tables"),
    ],
    aria="Stage 5. The web tier publishes events to Kafka. Several consumer services read the same events independently for moderation, notifications and analytics, and a sink copies them into a warehouse or data lake. Render uses hosted Kafka outside Render; AWS uses Amazon MSK.",
    caption="A <b>queue</b> (stage 4) hands each ticket to <i>one</i> worker and then it’s gone. A <b>log</b> like Kafka keeps every event for days, and every team keeps its own bookmark. Adding a new consumer (say, fraud detection) never touches the web app, and it can replay last week’s events on day one.",
    brief=[
        ("Event", "A fact that happened: “a healing spell was cast at 21:04.” Never a command."),
        ("Kafka topic", "An append-only diary of events. Nobody tears out pages; everyone reads at their own pace."),
        ("Consumer group", "One team reading the diary. Each team keeps its own bookmark."),
        ("Partition", "The diary split into volumes so many readers can work in parallel. Events for the same scroll stay in order within one volume."),
        ("Outbox pattern", "Save the data and a ‘please publish this’ note in the same database transaction, so you never save without announcing (or announce without saving)."),
        ("Warehouse / data lake", "Where you ask big questions, like “scrolls opened last month by country”, without slowing the live database."),
    ],
    changes="""
<p>Kafka is the most over-adopted piece on this page. <b>Don’t add it just for scale.</b> At 160 events/s, Postgres plus a queue is plenty. Add it when the <i>number of different consumers</i> grows, or when you need replay.</p>
<p>A cheaper first step on Render is Redis Streams in Key Value. It has the same consumer-group idea and fits modest volumes.</p>
<p>Key events by <code>scroll_id</code> so each scroll’s events stay in order. Keep them 7 days. Version the schemas.</p>""",
    render_do=["Sign up for hosted Kafka (or start with Redis Streams)", "One worker service per consumer group", "Relay outbox rows to Kafka from a small worker"],
    aws_do=["MSK (provisioned or Serverless) in private subnets", "IAM auth + topic ACLs", "Glue Schema Registry", "Firehose → S3 → Athena/Redshift"],
))

# ---- Stage 6 ------------------------------------------------------------- #
STAGES.append(dict(
    id="s6", n=6, name="Planet scale", users="20M users, several continents",
    lede="Run the whole stack in two or more regions, route each user to the nearest healthy one, and describe everything as code.",
    trigger="Users in Europe and Asia see 200 ms+ latency, one region outage would take you down, EU data must stay in the EU, or many teams deploy every day.",
    lanes=[
        Lane("RENDER", "second stack + outside help for data", [
            B,
            ("glb", 1, 0, "Global DNS / LB", "e.g. Cloudflare LB", "new"),
            ("ra", 2, 0, "Oregon stack", "web + workers ×N", "stack"),
            ("rb", 2, 1, "Frankfurt stack", "web + workers ×N", "new stack"),
            ("pga", 3, 0, "Postgres primary", "Oregon"),
            ("pgb", 3, 1, "No regional copy", "writes go to Oregon", "ghost warn"),
            ("ka", 4, 0, "Hosted Kafka", "multi-region plan"),
        ], [("b", "glb", "HTTPS", "h"), ("glb", "ra", "nearest", "h"), ("glb", "rb", "nearest", "h"),
            ("ra", "pga", "SQL", "h"), ("rb", "pga", "", "h")],
            "Deploy the same Blueprint to a 2nd region. Render services and databases each live in one region, so global data needs an external multi-region DB",
            groups=[("us · oregon", 2, 0, 4, 0), ("eu · frankfurt", 2, 1, 4, 1)], rowh=92),
        Lane("AWS", "copy the stack per region with IaC", [
            B,
            ("r53", 1, 0, "Route 53 + CF", "latency + health routing", "new"),
            ("ra", 2, 0, "us-east-1 stack", "ALB · ECS · workers", "stack"),
            ("rb", 2, 1, "eu-west-1 stack", "ALB · ECS · workers", "new stack"),
            ("aw", 3, 0, "Aurora Global", "writer", "new"),
            ("ar", 3, 1, "Aurora reader", "~1 s behind, promotable", "new"),
            ("ma", 4, 0, "MSK", "us-east-1"),
            ("mb", 4, 1, "MSK Replicator", "copies topics", "new"),
        ], [("b", "r53", "HTTPS", "h"), ("r53", "ra", "nearest", "h"), ("r53", "rb", "nearest", "h"),
            ("ra", "aw", "writes", "h"), ("rb", "ar", "reads", "h"), ("aw", "ar", "replicate", "v"), ("ma", "mb", "mirror", "v")],
            "You build: + everything above, twice · Terraform/CDK for all of it · OpenTelemetry traces · SLO alerts · canary deploys · region failover runbooks",
            groups=[("us-east-1", 2, 0, 4, 0), ("eu-west-1", 2, 1, 4, 1)], rowh=92),
    ],
    aria="Stage 6. Two regions. A global router sends each user to the nearest region. On AWS, Aurora Global Database keeps a writer in one region and a readable copy in the other, and MSK Replicator mirrors Kafka topics. On Render, a second region's stack writes across the ocean to a single-region Postgres unless an external global database is used.",
    caption="The web tier is easy to copy. The <b>data</b> is the hard part. AWS gives you cross-region database and Kafka replication as products. On Render, the Frankfurt copy has to write to Oregon (+~140 ms per round trip) unless you bring a globally replicated database. The stateless page still helps: any region can serve anyone, with no lookup.",
    brief=[
        ("Region", "A cluster of data centres in one part of the world (Virginia, Ireland, Frankfurt…)."),
        ("Latency routing", "DNS that sends each person to the nearest region that’s currently healthy."),
        ("Replication lag", "The other region’s copy of the database is about a second behind."),
        ("Failover", "Promoting the copy to be the main database when the main region is down."),
        ("Infrastructure as Code", "Your servers described in files (Terraform, CDK) that can be reviewed like code and recreated in minutes."),
        ("Observability", "Logs (what happened), metrics (how much, how fast) and traces (the path one request took)."),
        ("SLO", "A promise you measure, like “99.9% of reveals answer in under 300 ms”."),
    ],
    changes="""
<p>Most apps with 20M users are <b>not</b> multi-region. Single region, multi-AZ, a CDN and good backups covers most needs. Go multi-region for latency-sensitive users on other continents, legal data residency, or an uptime promise that can’t tolerate a regional outage.</p>
<p>This is where Render stops being the easy answer. It can still run the stateless tiers well. The global data layer, compliance controls and per-hop tuning are where AWS (or GCP/Azure, or Kubernetes) earns its complexity.</p>""",
    render_do=["Duplicate services in a second region from the same Blueprint", "Put a global load balancer in front", "Move data to a multi-region database, or accept cross-region writes"],
    aws_do=["Terraform/CDK modules per region", "Aurora Global Database + tested failover", "ElastiCache Global Datastore, MSK Replicator", "Route 53 health checks + latency records"],
))


# --------------------------------------------------------------------------- #
# Page
# --------------------------------------------------------------------------- #

def stage_html(s):
    fig = figure(s["id"], s["lanes"], s["aria"], s["caption"])
    brief = "".join(f"<div><dt>{t}</dt><dd>{d}</dd></div>" for t, d in s["brief"])
    rdo = "".join(f"<li>{x}</li>" for x in s["render_do"])
    ado = "".join(f"<li>{x}</li>" for x in s["aws_do"])
    return f"""
<section class="stage" id="{s['id']}" aria-labelledby="{s['id']}-h">
  <header class="stage-head">
    <p class="eyebrow"><span class="num">Stage {s['n']} of 6</span><span class="users">{s['users']}</span></p>
    <h2 id="{s['id']}-h">{s['name']}</h2>
    <p class="lede">{s['lede']}</p>
    <p class="trigger"><b>Move here when:</b> {s['trigger']}</p>
  </header>
  {fig}
  <div class="stage-body">
    <div class="brief">
      <h3>In junior terms</h3>
      <dl>{brief}</dl>
    </div>
    <div class="changes">
      <h3>What actually changes</h3>
      {s['changes']}
      <div class="todo">
        <div><h4>On Render you…</h4><ul>{rdo}</ul></div>
        <div><h4>On AWS you…</h4><ul>{ado}</ul></div>
      </div>
    </div>
  </div>
</section>"""


def count_nodes(lane):
    return sum(1 for n in lane.nodes.values() if not (len(n) > 5 and "ghost" in n[5]) and n[0] != "b")


nav = "".join(f'<li><a href="#{s["id"]}"><span class="nav-n">{s["n"]}</span>{s["name"]}</a></li>' for s in STAGES)

NOTES = {
    1: "TLS, deploys, health checks, restarts",
    2: "Balancing across copies, autoscaling, edge caching",
    3: "Managed Postgres + Key Value, backups, private network",
    4: "Worker and cron services. You bring object storage and GPUs",
    5: "Consumers run on Render. Kafka and the warehouse are external",
    6: "One region per stack. Global data needs an outside database",
}
summary_rows = "".join(
    f"<tr><th scope='row'><a href='#{s['id']}'>{s['n']}. {s['name']}</a></th><td>{s['users']}</td>"
    f"<td class='num'>{count_nodes(s['lanes'][0])}</td><td class='num'>{count_nodes(s['lanes'][1])}</td>"
    f"<td>{NOTES[s['n']]}</td></tr>"
    for s in STAGES
)

# who-manages-what matrix: (layer, render, fargate, ec2)  Y = you, P = provider, S = shared
MATRIX = [
    ("Your code & dependencies", "Y", "Y", "Y"),
    ("Build & deploy pipeline", "P", "Y", "Y"),
    ("Scaling rules", "S", "Y", "Y"),
    ("Load balancer & TLS certs", "P", "Y", "Y"),
    ("DNS & CDN", "S", "Y", "Y"),
    ("Network: VPC, subnets, firewalls", "P", "Y", "Y"),
    ("OS patching & container runtime", "P", "P", "Y"),
    ("Servers & data centres", "P", "P", "P"),
]
LBL = {"Y": "You", "P": "Provider", "S": "Shared"}
matrix_rows = "".join(
    f"<tr><th scope='row'>{layer}</th>" + "".join(f"<td class='m m-{v}'>{LBL[v]}</td>" for v in (r, f, e)) + "</tr>"
    for layer, r, f, e in MATRIX
)

CSS = r"""
:root {
  --ground: #f2f3f7; --surface: #ffffff; --ink: #171a2c; --muted: #585e78; --line: #c5cadb;
  --lane: #e7e9f1; --node: #ffffff; --accent: #4a6600; --accent-soft: #e5f2c2; --accent-ink: #2e4000;
  --warn: #a3263a; --warn-soft: #f8e1e4; --you: #fbe3c4; --you-ink: #6a3d00; --prov: #dfe8d0; --prov-ink: #33461a; --shared: #e4e6f3;
  --display: "Newsreader", "Iowan Old Style", Georgia, serif;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --ground: #0e1224; --surface: #151a33; --ink: #e8e6dc; --muted: #a3a9c7; --line: #353d66;
    --lane: #161c38; --node: #0f1429; --accent: #c9f25a; --accent-soft: #28320f; --accent-ink: #dcff8a;
    --warn: #ff8b94; --warn-soft: #3a1820; --you: #3d2a12; --you-ink: #ffcf8f; --prov: #233019; --prov-ink: #c6e79a; --shared: #232a4a;
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --ground: #0e1224; --surface: #151a33; --ink: #e8e6dc; --muted: #a3a9c7; --line: #353d66;
  --lane: #161c38; --node: #0f1429; --accent: #c9f25a; --accent-soft: #28320f; --accent-ink: #dcff8a;
  --warn: #ff8b94; --warn-soft: #3a1820; --you: #3d2a12; --you-ink: #ffcf8f; --prov: #233019; --prov-ink: #c6e79a; --shared: #232a4a;
  color-scheme: dark;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font: 16px/1.6 var(--sans); padding-inline: 16px; }
.page { max-width: 1000px; margin: 0 auto; padding-block: 40px 64px; }
a { color: inherit; text-decoration-color: var(--accent); text-underline-offset: 3px; }
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 3px; }
code { font: .88em var(--mono); background: var(--lane); padding: 1px 5px; border-radius: 4px; }
h1, h2, h3 { font-family: var(--display); font-weight: 500; text-wrap: balance; letter-spacing: -.01em; }
h1 { font-size: clamp(2.2rem, 5vw, 3.4rem); line-height: 1.05; margin: 8px 0 16px; }
h2 { font-size: clamp(1.7rem, 3.4vw, 2.3rem); line-height: 1.1; margin: 4px 0 8px; }
h3 { font-size: 1.25rem; margin: 0 0 12px; }
h4 { font: 600 .74rem/1.3 var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin: 0 0 8px; }
.kicker { font: 500 .78rem var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0; }
.thesis { font-family: var(--display); font-size: clamp(1.15rem, 2.2vw, 1.4rem); line-height: 1.45; max-width: 60ch; margin: 0; }
.thesis em { color: var(--accent-ink); font-style: normal; background: var(--accent-soft); padding: 0 4px; border-radius: 3px; }

.intro-grid { display: grid; gap: 32px; margin-top: 36px; }
@media (min-width: 860px) { .intro-grid { grid-template-columns: 1.1fr 1fr; } }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 20px 22px; }
.numbers { width: 100%; border-collapse: collapse; font-size: .92rem; }
.numbers td, .numbers th { padding: 7px 0; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.numbers tr:last-child td, .numbers tr:last-child th { border-bottom: 0; }
.numbers th { font-weight: 400; color: var(--muted); padding-right: 12px; }
.numbers td { font: 500 .95rem var(--mono); text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.note { font-size: .82rem; color: var(--muted); margin: 12px 0 0; }
.analogy { display: grid; gap: 14px; margin: 0; }
.analogy p { margin: 0; }
.analogy b { font-family: var(--display); font-size: 1.1rem; font-weight: 600; }

.matrix-wrap { overflow-x: auto; margin-top: 12px; }
.matrix { border-collapse: separate; border-spacing: 3px; font-size: .86rem; min-width: 460px; width: 100%; }
.matrix th { text-align: left; font-weight: 400; padding: 6px 8px 6px 0; }
.matrix thead th { font: 600 .72rem var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); text-align: center; }
.m { text-align: center; padding: 6px 8px; border-radius: 5px; font-weight: 500; width: 18%; }
.m-Y { background: var(--you); color: var(--you-ink); }
.m-P { background: var(--prov); color: var(--prov-ink); }
.m-S { background: var(--shared); color: var(--ink); }

.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; font-size: .84rem; color: var(--muted); margin: 28px 0 0; padding: 0; list-style: none; }
.legend li { display: flex; align-items: center; gap: 8px; }
.sw { display: inline-block; width: 26px; height: 16px; border-radius: 4px; border: 1.5px solid var(--line); background: var(--node); }
.sw.new { border-color: var(--accent); background: var(--accent-soft); }
.sw.ghost { border-style: dashed; background: transparent; }
.sw.warn { border-color: var(--warn); border-style: dashed; background: var(--warn-soft); }
.sw.stack { box-shadow: 3px -3px 0 -1.5px var(--node), 3px -3px 0 0 var(--line); }

.nav { position: sticky; top: env(safe-area-inset-top, 0px); z-index: 5; background: var(--ground); margin: 40px -16px 0; padding: 10px 16px; border-bottom: 1px solid var(--line); }
.nav ol { list-style: none; margin: 0 auto; padding: 0; display: flex; gap: 6px; overflow-x: auto; max-width: 1000px; scrollbar-width: none; }
.nav a { display: flex; align-items: center; gap: 8px; white-space: nowrap; text-decoration: none; font-size: .88rem; padding: 6px 12px 6px 6px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); }
.nav a:hover { border-color: var(--accent); }
.nav-n { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--ink); color: var(--ground); font: 600 .75rem var(--mono); }

.stage { padding-block: 56px 8px; scroll-margin-top: 60px; }
.stage + .stage { border-top: 1px solid var(--line); }
.eyebrow { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; font: 500 .78rem var(--mono); letter-spacing: .06em; text-transform: uppercase; }
.eyebrow .num { color: var(--accent-ink); background: var(--accent-soft); padding: 2px 8px; border-radius: 4px; }
.eyebrow .users { color: var(--muted); padding: 2px 0; }
.lede { font-family: var(--display); font-size: 1.2rem; line-height: 1.45; margin: 0 0 10px; max-width: 62ch; }
.trigger { margin: 0; color: var(--muted); max-width: 70ch; font-size: .95rem; }
.trigger b { color: var(--ink); font-weight: 600; }

.diagram { margin: 24px 0 0; }
.scrollx { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 10px; }
.scrollx svg { display: block; width: 100%; min-width: 760px; height: auto; font-family: var(--sans); }
figcaption { font-size: .92rem; color: var(--muted); margin: 12px 2px 0; max-width: 80ch; }
figcaption b { color: var(--ink); }

svg .colhead { fill: var(--muted); font: 600 10.5px var(--sans); letter-spacing: .12em; }
svg .lane { fill: var(--lane); }
svg .lane-name { fill: var(--ink); font: 700 12px var(--mono); letter-spacing: .12em; }
svg .lane-tag { fill: var(--muted); font: 400 12px var(--sans); letter-spacing: 0; }
svg .group { fill: none; stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 4; }
svg .group-label { fill: var(--muted); font: 500 10.5px var(--mono); letter-spacing: .06em; }
svg .box { fill: var(--node); stroke: var(--line); stroke-width: 1.5; }
svg .box.shadow { fill: var(--node); }
svg .t { fill: var(--ink); font: 600 12.5px var(--sans); }
svg .s { fill: var(--muted); font: 400 10.5px var(--sans); }
svg .node.new .box { stroke: var(--accent); fill: var(--accent-soft); stroke-width: 1.8; }
svg .node.ghost .box { fill: none; stroke-dasharray: 4 4; }
svg .node.ghost .t { fill: var(--muted); }
svg .node.warn .box { stroke: var(--warn); fill: var(--warn-soft); }
svg .node.warn .t { fill: var(--warn); }
svg .badge { fill: var(--accent); }
svg .badge-t { fill: var(--ground); font: 700 8.5px var(--mono); letter-spacing: .06em; }
svg .edge path { fill: none; stroke: var(--muted); stroke-width: 1.4; }
svg .edge polygon { fill: var(--muted); }
svg .edge.new path { stroke: var(--accent); stroke-width: 1.8; }
svg .edge.new polygon { fill: var(--accent); }
svg .elabel { fill: var(--ink); font: 500 10px var(--mono); paint-order: stroke; stroke: var(--lane); stroke-width: 4px; stroke-linejoin: round; }
svg .strip { fill: var(--surface); stroke: var(--line); stroke-dasharray: 3 3; }
svg .strip-t { fill: var(--muted); font: 400 11px var(--sans); }
svg .strip-t .k { font-family: var(--mono); }

.stage-body { display: grid; gap: 28px 44px; margin-top: 28px; }
@media (min-width: 860px) { .stage-body { grid-template-columns: 1fr 1.05fr; } }
.brief dl { margin: 0; display: grid; gap: 2px; }
.brief dl > div { display: grid; grid-template-columns: minmax(0, 9.5em) minmax(0, 1fr); gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.brief dl > div:last-child { border-bottom: 0; }
.brief dt { font-weight: 600; font-size: .92rem; }
.brief dd { margin: 0; font-size: .92rem; color: var(--muted); }
@media (max-width: 480px) { .brief dl > div { grid-template-columns: 1fr; gap: 2px; } }
.changes p { margin: 0 0 12px; max-width: 64ch; }
.todo { display: grid; gap: 16px; margin-top: 18px; }
@media (min-width: 560px) { .todo { grid-template-columns: 1fr 1fr; } }
.todo > div { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.todo ul { margin: 0; padding-left: 18px; font-size: .88rem; display: grid; gap: 5px; }

.end { padding-top: 56px; border-top: 1px solid var(--line); margin-top: 48px; }
.summary-wrap { overflow-x: auto; }
.summary { width: 100%; border-collapse: collapse; font-size: .9rem; min-width: 640px; }
.summary th, .summary td { text-align: left; padding: 10px 12px 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
.summary thead th { font: 600 .72rem var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.summary .num { font: 500 .95rem var(--mono); font-variant-numeric: tabular-nums; text-align: right; padding-right: 20px; }
.summary td:last-child { color: var(--muted); }
.next { display: grid; gap: 16px; margin-top: 32px; }
@media (min-width: 760px) { .next { grid-template-columns: 1fr 1fr; } }
.next ol { margin: 0; padding-left: 20px; display: grid; gap: 8px; }
footer { margin-top: 48px; font-size: .82rem; color: var(--muted); }
"""

HTML = f"""<title>MMagika at Scale</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap">
<style>{CSS}</style>

<div class="page">
<header>
  <p class="kicker">MMagika · architecture field notes</p>
  <h1>From one cat to twenty million people</h1>
  <p class="thesis">Raw traffic is not what forces a big architecture. MMagika’s page stores nothing, so 20M users is only ~160 requests a second on average. What forces new parts is <em>remembering things</em>, <em>slow work</em>, <em>many systems reacting to the same events</em>, and <em>serving the whole planet through outages</em>. Each stage below adds exactly one of those.</p>
</header>

<div class="intro-grid">
  <div class="card">
    <h3>20 million users, in requests</h3>
    <table class="numbers">
      <tr><th scope="row">Monthly users</th><td>20,000,000</td></tr>
      <tr><th scope="row">Daily actives (assume 10%)</th><td>2,000,000</td></tr>
      <tr><th scope="row">Requests / day (3 pages + 4 API calls each)</th><td>≈ 14M</td></tr>
      <tr><th scope="row">Average load</th><td>≈ 160 req/s</td></tr>
      <tr><th scope="row">Peak hour (×3)</th><td>≈ 500 req/s</td></tr>
      <tr><th scope="row">Viral spike (×20)</th><td>≈ 3,200 req/s</td></tr>
      <tr><th scope="row">Page bytes / day (40 KB × 6M)</th><td>≈ 240 GB</td></tr>
      <tr><th scope="row">Illustrated scrolls (10% of 2M × 5 s)</th><td>≈ 12 busy workers</td></tr>
    </table>
    <p class="note">Assumptions, not measurements. The local server log shows ~1 ms of work per API call. Change the inputs and the shape of the answer stays the same.</p>
  </div>
  <div class="card">
    <h3>Render vs AWS in one breath</h3>
    <div class="analogy">
      <p><b>Render</b> is a furnished flat. You describe your services in <code>render.yaml</code>, push to git, and it provides the wiring: HTTPS, load balancing, deploys, restarts, private networking, managed databases.</p>
      <p><b>AWS</b> is a builder’s yard. Every piece exists (and more), but you choose, connect, secure and pay for each one: network, balancer, certificates, scaling rules, pipelines.</p>
      <p>Same architecture ideas on both. The difference is <b>who assembles it</b>, and how far you can go before you hit the platform’s edges.</p>
    </div>
    <div class="matrix-wrap">
      <table class="matrix">
        <thead><tr><th scope="col"><span class="sr">Layer</span></th><th scope="col">Render</th><th scope="col">AWS Fargate</th><th scope="col">AWS EC2</th></tr></thead>
        <tbody>{matrix_rows}</tbody>
      </table>
    </div>
  </div>
</div>

<ul class="legend" aria-label="Diagram legend">
  <li><span class="sw"></span>Existing piece</li>
  <li><span class="sw new"></span>New in this stage</li>
  <li><span class="sw stack"></span>Many copies</li>
  <li><span class="sw ghost"></span>Deliberately absent</li>
  <li><span class="sw warn"></span>Known weak spot</li>
</ul>
</div>

<nav class="nav" aria-label="Stages"><ol>{nav}</ol></nav>

<div class="page">
{''.join(stage_html(s) for s in STAGES)}

<section class="end" aria-labelledby="end-h">
  <h2 id="end-h">The whole journey</h2>
  <p class="lede">Count the boxes you have to think about (the plumbing strips aren’t even counted). Render’s lane grows slowly because the platform absorbs the wiring. AWS’s lane grows fast, and so does your control.</p>
  <div class="summary-wrap">
    <table class="summary">
      <thead><tr><th scope="col">Stage</th><th scope="col">When</th><th scope="col" class="num">Render boxes</th><th scope="col" class="num">AWS boxes</th><th scope="col">What Render absorbs or leaves to you</th></tr></thead>
      <tbody>{summary_rows}</tbody>
    </table>
  </div>
  <div class="next">
    <div class="card">
      <h3>What I’d actually do</h3>
      <ol>
        <li>Ship stage 1 on Render today. It costs nothing to learn from.</li>
        <li>Go to stages 2–4 on Render as features demand. They map cleanly onto its web, worker, cron, Postgres and Key Value services.</li>
        <li>Reconsider at stage 5–6, or when the bill, compliance or a missing product (GPUs, global data, Kafka) makes AWS’s assembly worth it. Stateless tiers move easily; plan the data move early.</li>
      </ol>
    </div>
    <div class="card">
      <h3>Already in the code for scale</h3>
      <ol>
        <li>A stateless page: any instance, any region.</li>
        <li><code>/healthz</code>, config from env, one Docker image for every environment.</li>
        <li>All security code in one place: <code>site_security/</code>.</li>
        <li>Per-visitor rate limit in one small file, ready for Redis.</li>
        <li>Next code changes: drop the nonce so the HTML can be cached (stage 2), Redis limiter (stage 3), 202 + job endpoints (stage 4), outbox table (stage 5).</li>
      </ol>
    </div>
  </div>
  <footer>Render facts checked against render.com/docs in September 2026: autoscaling needs a Pro workspace and caps at 100 instances; there’s edge caching for static assets and an HA standby for Postgres. Product names and limits change, so re-check before you rely on one.</footer>
</section>
</div>
"""

HTML = HTML.replace('<span class="sr">Layer</span>', 'Layer')
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(HTML.encode("ascii", "xmlcharrefreplace").decode("ascii"), encoding="utf-8")
print("wrote", OUT, len(HTML) // 1024, "KB")
