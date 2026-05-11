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

const getAllImageFiles = (dirPath, relativeTo = dirPath) => {
  const files = [];
  const items = fs.readdirSync(dirPath);
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...getAllImageFiles(fullPath, relativeTo));
    } else if (stat.isFile() && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item)) {
      files.push(path.relative(relativeTo, fullPath));
    }
  }
  return files;
};

const run = async () => {
  const env = parseEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const publicDir = path.resolve(process.cwd(), "public");
  const imageFiles = getAllImageFiles(publicDir);

  console.log(`Found ${imageFiles.length} image files to upload.`);

  for (const file of imageFiles) {
    const filePath = path.join(publicDir, file);
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(file).toLowerCase();
    let contentType = "image/jpeg";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".webp") contentType = "image/webp";
    else if (ext === ".svg") contentType = "image/svg+xml";

    const { error } = await supabase.storage
      .from("branding")
      .upload(file, buffer, { upsert: true, contentType });

    if (error) {
      console.error(`Upload failed for ${file}:`, error.message);
    } else {
      console.log(`Uploaded ${file}`);
    }
  }

  console.log("All uploads completed.");
};

run();