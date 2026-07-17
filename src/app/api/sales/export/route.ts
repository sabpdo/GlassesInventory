import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseDateParam, toCsvRow } from "@/lib/csv";
import { requireAdmin } from "@/lib/session";
import { getUserDisplayName } from "@/lib/users";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Use from=YYYY-MM-DD and to=YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const from = parseDateParam(parsed.data.from, false);
  const to = parseDateParam(parsed.data.to, true);
  if (!from || !to || from > to) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  const items = await prisma.item.findMany({
    where: {
      status: "SOLD",
      soldAt: { gte: from, lte: to },
    },
    orderBy: { soldAt: "asc" },
    include: {
      frame: {
        select: {
          manufacturer: true,
          style: true,
          color: true,
          description: true,
        },
      },
      soldBy: { select: { name: true, email: true, username: true } },
    },
  });

  const header = toCsvRow([
    "Sold date",
    "Manufacturer",
    "Style",
    "Color",
    "Description",
    "Barcode",
    "Sold price",
    "Sold by",
  ]);

  const rows = items.map((item) =>
    toCsvRow([
      item.soldAt?.toISOString() ?? "",
      item.frame.manufacturer,
      item.frame.style,
      item.frame.color,
      item.frame.description ?? "",
      item.barcode ?? "",
      item.soldPrice ?? "",
      item.soldBy ? getUserDisplayName(item.soldBy) : "",
    ])
  );

  const csv = [header, ...rows].join("\n");
  const filename = `sales-${parsed.data.from}-to-${parsed.data.to}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
