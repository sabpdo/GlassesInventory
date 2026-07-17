import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserAdmin } from "@/lib/admin";
import { getUserDisplayName, getUserInitials, getUserLogin } from "@/lib/users";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login?callbackUrl=/profile");

  const [user, framesCreated, itemsCreated, soldStats, todayStats, recentSold] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.frame.count({ where: { createdById: userId } }),
      prisma.item.count({ where: { createdById: userId } }),
      prisma.item.aggregate({
        where: { soldById: userId },
        _count: { _all: true },
        _sum: { soldPrice: true },
      }),
      prisma.item.aggregate({
        where: {
          soldById: userId,
          soldAt: { gte: startOfToday() },
        },
        _count: { _all: true },
        _sum: { soldPrice: true },
      }),
      prisma.item.findMany({
        where: { soldById: userId },
        orderBy: { soldAt: "desc" },
        take: 10,
        include: { frame: true },
      }),
    ]);

  if (!user) redirect("/login");

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const login = getUserLogin(user);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to inventory
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Profile</h1>
      </div>

      <div className="card flex flex-wrap items-center gap-4 p-6">
        <div
          aria-hidden
          className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-xl font-semibold text-white"
        >
          {initials}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold text-slate-900">
              {displayName}
            </div>
            {isUserAdmin(user) ? (
              <span
                title="You're an admin — you can see Team activity from the navbar"
                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
              >
                Admin
              </span>
            ) : null}
          </div>
          <div className="text-sm text-slate-500">{login}</div>
          <div className="mt-1 text-xs text-slate-400">
            Member since {formatDate(user.createdAt)}
          </div>
        </div>
        {isUserAdmin(user) ? (
          <Link href="/admin/users" className="btn-secondary">
            Team activity →
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Frames created"
          value={String(framesCreated)}
          accent="brand"
        />
        <Stat label="Items added" value={String(itemsCreated)} accent="brand" />
        <Stat
          label="Items sold"
          value={String(soldStats._count._all)}
          sub={formatCurrency(soldStats._sum.soldPrice ?? 0) + " total"}
          accent="emerald"
        />
        <Stat
          label="Sold today"
          value={String(todayStats._count._all)}
          sub={formatCurrency(todayStats._sum.soldPrice ?? 0) + " today"}
          accent="amber"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">
            Recent sales
          </h2>
          <p className="text-xs text-slate-500">
            Last 10 items you marked as sold.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Frame</th>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3 text-right">Sold price</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {recentSold.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No sales yet. Scanned sales show up here.
                  </td>
                </tr>
              ) : (
                recentSold.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(it.soldAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      {it.frame.manufacturer} · {it.frame.style}
                      <div className="text-xs text-slate-500">
                        {it.frame.color} · {it.frame.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {it.barcode ?? (
                        <span className="font-sans italic text-slate-400">
                          no barcode
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatCurrency(it.soldPrice)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/frames/${it.frameId}`}
                        className="text-sm font-medium text-brand-700 hover:text-brand-600"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
