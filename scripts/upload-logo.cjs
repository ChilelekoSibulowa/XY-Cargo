const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const parseEnv = () => {
  const envPath = path.resolve(process.cwd(), ".env");
  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    let value = rest.join("=").trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key.trim()] = value;
  }
  return env;
};

const run = async () => {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/upload-logo.cjs <path-to-logo>");
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const env = parseEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const buffer = fs.readFileSync(filePath);
  const { error } = await supabase.storage
    .from("branding")
    .upload("logo/logo.png", buffer, { upsert: true, contentType: "image/png" });

  if (error) {
    console.error("Upload failed:", error.message);
    process.exit(1);
  }

  const { data } = supabase.storage.from("branding").getPublicUrl("logo/logo.png");
  console.log("Uploaded logo to:", data.publicUrl);
};

run();
