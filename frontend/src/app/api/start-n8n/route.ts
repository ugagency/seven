import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const payload = await req.json();
        const N8N_URL = "https://automacoes-n8n.infrassys.com/webhook/seven";

        // O Next.js agindo como ponte (Proxy) para o n8n evita erros de CORS
        const res = await fetch(N8N_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            return NextResponse.json({ success: true });
        } else {
            const errorText = await res.text();
            return NextResponse.json({ success: false, detail: errorText }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, detail: error.message }, { status: 500 });
    }
}
