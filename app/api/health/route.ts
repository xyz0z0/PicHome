import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const HEALTHY_STATUS = "ok";
const UNHEALTHY_STATUS = "error";
const HEALTHY_HTTP_STATUS = 200;
const UNHEALTHY_HTTP_STATUS = 503;
const DB_PING_SQL = "SELECT 1";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    await prisma.$queryRawUnsafe(DB_PING_SQL);

    return NextResponse.json(
      {
        status: HEALTHY_STATUS,
        checkedAt,
      },
      { status: HEALTHY_HTTP_STATUS }
    );
  } catch {
    return NextResponse.json(
      {
        status: UNHEALTHY_STATUS,
        checkedAt,
      },
      { status: UNHEALTHY_HTTP_STATUS }
    );
  }
}
