// Lazy-load all AI SDKs to prevent import-time crashes when packages aren't installed
let _OpenAI = null;
let _InferenceClient = null;
let _GoogleGenerativeAI = null;
let _Cerebras = null;

async function loadOpenAI() {
  if (_OpenAI) return _OpenAI;
  const mod = await import("openai");
  _OpenAI = mod.default;
  return _OpenAI;
}

async function loadInferenceClient() {
  if (_InferenceClient) return _InferenceClient;
  const mod = await import("@huggingface/inference");
  _InferenceClient = mod.InferenceClient;
  return _InferenceClient;
}

async function loadGoogleGenerativeAI() {
  if (_GoogleGenerativeAI) return _GoogleGenerativeAI;
  const mod = await import("@google/generative-ai");
  _GoogleGenerativeAI = mod.GoogleGenerativeAI;
  return _GoogleGenerativeAI;
}

async function loadCerebras() {
  if (_Cerebras) return _Cerebras;
  const mod = await import("@cerebras/cerebras_cloud_sdk");
  _Cerebras = mod.default;
  return _Cerebras;
}

// Lazy-load neon to prevent import-time crashes
let sql = null;
async function getSql() {
  if (sql) return sql;
  try {
    const { neon } = await import("@neondatabase/serverless");
    sql = neon(process.env.DATABASE_URL);
    return sql;
  } catch (err) {
    console.warn("Neon SQL not available:", err.message);
    return null;
  }
}

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

async function getOpenRouterClient() {
  const OpenAI = await loadOpenAI();
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
  });
}

async function getHFClient() {
  const InferenceClient = await loadInferenceClient();
  return new InferenceClient(process.env.HF_API_KEY || "");
}

async function getCerebrasClient() {
  const Cerebras = await loadCerebras();
  return new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY || "" });
}

async function getGeminiClient() {
  const GoogleGenerativeAI = await loadGoogleGenerativeAI();
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
}

async function getGroqClient() {
  const OpenAI = await loadOpenAI();
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
  const client = await getOpenRouterClient();
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
  const client = await getHFClient();
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
  const client = await getCerebrasClient();
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
  const genAI = await getGeminiClient();
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
  const client = await getGroqClient();
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
    const sql = await getSql();
    if (!sql) return false;
    const rows = await sql`
      SELECT cooldown_until FROM ai_provider_cooldowns
      WHERE provider = ${providerName}
      LIMIT 1
    `;
    if (rows.length === 0) return false;
    return new Date(rows[0].cooldown_until).getTime() > Date.now();
  } catch (err) {
    console.warn(`Cooldown check failed for ${providerName}: ${err.message || err}`);
    return false;
  }
}

async function setCooldown(providerName) {
  try {
    const sql = await getSql();
    if (!sql) return;
    const cooldownUntil = new Date(Date.now() + COOLDOWN_MS).toISOString();
    await sql`
      INSERT INTO ai_provider_cooldowns (provider, cooldown_until)
      VALUES (${providerName}, ${cooldownUntil})
      ON CONFLICT (provider) DO UPDATE SET cooldown_until = ${cooldownUntil}
    `;
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