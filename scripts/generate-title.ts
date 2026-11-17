import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const COMFY_URL = process.env.COMFYUI_URL || "http://127.0.0.1:8188";
const WORKFLOW_PATH = path.resolve("scripts/hex_tile_api.json");

const STYLE_PREFIX =
  "2.5D stylized strategy game art illustration, single isolated six-sided hexagon terrain tile, ";
const STYLE_SUFFIX =
  " rising on top of a cutaway brown soil hexagonal base, isolated on a pure solid white background, vibrant hand-painted RPG map asset";

async function main() {
  const [biomePrompt, outputArg] = process.argv.slice(2);

  if (!biomePrompt || !outputArg) {
    console.error('Usage: node scripts/generate-title.ts "<biome description>" <output-path>');
    process.exit(1);
  }

  const raw = await readFile(WORKFLOW_PATH, "utf-8");
  const workflow = JSON.parse(raw);

  if (workflow.nodes) {
    throw new Error(
      "scripts/hex_tile_api.json is in UI format. Re-export it from ComfyUI using Workflow -> Export (API)."
    );
  }

  // Locate KSampler dynamically and trace its positive prompt node
  const ksamplerEntry = Object.entries(workflow).find(
    ([, node]: [string, any]) => node.class_type === "KSampler"
  ) as [string, any] | undefined;

  if (!ksamplerEntry) {
    throw new Error("Could not find a KSampler node in hex_tile_api.json.");
  }

  const [, ksampler] = ksamplerEntry;
  ksampler.inputs.seed = Math.floor(Math.random() * 1_000_000_000_000);

  const positiveNodeId = String(ksampler.inputs.positive[0]);
  if (workflow[positiveNodeId]?.inputs?.text !== undefined) {
    workflow[positiveNodeId].inputs.text = `${STYLE_PREFIX}${biomePrompt}${STYLE_SUFFIX}`;
  }

  // 1. Queue the prompt in ComfyUI
  const queueRes = await fetch(`${COMFY_URL}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: workflow }),
  });

  if (!queueRes.ok) {
    throw new Error(`ComfyUI API error (${queueRes.status}): ${await queueRes.text()}`);
  }

  const { prompt_id } = (await queueRes.json()) as { prompt_id: string };
  console.log(`Queued ComfyUI job ${prompt_id}...`);

  // 2. Poll /history until the image finishes rendering
  let outputImage: { filename: string; subfolder: string; type: string } | null = null;

  while (!outputImage) {
    await new Promise((r) => setTimeout(r, 500));
    const histRes = await fetch(`${COMFY_URL}/history/${prompt_id}`);
    const history = (await histRes.json()) as Record<string, any>;
    const job = history[prompt_id];

    if (job?.outputs) {
      for (const nodeOutput of Object.values(job.outputs) as any[]) {
        if (nodeOutput.images?.length > 0) {
          outputImage = nodeOutput.images[0];
          break;
        }
      }
    }
  }

  // 3. Download the generated PNG and save it into the project workspace
  const params = new URLSearchParams({
    filename: outputImage.filename,
    subfolder: outputImage.subfolder ?? "",
    type: outputImage.type ?? "output",
  });

  const imgRes = await fetch(`${COMFY_URL}/view?${params.toString()}`);
  const buffer = Buffer.from(await imgRes.arrayBuffer());

  const resolvedOutput = path.resolve(outputArg);
  await mkdir(path.dirname(resolvedOutput), { recursive: true });
  await writeFile(resolvedOutput, buffer);

  console.log(`Saved hex tile -> ${outputArg}`);
}

main().catch((err) => {
  console.error("Tile generation failed:", err.message);
  process.exit(1);
});