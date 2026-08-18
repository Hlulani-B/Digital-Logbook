import {supabase} from "./supabase.js";
import OpenAI from "openai";
import { InferenceClient } from "@huggingface/inference";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Cerebras from "@cerebras/cerebras_cloud_sdk";

console.log("[AI] Module loaded. Checking env vars...");
console.log("[AI] HF_API_KEY:", process.env.HF_API_KEY ? "SET (" + process.env.HF_API_KEY.slice(0, 8) + "...)" : "NOT SET");
console.log("[AI] OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "SET (" + process.env.OPENROUTER_API_KEY.slice(0, 8) + "...)" : "NOT SET");
console.log("[AI] CEREBRAS_API_KEY:", process.env.CEREBRAS_API_KEY ? "SET (" + process.env.CEREBRAS_API_KEY.slice(0, 8) + "...)" : "NOT SET");
console.log("[AI] GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "SET (" + process.env.GEMINI_API_KEY.slice(0, 8) + "...)" : "NOT SET");
console.log("[AI] GROQ_API_KEY:", process.env.GROQ_API_KEY ? "SET (" + process.env.GROQ_API_KEY.slice(0, 8) + "...)" : "NOT SET");
console.log("[AI] Supabase client:", supabase ? "available" : "NULL");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const JSON_SYSTEM_INSTRUCTION = 
  "You are a strict JSON-only API. You must respond with valid JSON and NOTHING ELSE. " +
  "Do not include markdown blocks (```json), explanations, preambles, or postscripts.";

// ---------------- Model Arrays ----------------

const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "google/gemma-3-27b-it:free"
];

const CEREBRAS_MODELS = [
  "llama-3.3-70b",
  "llama3.1-8b"
];

const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash"
];

const HF_MODELS = [
  "deepseek-ai/DeepSeek-R1",
  "meta-llama/Llama-3.3-70B-Instruct"
];

const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant"
];

// ---------------- Lazy SDK Instantiators ----------------

function getOpenRouterClient() {
  console.log("[AI][OpenRouter] Creating client, key present:", !!process.env.OPENROUTER_API_KEY);
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
  });
}

function getHFClient() {
  console.log("[AI][HuggingFace] Creating client, key present:", !!process.env.HF_API_KEY);
  return new InferenceClient(process.env.HF_API_KEY || "");
}

function getCerebrasClient() {
  console.log("[AI][Cerebras] Creating client, key present:", !!process.env.CEREBRAS_API_KEY);
  return new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY || "" });
}

function getGeminiClient() {
  console.log("[AI][Gemini] Creating client, key present:", !!process.env.GEMINI_API_KEY);
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
}

function getGroqClient() {
  console.log("[AI][Groq] Creating client, key present:", !!process.env.GROQ_API_KEY);
  return new OpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY || "",
  });
}

// ---------------- Robust Error Helper ----------------

function isRateLimited(err) {
  const status = err?.status ?? err?.statusCode ?? err?.response?.status;
  const message = (
    err?.error?.message || 
    err?.message || 
    JSON.stringify(err || {})
  ).toLowerCase();

  console.log("[AI][isRateLimited] status:", status, "message snippet:", message.slice(0, 100));

  return (
    status === 429 ||
    status === 503 ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    message.includes("tokens per day") ||
    message.includes("resource_exhausted") ||
    message.includes("try again later")
  );
}

// ---------------- Provider Callers ----------------

async function callOpenRouterModel(model, question) {
  console.log("[AI][OpenRouter] Calling model:", model);
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: JSON_SYSTEM_INSTRUCTION },
      { role: "user", content: question }
    ]
  });
  const content = response.choices?.[0]?.message?.content ?? "";
  console.log("[AI][OpenRouter] Got response, length:", content.length, "preview:", content.slice(0, 100));
  return content;
}

async function callHFModel(model, question) {
  console.log("[AI][HuggingFace] Calling model:", model);
  const client = getHFClient();
  const response = await client.chatCompletion({
    model: model,
    messages: [
      { role: "system", content: JSON_SYSTEM_INSTRUCTION },
      { role: "user", content: question }
    ],
    temperature: 0.1
  });
  const content = response.choices?.[0]?.message?.content ?? "";
  console.log("[AI][HuggingFace] Got response, length:", content.length, "preview:", content.slice(0, 100));
  return content;
}

async function callCerebrasModel(model, question) {
  console.log("[AI][Cerebras] Calling model:", model);
  const client = getCerebrasClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: JSON_SYSTEM_INSTRUCTION },
      { role: "user", content: question }
    ],
    temperature: 0.1
  });
  const content = response.choices?.[0]?.message?.content ?? "";
  console.log("[AI][Cerebras] Got response, length:", content.length, "preview:", content.slice(0, 100));
  return content;
}

async function callGeminiModel(model, question) {
  console.log("[AI][Gemini] Calling model:", model);
  const genAI = getGeminiClient();
  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1
    },
    systemInstruction: JSON_SYSTEM_INSTRUCTION
  });
  const result = await geminiModel.generateContent(question);
  const content = result.response.text() ?? "";
  console.log("[AI][Gemini] Got response, length:", content.length, "preview:", content.slice(0, 100));
  return content;
}

