#!/usr/bin/env python3
"""
Pokémon sprite -> Vision LLM -> master_sprite_dataset.json

Pipeline
  1. Safely extract the PNG sprites we care about from generation-N.tar.gz into a temp dir
  2. Base64-encode each sprite (optionally upscaled with nearest-neighbour; 40px sprites read better at 4x)
  3. Send to the Anthropic Messages API (temperature 0, "JSON only") through an asyncio worker pool
  4. Retry 429 / 5xx / network errors with exponential backoff + jitter (honours Retry-After)
  5. Append every result to a JSONL checkpoint as soon as it arrives (crash-safe, resumable)
  6. Compile the checkpoint into master_sprite_dataset.json; unparseable replies go to failed_images.log

Usage
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 -I analyze_sprites.py --archives ~/Downloads/generation-{1,2,3,4}.tar.gz --out-dir ./out
  # re-run the same command after a crash: finished sprites are skipped.

Requires: pip install aiohttp   (optional: pillow, for --upscale)
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import logging
import os
import random
import re
import shutil
import sys
import tarfile
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

import aiohttp

try:
    from PIL import Image
except ImportError:  # upscaling is optional
    Image = None

log = logging.getLogger("sprites")

API_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = "claude-sonnet-5-5"
RETRY_STATUS = {408, 409, 429, 500, 502, 503, 504, 529}
REQUIRED_KEYS = ("primary_colors", "anatomy", "distinct_features", "pose")

# One game version per generation, matching the game spec (Rouge, Cristal, Émeraude, Platine).
DEFAULT_VERSIONS = ("red-blue", "crystal", "emerald", "platinum")

PROMPT = """You are analysing a Pokémon video-game sprite (a small pixel-art image).
Describe only what is visible in the image. Do not name the Pokémon.

Return ONLY a raw JSON object - no markdown, no code fences, no commentary - with exactly these keys:
{
  "primary_colors": ["<up to 4 dominant colours, most dominant first, plain colour names>"],
  "anatomy": {
    "body_shape": "<e.g. round, serpentine, bipedal, quadruped, winged, ...>",
    "head": "<description>",
    "limbs": "<arms/legs/fins/wings/tentacles>",
    "tail": "<description or 'none'>",
    "other_parts": ["<any other notable body parts>"]
  },
  "distinct_features": ["<short phrases: horns, spots, stripes, shell, flame, big eyes, ...>"],
  "pose": {
    "facing": "<left | right | front | back | three-quarter>",
    "stance": "<e.g. standing, crouching, flying, coiled, ...>",
    "description": "<one short sentence>"
  }
}"""


# --------------------------------------------------------------------------- data model

@dataclass(frozen=True)
class Sprite:
    path: Path        # extracted file on disk
    key: str          # unique id: "<version>[/<variant>]/<stem>"  e.g. "platinum/25"
    dex_id: str       # filename stem, e.g. "25" or "201-a"
    label: str        # "<version>[/<variant>]"  e.g. "platinum" or "platinum/shiny"
    generation: int

    @property
    def display(self) -> str:
        return f"gen{self.generation}:{self.key}.png"


# --------------------------------------------------------------------------- extraction

def is_hidden(name: str) -> bool:
    parts = PurePosixPath(name).parts
    return any(p.startswith(".") or p.startswith("._") or p == "__MACOSX" for p in parts)


def parse_member(name: str):
    """'pokemon/main-sprites/platinum/shiny/25.png' -> (version, variant, stem) or None."""
    parts = PurePosixPath(name).parts
    if "main-sprites" in parts:
        parts = parts[parts.index("main-sprites") + 1:]
    if len(parts) < 2:
        return None
    version, *variant_dirs, filename = parts
    if not filename.lower().endswith(".png"):
        return None
    return version, "/".join(variant_dirs), PurePosixPath(filename).stem


def extract_archives(archives: list[Path], dest: Path, versions: set[str] | None,
                     all_variants: bool) -> list[Sprite]:
    sprites: list[Sprite] = []
    for archive in archives:
        m = re.search(r"generation-(\d+)", archive.name)
        generation = int(m.group(1)) if m else 0
        wanted = 0
        with tarfile.open(archive, "r:gz") as tar:
            members = []
            for member in tar:
                if not member.isfile() or is_hidden(member.name):
                    continue
                parsed = parse_member(member.name)
                if not parsed:
                    continue
                version, variant, stem = parsed
                if versions and version not in versions:
                    continue
                if variant and not all_variants:   # skip back/ shiny/ gray/ female/ frame2/ ...
                    continue
                members.append((member, version, variant, stem))
            for member, version, variant, stem in members:
                # Extract by hand into a path we construct (never trust member.name for the target).
                label = f"{version}/{variant}" if variant else version
                target = dest / f"gen{generation}" / label / f"{stem}.png"
                target.parent.mkdir(parents=True, exist_ok=True)
                src = tar.extractfile(member)
                if src is None:
                    continue
                with src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)
                sprites.append(Sprite(target, f"{label}/{stem}", stem, label, generation))
                wanted += 1
        log.info("%s: extracted %d sprites", archive.name, wanted)
    sprites.sort(key=lambda s: (s.generation, s.label, natural(s.dex_id)))
    return sprites


def natural(s: str):
    return [int(t) if t.isdigit() else t for t in re.split(r"(\d+)", s)]


# --------------------------------------------------------------------------- image + parsing

def encode_image(path: Path, upscale: int) -> str:
    data = path.read_bytes()
    if upscale > 1 and Image is not None:
        with Image.open(io.BytesIO(data)) as im:
            im = im.convert("RGBA")
            bg = Image.new("RGBA", im.size, (255, 255, 255, 255))   # flatten transparency onto white
            bg.alpha_composite(im)
            im = bg.convert("RGB").resize((im.width * upscale, im.height * upscale), Image.NEAREST)
            buf = io.BytesIO()
            im.save(buf, "PNG")
            data = buf.getvalue()
    return base64.standard_b64encode(data).decode("ascii")


def extract_json(text: str) -> dict:
    """Parse the model reply. Tolerates stray code fences; rejects anything that isn't a JSON object."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise
        obj = json.loads(text[start:end + 1])
    if not isinstance(obj, dict):
        raise ValueError("top-level JSON is not an object")
    missing = [k for k in REQUIRED_KEYS if k not in obj]
    if missing:
        raise ValueError(f"missing keys: {missing}")
    return obj


