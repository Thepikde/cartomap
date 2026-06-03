import { prisma } from "@/lib/db";
export async function GET(){ return Response.json(await prisma.user.findMany()) }
export async function POST(){ return Response.json({}) }
