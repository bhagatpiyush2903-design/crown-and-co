export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { concern, budget, visitorId } = req.body;

    if (!concern || !budget) {
      return res.status(400).json({ error: 'Missing concern or budget' });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Per-visitor cap: 5 requests
    const countRes = await fetch(
      `${SUPABASE_URL}/rest/v1/crown_requests?select=id&input=ilike.*${encodeURIComponent(visitorId || 'anon')}*`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const countData = await countRes.json();
    if (Array.isArray(countData) && countData.length >= 5) {
      return res.status(429).json({
        error: "You've reached the free try limit for this demo. Thanks for exploring Crown & Co!",
      });
    }

    const systemPrompt = `You are the Crown & Co Glow-Up Advisor, a feature on the Crown & Co salon landing page. Crown & Co is a mid-range, aspirational hair and grooming salon in Siliguri, serving ambitious customers who want to level up their look as their lifestyle and income grow.

A visitor will give you: their current hair/skin concern and their monthly grooming budget in rupees.

Your job: recommend exactly ONE salon service that best fits their concern and budget, explain in one short sentence why it fits their glow-up goals, and give one free at-home tip they can start today. Keep the entire response under 80 words. Tone: warm, aspirational, confident, like a trusted stylist friend.

Services you can recommend from: Keratin Smoothening, Scalp Spa Therapy, Hair Spa, Global Hair Color, Haircut & Styling, Facial & Clean-up, Hair Botox, Beard Grooming, Manicure-Pedicure.

STRICT RULES:
- Never diagnose any medical, dermatological, or scalp/hair health condition. You are not a doctor. If the input describes symptoms suggesting a medical issue (itching, bleeding, hair loss with pain, infection, rash, allergy), do NOT recommend a service for it; instead respond only with: "This sounds like something a dermatologist or doctor should look at rather than a salon service. Please consult a professional."
- Never invent discounts, prices, or promises Crown & Co has not stated.
- Never mention competitor salons or brands.
- If the input is not a hair/skin/grooming concern at all (e.g., unrelated text, abuse, spam), respond only with: "I can only help with hair and grooming concerns for Crown & Co. Please share a concern like frizzy hair, dull skin, or thinning hair."`;

    const userMessage = `Concern: ${concern}\nMonthly grooming budget: ₹${budget}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 300 },
        }),
      }
    );

    const geminiData = await geminiRes.json();
    const outputText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate a suggestion right now. Please try again.";

    const inputTokens = geminiData?.usageMetadata?.promptTokenCount || 0;
    const outputTokens = geminiData?.usageMetadata?.candidatesTokenCount || 0;

    // Save the exchange to Supabase
    await fetch(`${SUPABASE_URL}/rest/v1/crown_requests`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        input: `[${visitorId || 'anon'}] ${userMessage}`,
        output: outputText,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      }),
    });

    return res.status(200).json({ result: outputText });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
