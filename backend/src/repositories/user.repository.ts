import { Prisma, Role, User } from "@prisma/client";
import { prisma } from "../config/prisma";

export function findUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export function createUser(data: {
  name: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role?: Role;
}): Promise<User> {
  return prisma.user.create({ data });
}

export function updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
  return prisma.user.update({ where: { id }, data });
}

export interface AdminCustomerListFilters {
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
}

// role: CUSTOMER only - this is customer management, not a general user
// list (vendors are managed via /admin/vendors, admins aren't listable at
// all). passwordHash is never selected - see admin.controller/user
// response DTOs, which never forward it either.
export async function findCustomersForAdmin(filters: AdminCustomerListFilters) {
  const where: Prisma.UserWhereInput = {
    role: Role.CUSTOMER,
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: filters.limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { weddingEvents: true, bookings: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
}
