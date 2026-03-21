import { NextResponse } from "next/server";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "X-Action-Version": "1",
  "X-Blockchain-Ids": "solana:devnet",
};

export async function GET() {
  const payload = {
    type: "action",
    title: "Post a Job on Accord",
    icon: "https://raw.githubusercontent.com/nicolo-ribaudo/tc39-proposal-symbols-as-weakmap-keys/master/logo.svg",
    description:
      "Create a freelance job and lock USDC in a trustless escrow on Solana. Freelancers can accept, deliver work, and get paid instantly.",
    label: "Post Job",
    links: {
      actions: [
        {
          label: "Post a Job",
          href: "/api/actions/post-job",
          parameters: [
            { name: "title", label: "Job Title", required: true },
            { name: "amount", label: "Amount (USDC)", required: true },
          ],
        },
      ],
    },
  };

  return NextResponse.json(payload, { headers: HEADERS });
}

export async function POST() {
  // For MVP: return instructions to visit the app
  // Full implementation would build the transaction here
  return NextResponse.json(
    {
      message:
        "Visit https://accord.work/post to create a job with full form support.",
    },
    { status: 200, headers: HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: HEADERS });
}
