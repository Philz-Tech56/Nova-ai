import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "OPENAI_API_KEY"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(",").map((value) => value.trim())
    : false,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api", rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

function asyncHandler(handler) {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}

const requireUser = asyncHandler(async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!token) {
    return res.status(401).json({ error: "Sign in to continue." });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({
      error: "Your session is invalid or expired."
    });
  }

  req.user = data.user;
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "Nova AI API" });
});

app.post("/api/chat", requireUser, asyncHandler(async (req, res) => {
  const message = typeof req.body?.message === "string"
    ? req.body.message.trim()
    : "";
  const conversationId =
    typeof req.body?.conversationId === "string"
      ? req.body.conversationId
      : null;

  if (!message) {
    return res.status(400).json({ error: "A message is required." });
  }
  if (message.length > 12000) {
    return res.status(400).json({
      error: "Message is too long (12,000 characters maximum)."
    });
  }

  let activeConversationId = conversationId;
  if (activeConversationId) {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", activeConversationId)
      .eq("user_id", req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }
  } else {
    const { data: conversation, error } = await supabase
      .from("conversations")
      .insert({
        user_id: req.user.id,
        title: message.slice(0, 72)
      })
      .select("id")
      .single();

    if (error) throw error;
    activeConversationId = conversation.id;
  }

  const { error: userMessageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      user_id: req.user.id,
      role: "user",
      content: message
    });
  if (userMessageError) throw userMessageError;

  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", activeConversationId)
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: true })
    .limit(30);

  if (historyError) throw historyError;

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    instructions:
      "You are Nova AI, a helpful, clear, and reliable AI assistant. " +
      "Be honest about uncertainty and capabilities.",
    input: (history || []).map((item) => ({
      role: item.role,
      content: item.content
    }))
  });

  const answer = response.output_text?.trim();
  if (!answer) {
    throw new Error("The AI provider returned an empty response.");
  }

  const { error: assistantMessageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: activeConversationId,
      user_id: req.user.id,
      role: "assistant",
      content: answer
    });

  if (assistantMessageError) throw assistantMessageError;

  res.json({
    conversationId: activeConversationId,
    reply: answer
  });
}));

app.use((err, _req, res, _next) => {
  console.error("Nova API error:", err?.message || err);
  res.status(500).json({
    error: "Something went wrong. Please try again."
  });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Nova AI API listening on port ${port}`);
});
