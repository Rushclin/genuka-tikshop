import { Company } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const upsertCompany = async (data: Company): Promise<Company> => {
  const result = await prisma.company.upsert({
    where: {
      id: data.id,
      handle: data.handle as string | undefined,
      OR: [
        {
          id: data.id,
        },
        {
          handle: data.handle,
        },
      ],
    },
    create: {
      ...data,
    },
    update: {
      ...data,
    },
  });

  return result;
};
