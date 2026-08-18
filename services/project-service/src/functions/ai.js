import {supabase} from "./supabase.js";
import OpenAI from "openai";
import { InferenceClient } from "@huggingface/inference";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Cerebras from "@cerebras/cerebras_cloud_sdk";

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
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
  });
}

function getHFClient() {
  return new InferenceClient(process.env.HF_API_KEY || "");
}

function getCerebrasClient() {
  return new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY || "" });
}

function getGeminiClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
}

function getGroqClient() {
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
  const client = getOpenRouterClient();
  const response = await client.chat.completions.create({
    model: model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: JSON_SYSTEM_INSTRUCTION },
      { role: "user", content: question }
    ]
  });

  return response.choices?.[0]?.message?.content ?? "";
}

async function callHFModel(model, question) {
  const client = getHFClient();
  const response = await client.chatCompletion({
    model: model,
    messages: [
      { role: "system", content: JSON_SYSTEM_INSTRUCTION },
      { role: "user", content: question }
    ],
    temperature: 0.1
  });

  return response.choices?.[0]?.message?.content ?? "";
}

async function callCerebrasModel(model, question) {
  const client = getCerebrasClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: JSON_SYSTEM_INSTRUCTION },
      { role: "user", content: question }
    ],
    temperature: 0.1
  });

  return response.choices?.[0]?.message?.content ?? "";
}

async function callGeminiModel(model, question) {
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
  return result.response.text() ?? "";
}

async function callGroqModel(model, question) {
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

  return response.choices?.[0]?.message?.content ?? "";
}

// ---------------- Cooldown Helpers ----------------

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

async function isOnCooldown(providerName) {
  try {
    const { data, error } = await supabase
      .from("ai_provider_cooldowns")
      .select("cooldown_until")
      .eq("provider", providerName)
      .maybeSingle();

    if (error || !data) return false;
    return new Date(data.cooldown_until).getTime() > Date.now();
  } catch (err) {
    console.warn(`Cooldown check failed for ${providerName}: ${err.message || err}`);
    return false;
  }
}

async function setCooldown(providerName) {
  try {
    const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();
    await supabase
      .from("ai_provider_cooldowns")
      .upsert({ provider: providerName, cooldown_until: cooldownUntil }, { onConflict: "provider" });
  } catch (err) {
    console.warn(`Failed to set cooldown for ${providerName}: ${err.message || err}`);
  }
}

async function tryProviderModels(providerName, models, callFn, question, retries = 1) {
  for (const model of models) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await callFn(model, question);
        if (res) return res;
      } catch (err) {
        const rateLimited = isRateLimited(err);

        if (rateLimited && attempt < retries) {
          const wait = 1000 * Math.pow(2, attempt);
          console.warn(`${providerName} (${model}) rate limited. Retrying in ${wait}ms...`);
          await sleep(wait);
          continue;
        }

        console.warn(`${providerName} (${model}) failed: ${err.message || err}. Trying next model...`);
        break;
      }
    }
  }

  await setCooldown(providerName);
  return null;
}

// ---------------- Main Entry Point ----------------

export async function AI(question) {
  if (!question) return "";

  const chain = [
    { name: "HuggingFace", models: HF_MODELS, fn: callHFModel, enabled: !!process.env.HF_API_KEY },
    { name: "OpenRouter", models: OPENROUTER_MODELS, fn: callOpenRouterModel, enabled: !!process.env.OPENROUTER_API_KEY },
    { name: "Cerebras", models: CEREBRAS_MODELS, fn: callCerebrasModel, enabled: !!process.env.CEREBRAS_API_KEY },
    { name: "Gemini", models: GEMINI_MODELS, fn: callGeminiModel, enabled: !!process.env.GEMINI_API_KEY },
    { name: "Groq", models: GROQ_MODELS, fn: callGroqModel, enabled: !!process.env.GROQ_API_KEY },
  ];

  for (const provider of chain) {
    if (!provider.enabled) {
      console.warn(`${provider.name} skipped — no API key set.`);
      continue;
    }

    if (await isOnCooldown(provider.name)) {
      console.warn(`${provider.name} skipped — on cooldown after recent failure.`);
      continue;
    }

    const result = await tryProviderModels(provider.name, provider.models, provider.fn, question);
    if (result !== null && result !== "") return result;

    console.warn(`All ${provider.name} models failed/exhausted. Falling back to next provider...`);
  }

  console.error("All AI providers failed.");
  return "";
}