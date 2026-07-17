import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const login = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || "Admin";

  if (login && password) {
    const isEmail = login.includes("@");
    const existing = await prisma.user.findFirst({
      where: isEmail ? { email: login } : { username: login },
    });

    const hash = await bcrypt.hash(password, 10);
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { password: hash, name, active: true, isAdmin: true },
      });
    } else {
      await prisma.user.create({
        data: {
          ...(isEmail ? { email: login } : { username: login }),
          name,
          password: hash,
          active: true,
          isAdmin: true,
        },
      });
    }
    console.log(`Admin user ready: ${login}`);
  } else {
    console.log(
      "Skipping admin user — set ADMIN_EMAIL and ADMIN_PASSWORD in .env to seed one."
    );
  }

  const sampleFrames = [
    {
      manufacturer: "Ray-Ban",
      style: "RB3025 Aviator",
      color: "Gold / Green G-15",
      description: "RB3025-001",
      cost: 65,
      retailCost: 180,
      size: "58-14",
    },
    {
      manufacturer: "Oakley",
      style: "Holbrook",
      color: "Matte Black / Prizm",
      description: "OO9102-D655",
      cost: 70,
      retailCost: 196,
      size: "55-18",
    },
    {
      manufacturer: "Persol",
      style: "PO3019S",
      color: "Havana / Brown",
      description: "PO3019S-24",
      cost: 90,
      retailCost: 250,
      size: "52-19",
    },
  ];

  for (const f of sampleFrames) {
    const existingFrame = await prisma.frame.findFirst({
      where: { description: f.description },
    });
    if (!existingFrame) {
      const frame = await prisma.frame.create({ data: f });
      await prisma.item.createMany({
        data: [
          { barcode: `DEMO-${frame.id}-001`, frameId: frame.id },
          { barcode: `DEMO-${frame.id}-002`, frameId: frame.id },
        ],
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