async function callGroqModel(model, question) {
  console.log("[AI][Groq] Calling model:", model);
  const client = getGroqClient();
  const response = await client.chat.completions.create({
    model: model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: JSON_SYSTEM_INSTRUCTION },
      { role: "user", content: question }
    ],
    temperature: 0.1
  });
  const content = response.choices?.[0]?.message?.content ?? "";
  console.log("[AI][Groq] Got response, length:", content.length, "preview:", content.slice(0, 100));
  return content;
}

// ---------------- Cooldown Helpers ----------------

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

async function isOnCooldown(providerName) {
  console.log("[AI][Cooldown] Checking cooldown for:", providerName);
  try {
    if (!supabase) {
      console.log("[AI][Cooldown] Supabase is NULL, skipping cooldown check");
      return false;
    }
    const { data, error } = await supabase
      .from("ai_provider_cooldowns")
      .select("cooldown_until")
      .eq("provider", providerName)
      .maybeSingle();

    if (error) {
      console.log("[AI][Cooldown] Error for", providerName, ":", error.message);
      return false;
    }
    if (!data) {
      console.log("[AI][Cooldown] No cooldown record for", providerName);
      return false;
    }
    const isHot = new Date(data.cooldown_until).getTime() > Date.now();
    console.log("[AI][Cooldown]", providerName, "cooldown_until:", data.cooldown_until, "is on cooldown:", isHot);
    return isHot;
  } catch (err) {
    console.warn("[AI][Cooldown] Check failed for", providerName, ":", err.message || err);
    return false;
  }
}

async function setCooldown(providerName) {
  console.log("[AI][Cooldown] Setting cooldown for:", providerName);
  try {
    if (!supabase) {
      console.log("[AI][Cooldown] Supabase is NULL, cannot set cooldown");
      return;
    }
    const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();
    console.log("[AI][Cooldown] Until:", cooldownUntil);
    await supabase
      .from("ai_provider_cooldowns")
      .upsert({ provider: providerName, cooldown_until: cooldownUntil }, { onConflict: "provider" });
    console.log("[AI][Cooldown] Set successfully for", providerName);
  } catch (err) {
    console.warn("[AI][Cooldown] Failed to set for", providerName, ":", err.message || err);
  }
}

async function tryProviderModels(providerName, models, callFn, question, retries = 1) {
  console.log("[AI][TryProvider]", providerName, "- trying", models.length, "models with", retries, "retries");
  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      console.log("[AI][TryProvider]", providerName, "- model:", model, "attempt:", attempt + 1);
      try {
        const res = await callFn(model, question);
        if (res) {
          console.log("[AI][TryProvider]", providerName, "- SUCCESS with model:", model);
          return res;
        }
        console.log("[AI][TryProvider]", providerName, "- empty response from model:", model);
      } catch (err) {
        console.error("[AI][TryProvider]", providerName, "- ERROR with model:", model, "attempt:", attempt + 1, "error:", err.message || err);
        const rateLimited = isRateLimited(err);
        console.log("[AI][TryProvider]", providerName, "- isRateLimited:", rateLimited);

        if (rateLimited && attempt < retries) {
          const wait = 1000 * Math.pow(2, attempt);
          console.warn("[AI][TryProvider]", providerName, "rate limited. Retrying in", wait, "ms...");
          await sleep(wait);
          continue;
        }

        console.warn("[AI][TryProvider]", providerName, "- moving to next model. Error:", err.message || err);
        break;
      }
    }
  }

  console.log("[AI][TryProvider]", providerName, "- ALL models exhausted, setting cooldown");
  await setCooldown(providerName);
  return null;
}

// ---------------- Main Entry Point ----------------

export async function AI(question) {
  console.log("[AI] ===== AI() called =====");
  console.log("[AI] Question length:", question?.length, "preview:", question?.slice(0, 80));
  if (!question) {
    console.log("[AI] Empty question, returning empty string");
    return "";
  }

  const chain = [
    { name: "HuggingFace", models: HF_MODELS, fn: callHFModel, enabled: !!process.env.HF_API_KEY },
    { name: "OpenRouter", models: OPENROUTER_MODELS, fn: callOpenRouterModel, enabled: !!process.env.OPENROUTER_API_KEY },
    { name: "Cerebras", models: CEREBRAS_MODELS, fn: callCerebrasModel, enabled: !!process.env.CEREBRAS_API_KEY },
    { name: "Gemini", models: GEMINI_MODELS, fn: callGeminiModel, enabled: !!process.env.GEMINI_API_KEY },
    { name: "Groq", models: GROQ_MODELS, fn: callGroqModel, enabled: !!process.env.GROQ_API_KEY },
  ];

  console.log("[AI] Provider chain status:");
  chain.forEach(p => console.log("[AI]  ", p.name, "- enabled:", p.enabled, "models:", p.models.length));

  for (const provider of chain) {
    if (!provider.enabled) {
      console.log("[AI] Skipping", provider.name, "- no API key set");
      continue;
    }

    if (await isOnCooldown(provider.name)) {
      console.log("[AI] Skipping", provider.name, "- on cooldown");
      continue;
    }

    console.log("[AI] Trying provider:", provider.name);
    const result = await tryProviderModels(provider.name, provider.models, provider.fn, question);
    if (result !== null && result !== "") {
      console.log("[AI] SUCCESS from", provider.name, "- response length:", result.length);
      return result;
    }

    console.log("[AI] Provider", provider.name, "failed, moving to next...");
  }

  console.error("[AI] ===== ALL AI PROVIDERS FAILED =====");
  return "";
}
