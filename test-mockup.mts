// Test script for mockup generation — tests HF, KREA, and OpenRouter
import sharp from 'sharp';

const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
const KREA_KEY = process.env.KREA_API_KEY;
const OR_KEY = process.env.OPENROUTER_API_KEY;

// Create a simple test logo (colored text on gradient background)
async function createTestLogo(): Promise<Buffer> {
  const svg = `<svg width="300" height="100" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1a1a2e"/>
        <stop offset="100%" stop-color="#16213e"/>
      </linearGradient>
    </defs>
    <rect width="300" height="100" fill="url(#bg)" rx="8"/>
    <text x="150" y="60" text-anchor="middle" font-family="Arial Black" font-size="36" fill="#00d4ff" font-weight="bold">FIAP</text>
    <text x="150" y="85" text-anchor="middle" font-family="Arial" font-size="14" fill="#e94560">SCHOOL</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Create a simple test product (gray bag silhouette)
async function createTestProduct(): Promise<Buffer> {
  const svg = `<svg width="512" height="640" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="640" fill="white"/>
    <rect x="77" y="115" width="358" height="416" rx="3" fill="#a0a0a0"/>
    <path d="M154 115 Q154 26 205 26" fill="none" stroke="#888" stroke-width="5"/>
    <path d="M308 26 Q358 26 358 115" fill="none" stroke="#888" stroke-width="5"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// ==========================================
// TEST 1: HuggingFace
// ==========================================
async function testHuggingFace(productBuffer: Buffer, logoBuffer: Buffer): Promise<boolean> {
  if (!HF_TOKEN) { console.log('[HF] No token, skipping'); return false; }
  
  console.log('\n=== TEST: HuggingFace Inference API ===');
  try {
    // Test 1a: Text-to-image generation
    console.log('[HF] Testing text-to-image generation...');
    const genResponse = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'image/png',
        },
        body: JSON.stringify({
          inputs: 'professional product photo of a cotton tote bag, medium gray, studio lighting, white background, e-commerce quality, 4k',
          parameters: { width: 512, height: 640, num_inference_steps: 6 },
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!genResponse.ok) {
      const err = await genResponse.text().catch(() => 'unknown');
      console.error(`[HF] Generation FAILED: ${genResponse.status} — ${err}`);
      return false;
    }

    const genBuffer = Buffer.from(new Uint8Array(await genResponse.arrayBuffer()));
    console.log(`[HF] Generation OK: ${genBuffer.length} bytes`);
    
    // Save test output
    const fs = await import('fs');
    fs.writeFileSync('test-output/hf-generated.png', genBuffer);
    console.log('[HF] Saved: test-output/hf-generated.png');

    // Test 1b: Img2img refinement
    console.log('[HF] Testing img2img refinement...');
    const base64 = productBuffer.toString('base64');
    const refineResponse = await fetch(
      'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'image/png',
        },
        body: JSON.stringify({
          inputs: 'professional e-commerce photo, silk-screen printed logo on cotton tote bag, studio lighting',
          parameters: {
            image: `data:image/png;base64,${base64}`,
            strength: 0.35,
            num_inference_steps: 8,
            width: 512,
            height: 640,
          },
        }),
        signal: AbortSignal.timeout(120000),
      }
    );

    if (!refineResponse.ok) {
      const err = await refineResponse.text().catch(() => 'unknown');
      console.error(`[HF] Refinement FAILED: ${refineResponse.status} — ${err}`);
      return genBuffer.length > 100; // Generation worked even if refinement didn't
    }

    const refineBuffer = Buffer.from(new Uint8Array(await refineResponse.arrayBuffer()));
    console.log(`[HF] Refinement OK: ${refineBuffer.length} bytes`);
    fs.writeFileSync('test-output/hf-refined.png', refineBuffer);
    console.log('[HF] Saved: test-output/hf-refined.png');
    
    return true;
  } catch (err) {
    console.error('[HF] Error:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ==========================================
// TEST 2: KREA
// ==========================================
async function testKrea(productBuffer: Buffer, logoBuffer: Buffer): Promise<boolean> {
  if (!KREA_KEY) { console.log('[KREA] No key, skipping'); return false; }
  
  console.log('\n=== TEST: KREA AI ===');
  try {
    // Test text-to-image
    console.log('[KREA] Testing text-to-image via Flux...');
    const genResponse = await fetch('https://api.krea.ai/generate/image/bfl/flux-1-dev', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KREA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'professional product photo of a cotton tote bag, medium gray, studio lighting, white background, e-commerce quality, 4k',
        width: 512,
        height: 640,
        steps: 12,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!genResponse.ok) {
      const err = await genResponse.text().catch(() => 'unknown');
      console.error(`[KREA] Generation request FAILED: ${genResponse.status} — ${err}`);
      return false;
    }

    const genData = await genResponse.json();
    const jobId = genData.job_id;
    console.log(`[KREA] Job created: ${jobId}`);

    // Poll for result
    const maxWait = 120000;
    const startTime = Date.now();
    let resultBuffer: Buffer | null = null;

    while (Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 3000));
      
      const pollResponse = await fetch(`https://api.krea.ai/jobs/${jobId}`, {
        headers: { 'Authorization': `Bearer ${KREA_KEY}` },
      });

      if (!pollResponse.ok) { console.error(`[KREA] Poll error: ${pollResponse.status}`); continue; }

      const job = await pollResponse.json();
      console.log(`[KREA] Status: ${job.status}`);

      if (job.status === 'completed' && job.result?.urls?.length) {
        const imgResponse = await fetch(job.result.urls[0]);
        if (imgResponse.ok) {
          resultBuffer = Buffer.from(new Uint8Array(await imgResponse.arrayBuffer()));
        }
        break;
      }

      if (job.status === 'failed' || job.status === 'cancelled') {
        console.error(`[KREA] Job ${job.status}: ${job.result?.error || 'unknown'}`);
        return false;
      }
    }

    if (!resultBuffer) {
      console.error('[KREA] Timed out');
      return false;
    }

    console.log(`[KREA] Generation OK: ${resultBuffer.length} bytes`);
    const fs = await import('fs');
    fs.writeFileSync('test-output/krea-generated.png', resultBuffer);
    console.log('[KREA] Saved: test-output/krea-generated.png');

    // Test img2img refinement
    console.log('[KREA] Testing img2img refinement (Flux Kontext)...');
    
    // Upload product image
    const formData = new FormData();
    const blob = new Blob([productBuffer], { type: 'image/png' });
    formData.append('file', blob, 'product.png');

    const uploadResponse = await fetch('https://api.krea.ai/assets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KREA_KEY}` },
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.error(`[KREA] Upload failed: ${uploadResponse.status}`);
      return true; // Generation worked
    }

    const uploadData = await uploadResponse.json();
    const imageUrl = uploadData.image_url;
    console.log(`[KREA] Asset uploaded`);

    const refineResponse = await fetch('https://api.krea.ai/generate/image/bfl/flux-1-kontext-dev', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KREA_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'professional e-commerce photo, silk-screen printed logo on cotton tote bag, studio lighting, photorealistic',
        imageUrl,
        strength: 0.40,
        steps: 20,
        width: 512,
        height: 640,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!refineResponse.ok) {
      const err = await refineResponse.text().catch(() => 'unknown');
      console.error(`[KREA] Refinement request failed: ${refineResponse.status} — ${err}`);
      return true;
    }

    const refineData = await refineResponse.json();
    const refineJobId = refineData.job_id;
    console.log(`[KREA] Refinement job: ${refineJobId}`);

    // Poll refinement
    const refineStart = Date.now();
    while (Date.now() - refineStart < 180000) {
      await new Promise(r => setTimeout(r, 3000));
      const poll = await fetch(`https://api.krea.ai/jobs/${refineJobId}`, {
        headers: { 'Authorization': `Bearer ${KREA_KEY}` },
      });
      if (!poll.ok) continue;
      const job = await poll.json();
      console.log(`[KREA] Refine status: ${job.status}`);
      
      if (job.status === 'completed' && job.result?.urls?.length) {
        const imgResp = await fetch(job.result.urls[0]);
        if (imgResp.ok) {
          const buf = Buffer.from(new Uint8Array(await imgResp.arrayBuffer()));
          fs.writeFileSync('test-output/krea-refined.png', buf);
          console.log(`[KREA] Refinement OK: ${buf.length} bytes`);
        }
        break;
      }
      if (job.status === 'failed' || job.status === 'cancelled') {
        console.error(`[KREFINE] Job ${job.status}`);
        break;
      }
    }

    return true;
  } catch (err) {
    console.error('[KREA] Error:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ==========================================
// TEST 3: OpenRouter
// ==========================================
async function testOpenRouter(): Promise<boolean> {
  if (!OR_KEY) { console.log('[OR] No key, skipping'); return false; }
  
  console.log('\n=== TEST: OpenRouter ===');
  try {
    // OpenRouter doesn't have native image generation like HF/KREA
    // It's primarily an LLM router. Let's check if they support image models
    console.log('[OR] Checking available image models...');
    
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${OR_KEY}` },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[OR] Models list failed: ${response.status}`);
      return false;
    }

    const data = await response.json();
    const imageModels = data.data?.filter((m: any) => 
      m.id?.includes('flux') || m.id?.includes('dall-e') || m.id?.includes('stable-diffusion') || m.id?.includes('imagen')
    ) || [];

    console.log(`[OR] Found ${imageModels.length} potential image models:`);
    imageModels.slice(0, 5).forEach((m: any) => console.log(`  - ${m.id}`));

    if (imageModels.length === 0) {
      console.log('[OR] No image generation models found on OpenRouter');
      console.log('[OR] Note: OpenRouter is primarily an LLM router, not an image API');
      return false;
    }

    return true;
  } catch (err) {
    console.error('[OR] Error:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ==========================================
// MAIN
// ==========================================
async function main() {
  console.log('========================================');
  console.log('Mockup Generation API Test Suite');
  console.log('========================================');
  console.log(`HF Token: ${HF_TOKEN ? 'SET (' + HF_TOKEN.substring(0, 8) + '...)' : 'NOT SET'}`);
  console.log(`KREA Key: ${KREA_KEY ? 'SET (' + KREA_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);
  console.log(`OR Key:   ${OR_KEY ? 'SET (' + OR_KEY.substring(0, 8) + '...)' : 'NOT SET'}`);

  const productBuffer = await createTestProduct();
  const logoBuffer = await createTestLogo();

  const results: Record<string, boolean> = {};

  // Test HF first
  results.huggingface = await testHuggingFace(productBuffer, logoBuffer);
  
  // Test KREA
  results.krea = await testKrea(productBuffer, logoBuffer);
  
  // Test OpenRouter
  results.openrouter = await testOpenRouter();

  console.log('\n========================================');
  console.log('RESULTS');
  console.log('========================================');
  for (const [provider, success] of Object.entries(results)) {
    console.log(`${provider}: ${success ? '✅ OK' : '❌ FAILED'}`);
  }
}

main().catch(console.error);
