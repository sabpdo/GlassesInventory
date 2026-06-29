import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@example.com";
  const password = "admin123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        name: "Admin",
        password: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Created default user: ${email} / ${password}`);
  } else {
    console.log(`Default user already exists: ${email}`);
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
      // Seed a couple of in-stock items per frame.
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
