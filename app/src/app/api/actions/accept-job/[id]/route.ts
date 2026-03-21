import { NextRequest, NextResponse } from "next/server";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-Action-Version": "1",
  "X-Blockchain-Ids": "solana:devnet",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const payload = {
    type: "action",
    title: `Accept Job on SolWork`,
    icon: "https://raw.githubusercontent.com/nicolo-ribaudo/tc39-proposal-symbols-as-weakmap-keys/master/logo.svg",
    description: `Accept this freelance job and start working. Job ID: ${id}`,
    label: "Accept Job",
  };

  return NextResponse.json(payload, { headers: HEADERS });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return NextResponse.json(
    {
      message: `Visit https://solwork.app/jobs/${id} to accept this job.`,
    },
    { status: 200, headers: HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
