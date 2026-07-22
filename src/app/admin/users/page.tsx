import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isUserAdmin, syncEnvAdminsToDb } from "@/lib/admin";
import { frameLabel } from "@/lib/inventory-events";
import { getUserDisplayName, getUserLogin } from "@/lib/users";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  AdminAccessPanel,
  type AdminUserRow,
} from "@/components/AdminAccessPanel";
import { SalesExportPanel } from "@/components/SalesExportPanel";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const isAdmin = Boolean(
    (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin
  );
  if (!userId) redirect("/login?callbackUrl=/admin/users");
  if (!isAdmin) redirect("/");

  await syncEnvAdminsToDb();

  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });

  const accessUsers: AdminUserRow[] = await Promise.all(
    users.map(async (u) => {
      const [itemsAdded, sold] = await Promise.all([
        prisma.item.count({ where: { createdById: u.id } }),
        prisma.item.aggregate({
          where: { soldById: u.id },
          _count: { _all: true },
          _sum: { soldPrice: true },
        }),
      ]);
      return {
        id: u.id,
        email: u.email,
        username: u.username,
        login: getUserLogin(u),
        name: u.name,
        active: u.active,
        isAdmin: isUserAdmin(u),
        createdAt: u.createdAt.toISOString(),
        itemsAdded,
        soldCount: sold._count._all,
        soldRevenue: sold._sum.soldPrice ?? 0,
      };
    })
  );

  const [recentAdded, recentSold, recentDeletions, shopTotals] =
    await Promise.all([
      prisma.item.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          frame: { select: { manufacturer: true, style: true } },
          createdBy: { select: { name: true, email: true, username: true } },
        },
      }),
      prisma.item.findMany({
        where: { soldAt: { not: null } },
        orderBy: { soldAt: "desc" },
        take: 15,
        include: {
          frame: { select: { manufacturer: true, style: true } },
          soldBy: { select: { name: true, email: true, username: true } },
        },
      }),
      prisma.inventoryEvent.findMany({
        orderBy: { occurredAt: "desc" },
        take: 15,
        include: {
          actor: { select: { name: true, email: true, username: true } },
        },
      }),
      Promise.all([
        prisma.item.count({ where: { status: "SOLD" } }),
        prisma.item.aggregate({
          where: { status: "SOLD" },
          _sum: { soldPrice: true },
        }),
      ]),
    ]);

  const [soldCount, soldAgg] = shopTotals;

  type ActivityRow = {
    id: string;
    kind: "added" | "sold" | "item_deleted" | "frame_deleted";
    when: Date;
    actor: {
      name: string | null;
      email: string | null;
      username: string | null;
    } | null;
    frameLabel: string;
    barcode: string | null;
    soldPrice?: number | null;
    frameId: string | null;
    stockRemoved?: number;
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
    ...recentDeletions.map<ActivityRow>((e) => {
      const label = frameLabel({
        manufacturer: e.manufacturer ?? "Unknown",
        style: e.style ?? "—",
        color: e.color ?? "—",
        description: e.description,
      });
      const stockRemoved =
        e.kind === "FRAME_DELETED"
          ? (e.inStockCount ?? 0)
          : e.itemStatus === "IN_STOCK"
            ? 1
            : 0;
      return {
        id: "d-" + e.id,
        kind: e.kind === "FRAME_DELETED" ? "frame_deleted" : "item_deleted",
        when: e.occurredAt,
        actor: e.actor ?? null,
        frameLabel: label,
        barcode: e.barcode,
        frameId: e.kind === "FRAME_DELETED" ? null : e.frameId,
        stockRemoved,
      };
    }),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 15);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500">
            {users.length} people · {soldCount} sold ·{" "}
            {formatCurrency(soldAgg._sum.soldPrice ?? 0)} revenue
          </p>
        </div>
      </div>

      <AdminAccessPanel initialUsers={accessUsers} currentUserId={userId} />

      <SalesExportPanel />

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent activity
          </h2>
        </div>
        <ul className="divide-y divide-slate-100 text-sm">
          {activity.length === 0 ? (
            <li className="px-4 py-6 text-center text-slate-400">
              No activity yet.
            </li>
          ) : (
            activity.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-2 hover:bg-slate-50"
              >
                <div className="min-w-0 truncate text-slate-700">
                  <span
                    className={
                      a.kind === "sold"
                        ? "font-medium text-emerald-700"
                        : a.kind === "added"
                          ? "font-medium text-brand-700"
                          : "font-medium text-red-700"
                    }
                  >
                    {a.actor
                      ? getUserDisplayName(a.actor)
                      : "Demo / unassigned"}
                  </span>{" "}
                  {a.kind === "sold" ? (
                    <>
                      sold{" "}
                      <Link
                        href={`/frames/${a.frameId}`}
                        className="text-slate-900 hover:text-brand-700"
                      >
                        {a.frameLabel}
                      </Link>
                      {a.soldPrice != null ? (
                        <span className="text-slate-500">
                          {" "}
                          · {formatCurrency(a.soldPrice)}
                        </span>
                      ) : null}
                    </>
                  ) : a.kind === "added" ? (
                    <>
                      added{" "}
                      <Link
                        href={`/frames/${a.frameId}`}
                        className="text-slate-900 hover:text-brand-700"
                      >
                        {a.frameLabel}
                      </Link>
                    </>
                  ) : a.kind === "frame_deleted" ? (
                    <>
                      deleted frame style{" "}
                      <span className="text-slate-900">{a.frameLabel}</span>
                      {a.stockRemoved ? (
                        <span className="text-slate-500">
                          {" "}
                          · {a.stockRemoved} in stock removed
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      deleted item{" "}
                      {a.frameId ? (
                        <Link
                          href={`/frames/${a.frameId}`}
                          className="text-slate-900 hover:text-brand-700"
                        >
                          {a.frameLabel}
                        </Link>
                      ) : (
                        <span className="text-slate-900">{a.frameLabel}</span>
                      )}
                      {a.barcode ? (
                        <span className="text-slate-500">
                          {" "}
                          · barcode {a.barcode}
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDate(a.when)}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
