const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function jsonResponse(res, status, payload) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(payload));
}

function normalizeDate(text) {
  if (!text) return "";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function heuristicExtraction(message) {
  const text = `${message.subject || ""}\n${message.snippet || ""}\n${message.bodyText || ""}`.toLowerCase();
  const deadlineMatch = text.match(/(?:deadline|complete by|submit by|by)\s+([a-z]{3,9}\s+\d{1,2},?\s+\d{4})/i);
  const interviewMatch = text.match(/interview(?:\s+on|\s+scheduled for|\s+is)?\s+([a-z]{3,9}\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:am|pm))?)/i);

  const currentStage = text.includes("online assessment") || text.includes("coding challenge")
    ? "OA"
    : text.includes("final round")
      ? "Final Round"
      : text.includes("second round")
        ? "Round 2"
        : text.includes("first round") || text.includes("technical screen") || text.includes("phone screen")
          ? "Round 1"
          : text.includes("offer")
            ? "Offer"
            : text.includes("reject")
              ? "Rejected"
              : "";

  return {
    shouldUpdate: Boolean(currentStage),
    currentStage,
    oaDeadline: currentStage === "OA" ? normalizeDate(deadlineMatch?.[1]) : "",
    round1Date: currentStage === "Round 1" ? normalizeDate(interviewMatch?.[1]) : "",
    round2Date: currentStage === "Round 2" ? normalizeDate(interviewMatch?.[1]) : "",
    finalRoundDate: currentStage === "Final Round" ? normalizeDate(interviewMatch?.[1]) : "",
    outcome: currentStage === "Offer" || currentStage === "Rejected" ? currentStage : "",
    gmailThreadId: message.threadId || "",
    confidence: currentStage ? 0.35 : 0.1,
  };
}

async function llmExtraction(message) {
  if (!process.env.OPENAI_API_KEY) {
    return heuristicExtraction(message);
  }

  const prompt = [
    "Extract job-application pipeline updates from this Gmail message.",
    "Return only minified JSON with keys:",
    "shouldUpdate,companyName,jobTitle,jobUrl,currentStage,oaDeadline,round1Date,round1Deadline,round2Date,round2Deadline,finalRoundDate,finalRoundDeadline,outcome,gmailThreadId,confidence",
    'Use empty strings for unknown fields. currentStage must be one of "", "OA", "Round 1", "Round 2", "Final Round", "Offer", "Rejected".',
    `Message subject: ${message.subject || ""}`,
    `Message from: ${message.from || ""}`,
    `Message date: ${message.date || ""}`,
    `Message snippet: ${message.snippet || ""}`,
    `Message body: ${message.bodyText || ""}`,
  ].join("\n");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You extract structured hiring-stage data from recruiting emails and respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI API returned an unexpected response.");
  }

  return JSON.parse(content);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    jsonResponse(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const message = req.body?.message;
    if (!message || typeof message !== "object") {
      jsonResponse(res, 400, { error: "Missing message payload" });
      return;
    }

    const extraction = await llmExtraction(message);
    jsonResponse(res, 200, {
      ...heuristicExtraction(message),
      ...extraction,
      gmailThreadId: extraction.gmailThreadId || message.threadId || "",
      lastGmailSync: new Date().toISOString(),
    });
  } catch (error) {
    jsonResponse(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
  }
};
