import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/admin";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) redirect("/login?callbackUrl=/admin/users");
  if (!isAdminEmail(email)) {
    // Non-admins shouldn't even know this page exists.
    redirect("/");
  }

  // ---- Per-user roll-up ----------------------------------------------------
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });

  const startOfDay = startOfToday();
  const startOfWeek = startOfThisWeek();

  const perUser = await Promise.all(
    users.map(async (u) => {
      const [
        framesCreated,
        itemsCreated,
        soldAllTime,
        soldToday,
        soldThisWeek,
        lastFrame,
        lastItem,
        lastSale,
      ] = await Promise.all([
        prisma.frame.count({ where: { createdById: u.id } }),
        prisma.item.count({ where: { createdById: u.id } }),
        prisma.item.aggregate({
          where: { soldById: u.id },
          _count: { _all: true },
          _sum: { soldPrice: true },
        }),
        prisma.item.aggregate({
          where: { soldById: u.id, soldAt: { gte: startOfDay } },
          _count: { _all: true },
          _sum: { soldPrice: true },
        }),
        prisma.item.aggregate({
          where: { soldById: u.id, soldAt: { gte: startOfWeek } },
          _count: { _all: true },
          _sum: { soldPrice: true },
        }),
        prisma.frame.findFirst({
          where: { createdById: u.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.item.findFirst({
          where: { createdById: u.id },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
        prisma.item.findFirst({
          where: { soldById: u.id },
          orderBy: { soldAt: "desc" },
          select: { soldAt: true },
        }),
      ]);
      const lastActiveAt = latestDate([
        lastFrame?.createdAt ?? null,
        lastItem?.createdAt ?? null,
        lastSale?.soldAt ?? null,
      ]);
      return {
        user: u,
        framesCreated,
        itemsCreated,
        soldAllTime,
        soldToday,
        soldThisWeek,
        lastActiveAt,
      };
    })
  );

  // ---- Recent activity feed ------------------------------------------------
  // Two pools (added items + sold items) merged and trimmed to the latest 20.
  const [recentAdded, recentSold] = await Promise.all([
    prisma.item.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        frame: { select: { manufacturer: true, style: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.item.findMany({
      where: { soldAt: { not: null } },
      orderBy: { soldAt: "desc" },
      take: 20,
      include: {
        frame: { select: { manufacturer: true, style: true } },
        soldBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  type ActivityRow = {
    id: string;
    kind: "added" | "sold";
    when: Date;
    actor: { name: string | null; email: string } | null;
    frameLabel: string;
    barcode: string | null;
    soldPrice?: number | null;
    frameId: string;
  };
  const activity: ActivityRow[] = [
    ...recentAdded.map<ActivityRow>((i) => ({
      id: "a-" + i.id,
      kind: "added",
      when: i.createdAt,
      actor: i.createdBy ?? null,
      frameLabel: `${i.frame.manufacturer} · ${i.frame.style}`,
      barcode: i.barcode,
      frameId: i.frameId,
    })),
    ...recentSold.map<ActivityRow>((i) => ({
      id: "s-" + i.id,
      kind: "sold",
      when: i.soldAt!,
      actor: i.soldBy ?? null,
      frameLabel: `${i.frame.manufacturer} · ${i.frame.style}`,
      barcode: i.barcode,
      soldPrice: i.soldPrice,
      frameId: i.frameId,
    })),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 20);

  // ---- Shop totals --------------------------------------------------------
  const totals = perUser.reduce(
    (acc, p) => {
      acc.frames += p.framesCreated;
      acc.items += p.itemsCreated;
      acc.soldCount += p.soldAllTime._count._all;
      acc.soldRevenue += p.soldAllTime._sum.soldPrice ?? 0;
      acc.todayCount += p.soldToday._count._all;
      acc.todayRevenue += p.soldToday._sum.soldPrice ?? 0;
      return acc;
    },
    {
      frames: 0,
      items: 0,
      soldCount: 0,
      soldRevenue: 0,
      todayCount: 0,
      todayRevenue: 0,
    }
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-slate-900">
            Team activity
          </h1>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Admin
          </span>
        </div>
        <p className="text-sm text-slate-500">
          Everyone who has access to this shop, what they&apos;ve done, and
          when. Visible to admins only (set via <code>ADMIN_EMAILS</code>).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="People"
          value={String(users.length)}
          accent="brand"
        />
        <Stat
          label="Frames created"
          value={String(totals.frames)}
          sub={`${totals.items} items added`}
          accent="brand"
        />
        <Stat
          label="Items sold"
          value={String(totals.soldCount)}
          sub={formatCurrency(totals.soldRevenue) + " total"}
          accent="emerald"
        />
        <Stat
          label="Sold today"
          value={String(totals.todayCount)}
          sub={formatCurrency(totals.todayRevenue) + " today"}
          accent="amber"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">People</h2>
          <p className="text-xs text-slate-500">
            Sorted by sign-up date. Last active = the most recent time they
            added a frame, added an item, or marked one sold.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3 text-right">Frames</th>
                <th className="px-4 py-3 text-right">Items added</th>
                <th className="px-4 py-3 text-right">Sold (all-time)</th>
                <th className="px-4 py-3 text-right">Sold this week</th>
                <th className="px-4 py-3 text-right">Sold today</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {perUser.map((p) => {
                const isMe = p.user.email === email;
                const youAreAdmin = isAdminEmail(p.user.email);
                return (
                  <tr key={p.user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {p.user.name?.trim() || p.user.email.split("@")[0]}
                        </span>
                        {isMe ? (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            you
                          </span>
                        ) : null}
                        {youAreAdmin ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            admin
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-slate-500">
                        {p.user.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(p.user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {p.lastActiveAt ? (
                        formatDate(p.lastActiveAt)
                      ) : (
                        <span className="text-slate-300">never</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {p.framesCreated}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {p.itemsCreated}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="font-medium text-slate-900">
                        {p.soldAllTime._count._all}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatCurrency(p.soldAllTime._sum.soldPrice ?? 0)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="font-medium text-slate-900">
                        {p.soldThisWeek._count._all}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatCurrency(p.soldThisWeek._sum.soldPrice ?? 0)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <div className="font-medium text-slate-900">
                        {p.soldToday._count._all}
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatCurrency(p.soldToday._sum.soldPrice ?? 0)}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {perUser.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    No users yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Recent activity
          </h2>
          <p className="text-xs text-slate-500">
            Last 20 events across the whole shop.
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {activity.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-slate-400">
              No activity yet.
            </li>
          ) : (
            activity.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      "inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold " +
                      (a.kind === "sold"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-brand-100 text-brand-700")
                    }
                    aria-hidden
                  >
                    {a.kind === "sold" ? "$" : "+"}
                  </span>
                  <div>
                    <div className="text-slate-900">
                      <span className="font-medium">
                        {a.actor
                          ? a.actor.name?.trim() || a.actor.email.split("@")[0]
                          : "Someone"}
                      </span>{" "}
                      {a.kind === "sold" ? "sold" : "added"}{" "}
                      <Link
                        href={`/frames/${a.frameId}`}
                        className="text-brand-700 hover:text-brand-600"
                      >
                        {a.frameLabel}
                      </Link>
                      {a.kind === "sold" && a.soldPrice != null ? (
                        <span className="text-slate-500">
                          {" "}
                          for {formatCurrency(a.soldPrice)}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-slate-400">
                      {a.actor?.email ?? "unknown user"} ·{" "}
                      <span className="font-mono">
                        {a.barcode ?? "no barcode"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {formatDate(a.when)}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "brand" | "emerald" | "amber";
}) {
  const accentBg = {
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  }[accent];
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={
            "inline-flex min-w-[2.5rem] justify-center rounded-md px-2 py-1 text-lg font-semibold tabular-nums " +
            accentBg
          }
        >
          {value}
        </span>
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </div>
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfThisWeek(): Date {
  const d = startOfToday();
  // Treat Monday as the start of the week.
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function latestDate(dates: (Date | null)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    if (d && (!best || d > best)) best = d;
  }
  return best;
}