# --------------------------------------------------------------------------- API client

class RateGate:
    """Shared pause: when any worker sees a 429/529, every worker waits."""
    def __init__(self):
        self._until = 0.0

    def pause(self, seconds: float):
        self._until = max(self._until, time.monotonic() + seconds)

    async def wait(self):
        delay = self._until - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)


class ApiError(Exception):
    pass


async def call_vision(session: aiohttp.ClientSession, gate: RateGate, args, b64: str) -> str:
    payload = {
        "model": args.model,
        "max_tokens": args.max_tokens,
        "temperature": 0,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}},
                {"type": "text", "text": PROMPT},
            ],
        }],
    }
    headers = {
        "x-api-key": args.api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }
    for attempt in range(args.max_retries + 1):
        await gate.wait()
        retry_after = None
        try:
            async with session.post(args.api_url, json=payload, headers=headers) as resp:
                if resp.status == 200:
                    body = await resp.json()
                    return "".join(b.get("text", "") for b in body.get("content", []) if b.get("type") == "text")
                err_text = (await resp.text())[:300]
                if resp.status not in RETRY_STATUS:
                    raise ApiError(f"HTTP {resp.status}: {err_text}")   # e.g. 400/401/403 - retrying is pointless
                ra = resp.headers.get("retry-after")
                if ra and ra.replace(".", "", 1).isdigit():
                    retry_after = float(ra)
                reason = f"HTTP {resp.status}"
                if resp.status in (429, 529):
                    gate.pause(retry_after or args.base_delay)
        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            reason = f"network: {type(exc).__name__}"
        if attempt == args.max_retries:
            raise ApiError(f"gave up after {attempt + 1} attempts ({reason})")
        delay = min(args.max_delay, args.base_delay * 2 ** attempt)
        delay = max(retry_after or 0, delay) * random.uniform(0.75, 1.25)    # jitter
        log.warning("%s - retry %d/%d in %.1fs", reason, attempt + 1, args.max_retries, delay)
        await asyncio.sleep(delay)
    raise ApiError("unreachable")


# --------------------------------------------------------------------------- checkpoint + workers

def load_checkpoint(path: Path) -> dict[str, dict]:
    done: dict[str, dict] = {}
    if path.exists():
        with open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                    done[rec["key"]] = rec
                except (json.JSONDecodeError, KeyError):
                    continue   # a half-written last line from a crash - just redo that sprite
    return done


async def worker(name: int, queue: asyncio.Queue, session, gate, args, ckpt, failed, stats):
    loop = asyncio.get_running_loop()
    while True:
        sprite: Sprite = await queue.get()
        try:
            b64 = await loop.run_in_executor(None, encode_image, sprite.path, args.upscale)
            text = await call_vision(session, gate, args, b64)
            analysis = extract_json(text)
            rec = {"key": sprite.key, "id": sprite.dex_id, "version": sprite.label,
                   "generation": sprite.generation, "analysis": analysis}
            ckpt.write(json.dumps(rec, ensure_ascii=False) + "\n")
            ckpt.flush()
            os.fsync(ckpt.fileno())
            stats["ok"] += 1
        except Exception as exc:    # never let one sprite kill the loop
            stats["failed"] += 1
            kind = "invalid_json" if isinstance(exc, (json.JSONDecodeError, ValueError)) else "api_error"
            failed.write(f"{sprite.display}\t{kind}\t{exc}\n")
            failed.flush()
            log.error("FAILED %s (%s): %s", sprite.display, kind, exc)
        finally:
            queue.task_done()
            n = stats["ok"] + stats["failed"]
            if n % 25 == 0:
                log.info("progress %d/%d (ok=%d failed=%d)", n, stats["total"], stats["ok"], stats["failed"])


async def run(args, sprites: list[Sprite]):
    out = Path(args.out_dir)
    ckpt_path = out / "sprite_results.jsonl"
    done = load_checkpoint(ckpt_path)
    todo = [s for s in sprites if s.key not in done]
    log.info("%d sprites total, %d already done, %d to process", len(sprites), len(sprites) - len(todo), len(todo))

    stats = {"ok": 0, "failed": 0, "total": len(todo)}
    if todo:
        queue: asyncio.Queue = asyncio.Queue()
        for s in todo:
            queue.put_nowait(s)
        gate = RateGate()
        timeout = aiohttp.ClientTimeout(total=args.timeout)
        connector = aiohttp.TCPConnector(limit=args.concurrency)
        with open(ckpt_path, "a", encoding="utf-8") as ckpt, \
             open(out / "failed_images.log", "a", encoding="utf-8") as failed:
            async with aiohttp.ClientSession(timeout=timeout, connector=connector) as session:
                workers = [asyncio.create_task(worker(i, queue, session, gate, args, ckpt, failed, stats))
                           for i in range(args.concurrency)]
                await queue.join()
                for w in workers:
                    w.cancel()
                await asyncio.gather(*workers, return_exceptions=True)
    log.info("done: ok=%d failed=%d", stats["ok"], stats["failed"])
    return stats


def compile_master(out: Path, selected_keys: set[str]) -> int:
    """Checkpoint -> { "<dex id>": { "<version>": analysis } }, written atomically."""
    master: dict[str, dict] = {}
    for rec in load_checkpoint(out / "sprite_results.jsonl").values():
        if rec["key"] not in selected_keys:
            continue
        entry = {"generation": rec["generation"], **rec["analysis"]}
        master.setdefault(rec["id"], {})[rec["version"]] = entry
    ordered = {k: master[k] for k in sorted(master, key=natural)}
    tmp = out / "master_sprite_dataset.json.tmp"
    tmp.write_text(json.dumps(ordered, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(out / "master_sprite_dataset.json")
    return len(ordered)


# --------------------------------------------------------------------------- main

def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--archives", nargs="+", required=True, type=Path, help="generation-N.tar.gz files")
    p.add_argument("--out-dir", default="./out", help="where JSONL / master JSON / failed log go")
    p.add_argument("--versions", nargs="+", default=list(DEFAULT_VERSIONS),
                   help="game-version folders to process, or 'all' (default: %(default)s)")
    p.add_argument("--all-variants", action="store_true",
                   help="also process back/, shiny/, gray/, female/, frame2/ ... sub-folders")
    p.add_argument("--limit", type=int, default=0, help="only process the first N sprites (smoke test)")
    p.add_argument("--model", default=DEFAULT_MODEL)
    p.add_argument("--api-url", default=API_URL)
    p.add_argument("--api-key", default=os.environ.get("ANTHROPIC_API_KEY"))
    p.add_argument("--concurrency", type=int, default=8, help="parallel requests in flight")
    p.add_argument("--max-retries", type=int, default=6)
    p.add_argument("--base-delay", type=float, default=2.0, help="first backoff delay (s); doubles each retry")
    p.add_argument("--max-delay", type=float, default=60.0)
    p.add_argument("--timeout", type=float, default=90.0, help="per-request timeout (s)")
    p.add_argument("--max-tokens", type=int, default=800)
    p.add_argument("--upscale", type=int, default=4, help="nearest-neighbour upscale factor (needs pillow; 1=off)")
    p.add_argument("--keep-temp", action="store_true", help="keep the extracted sprites")
    args = p.parse_args()
    if not args.api_key:
        p.error("set ANTHROPIC_API_KEY or pass --api-key")
    return args


def main():
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")
    if args.upscale > 1 and Image is None:
        log.warning("pillow not installed - sending sprites at native size (pip install pillow)")
    out = Path(args.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    versions = None if "all" in args.versions else set(args.versions)

    tmp = Path(tempfile.mkdtemp(prefix="sprites_"))
    try:
        sprites = extract_archives(args.archives, tmp, versions, args.all_variants)
        if args.limit:
            sprites = sprites[:args.limit]
        if not sprites:
            sys.exit("no sprites matched - check --archives / --versions")
        try:
            stats = asyncio.run(run(args, sprites))
        except KeyboardInterrupt:
            log.warning("interrupted - progress is saved; re-run to resume")
            sys.exit(130)
        n = compile_master(out, {s.key for s in sprites})
        log.info("master_sprite_dataset.json written: %d dex ids", n)
        if stats["failed"]:
            log.warning("%d sprites failed - see %s", stats["failed"], out / "failed_images.log")
    finally:
        if args.keep_temp:
            log.info("extracted sprites kept in %s", tmp)
        else:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
