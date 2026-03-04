#!/usr/bin/env python3
"""
KGen Studio — Auto Scrape Trending Prompts
Fetches trending AI prompts from MeiGen Gallery API and updates the JSON data file.
Runs daily via GitHub Actions.
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path

# ============================================================
# CONFIGURATION
# ============================================================

MEIGEN_API_BASE = "https://api.meigen.ai"
MEIGEN_TRENDING_URL = f"{MEIGEN_API_BASE}/api/trending"
MEIGEN_SEARCH_URL = f"{MEIGEN_API_BASE}/api/search"

# Fallback: scrape from the public gallery page
MEIGEN_GALLERY_URL = "https://meigen.ai/api/gallery"

OUTPUT_FILE = Path(__file__).parent.parent / "web-ui" / "data" / "trending-prompts.json"

# Category mapping
CATEGORY_KEYWORDS = {
    "Girl": ["girl", "woman", "female", "portrait", "beauty", "fashion", "model"],
    "Product": ["product", "brand", "packaging", "bottle", "mockup", "commercial", "advertising"],
    "Photograph": ["photo", "photograph", "candid", "editorial", "cinematic", "paparazzi"],
    "3D": ["3d", "isometric", "render", "icon", "sticker", "vector", "illustration"],
    "Food": ["food", "recipe", "dish", "cuisine", "dessert", "cooking", "restaurant"],
    "JSON": ['"prompt_structure"', '"subject"', '"environment"', '"lighting"', '"camera"'],
}

# ============================================================
# HELPER FUNCTIONS
# ============================================================

def fetch_json(url, retries=3, timeout=30):
    """Fetch JSON from URL with retry logic."""
    headers = {
        "User-Agent": "KGen-Studio/1.0 (Trending Prompt Scraper)",
        "Accept": "application/json",
    }
    req = urllib.request.Request(url, headers=headers)
    
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = response.read().decode("utf-8")
                return json.loads(data)
        except urllib.error.HTTPError as e:
            print(f"  HTTP Error {e.code} on attempt {attempt + 1}/{retries}: {url}")
            if e.code == 429:  # Rate limited
                wait_time = (attempt + 1) * 10
                print(f"  Rate limited. Waiting {wait_time}s...")
                time.sleep(wait_time)
            elif e.code >= 500:
                time.sleep(5)
            else:
                return None
        except (urllib.error.URLError, Exception) as e:
            print(f"  Error on attempt {attempt + 1}/{retries}: {e}")
            time.sleep(3)
    
    return None


def detect_categories(prompt_text):
    """Auto-detect categories based on prompt content."""
    categories = []
    prompt_lower = prompt_text.lower() if prompt_text else ""
    
    for category, keywords in CATEGORY_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in prompt_lower:
                if category not in categories:
                    categories.append(category)
                break
    
    # Check if it's JSON-structured
    if prompt_text and (prompt_text.strip().startswith("{") or prompt_text.strip().startswith("[")):
        if "JSON" not in categories:
            categories.insert(0, "JSON")
    
    if not categories:
        categories = ["Other"]
    
    return categories


def detect_model(prompt_text, source_url=""):
    """Detect which AI model was likely used."""
    prompt_lower = (prompt_text or "").lower()
    
    if "gpt" in prompt_lower or "dall-e" in prompt_lower or "openai" in prompt_lower:
        return "gptimage"
    if "midjourney" in prompt_lower or "mj" in prompt_lower:
        return "midjourney"
    if "stable diffusion" in prompt_lower or "sd" in prompt_lower:
        return "stablediffusion"
    
    return "nanobanana"  # Default


def normalize_prompt(raw_item, rank):
    """Convert raw scraped data to our standard format."""
    prompt_id = str(raw_item.get("id", raw_item.get("tweet_id", f"gen_{rank}")))
    prompt_text = raw_item.get("prompt", raw_item.get("text", ""))
    
    # Extract images
    images = raw_item.get("images", [])
    if not images and raw_item.get("image"):
        images = [raw_item["image"]]
    if not images and raw_item.get("media"):
        images = raw_item["media"] if isinstance(raw_item["media"], list) else [raw_item["media"]]
    
    # Primary image
    image = images[0] if images else ""
    
    # Author info
    author = raw_item.get("author", raw_item.get("username", raw_item.get("user", {}).get("username", "")))
    author_name = raw_item.get("author_name", raw_item.get("display_name", raw_item.get("user", {}).get("name", author)))
    
    # Engagement metrics
    likes = raw_item.get("likes", raw_item.get("like_count", raw_item.get("favorites", 0)))
    views = raw_item.get("views", raw_item.get("view_count", raw_item.get("impressions", 0)))
    
    # Date
    date_str = raw_item.get("date", raw_item.get("created_at", ""))
    if date_str and "T" in str(date_str):
        date_str = str(date_str).split("T")[0]
    elif not date_str:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    # Source URL
    source_url = raw_item.get("source_url", raw_item.get("url", ""))
    if not source_url and author and prompt_id.isdigit():
        source_url = f"https://x.com/{author}/status/{prompt_id}"
    
    return {
        "rank": rank,
        "id": prompt_id,
        "prompt": prompt_text,
        "author": author,
        "author_name": author_name,
        "likes": int(likes) if likes else 0,
        "views": int(views) if views else 0,
        "image": image,
        "images": images,
        "model": detect_model(prompt_text, source_url),
        "categories": detect_categories(prompt_text),
        "date": date_str,
        "source_url": source_url,
    }


# ============================================================
# SCRAPING SOURCES
# ============================================================

def scrape_meigen_api():
    """Try to fetch trending prompts from MeiGen API."""
    print("📡 Trying MeiGen API...")
    
    all_prompts = []
    
    # Try different API endpoints
    endpoints = [
        f"{MEIGEN_API_BASE}/api/trending?limit=500",
        f"{MEIGEN_API_BASE}/api/gallery?sort=trending&limit=500",
        f"{MEIGEN_API_BASE}/api/prompts?sort=likes&limit=500",
        "https://meigen.ai/api/trending?limit=500",
        "https://meigen.ai/api/gallery?sort=trending&limit=500",
    ]
    
    for endpoint in endpoints:
        print(f"  Trying: {endpoint}")
        data = fetch_json(endpoint)
        
        if data:
            # Handle different response structures
            items = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict):
                items = data.get("data", data.get("prompts", data.get("results", data.get("items", []))))
            
            if items:
                print(f"  ✅ Got {len(items)} prompts from {endpoint}")
                all_prompts.extend(items)
                break
            else:
                print(f"  ❌ Empty response from {endpoint}")
        else:
            print(f"  ❌ Failed to fetch {endpoint}")
        
        time.sleep(1)  # Rate limit respect
    
    return all_prompts


def scrape_civitai_images():
    """Fetch trending images+prompts from Civitai public API."""
    print("📡 Trying Civitai API...")
    
    all_items = []
    
    # Civitai has a public API for images
    periods = ["Day", "Week", "Month"]
    
    for period in periods:
        url = f"https://civitai.com/api/v1/images?limit=100&sort=Most+Reactions&period={period}"
        print(f"  Fetching: {period} trending...")
        data = fetch_json(url)
        
        if data and "items" in data:
            for item in data["items"]:
                # Extract prompt from meta
                meta = item.get("meta", {}) or {}
                prompt_text = meta.get("prompt", "")
                
                if not prompt_text or len(prompt_text) < 20:
                    continue
                
                # Convert to our format
                converted = {
                    "id": str(item.get("id", "")),
                    "prompt": prompt_text,
                    "author": item.get("username", ""),
                    "author_name": item.get("username", ""),
                    "likes": item.get("stats", {}).get("likeCount", 0) + item.get("stats", {}).get("heartCount", 0),
                    "views": item.get("stats", {}).get("viewCount", 0),
                    "image": item.get("url", ""),
                    "images": [item.get("url", "")],
                    "date": (item.get("createdAt", "")[:10] if item.get("createdAt") else ""),
                    "source_url": f"https://civitai.com/images/{item.get('id', '')}",
                }
                all_items.append(converted)
            
            print(f"  ✅ Got {len(data['items'])} images for {period}")
        else:
            print(f"  ❌ Failed for {period}")
        
        time.sleep(2)
    
    return all_items


def scrape_prompthero():
    """Fetch trending prompts from PromptHero API."""
    print("📡 Trying PromptHero...")
    
    all_items = []
    url = "https://prompthero.com/api/prompts?sort=popular&limit=100"
    data = fetch_json(url)
    
    if data:
        items = data if isinstance(data, list) else data.get("data", data.get("prompts", []))
        for item in items:
            converted = {
                "id": str(item.get("id", "")),
                "prompt": item.get("prompt", item.get("text", "")),
                "author": item.get("user", {}).get("username", "prompthero"),
                "author_name": item.get("user", {}).get("name", "PromptHero User"),
                "likes": item.get("likes", item.get("upvotes", 0)),
                "views": item.get("views", 0),
                "image": item.get("image_url", item.get("thumbnail", "")),
                "images": [item.get("image_url", "")] if item.get("image_url") else [],
                "date": (item.get("created_at", "")[:10] if item.get("created_at") else ""),
                "source_url": f"https://prompthero.com/prompt/{item.get('id', '')}",
            }
            if converted["prompt"]:
                all_items.append(converted)
        
        print(f"  ✅ Got {len(all_items)} prompts")
    else:
        print("  ❌ Failed to fetch PromptHero")
    
    return all_items


# ============================================================
# MAIN LOGIC
# ============================================================

def merge_prompts(existing, new_items):
    """Merge new prompts with existing, avoiding duplicates and re-ranking."""
    existing_ids = {p.get("id") for p in existing}
    existing_prompts_hash = {hash(p.get("prompt", "")[:100]) for p in existing if p.get("prompt")}
    
    added = 0
    for item in new_items:
        item_id = str(item.get("id", ""))
        prompt_hash = hash(item.get("prompt", "")[:100]) if item.get("prompt") else 0
        
        # Skip duplicates
        if item_id in existing_ids or prompt_hash in existing_prompts_hash:
            continue
        
        existing.append(item)
        existing_ids.add(item_id)
        existing_prompts_hash.add(prompt_hash)
        added += 1
    
    print(f"  📊 Added {added} new unique prompts")
    return existing


def sort_and_rank(prompts):
    """Sort by engagement score and re-assign ranks."""
    for p in prompts:
        # Engagement score = likes * 2 + views * 0.01
        p["_score"] = (p.get("likes", 0) * 2) + (p.get("views", 0) * 0.01)
    
    prompts.sort(key=lambda x: x.get("_score", 0), reverse=True)
    
    for i, p in enumerate(prompts):
        p["rank"] = i + 1
        p.pop("_score", None)
    
    return prompts


def main():
    print("=" * 60)
    print(f"🚀 KGen Studio — Trending Prompt Scraper")
    print(f"📅 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Load existing prompts
    existing_prompts = []
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                existing_prompts = json.load(f)
            print(f"\n📂 Loaded {len(existing_prompts)} existing prompts")
        except Exception as e:
            print(f"\n⚠️ Error loading existing file: {e}")
    
    # Scrape from multiple sources
    all_new_items = []
    
    # Source 1: MeiGen API (primary)
    meigen_items = scrape_meigen_api()
    if meigen_items:
        normalized = [normalize_prompt(item, i + 1) for i, item in enumerate(meigen_items)]
        all_new_items.extend(normalized)
        print(f"  → MeiGen: {len(normalized)} prompts")
    
    # Source 2: Civitai (secondary)
    civitai_items = scrape_civitai_images()
    if civitai_items:
        normalized = [normalize_prompt(item, i + 1) for i, item in enumerate(civitai_items)]
        all_new_items.extend(normalized)
        print(f"  → Civitai: {len(normalized)} prompts")
    
    # Source 3: PromptHero (tertiary)
    prompthero_items = scrape_prompthero()
    if prompthero_items:
        normalized = [normalize_prompt(item, i + 1) for i, item in enumerate(prompthero_items)]
        all_new_items.extend(normalized)
        print(f"  → PromptHero: {len(normalized)} prompts")
    
    print(f"\n📊 Total new items scraped: {len(all_new_items)}")
    
    # Merge with existing
    if all_new_items:
        merged = merge_prompts(existing_prompts, all_new_items)
    else:
        merged = existing_prompts
        print("  ⚠️ No new items found. Keeping existing data.")
    
    # Filter out items without valid prompts or images
    valid = [p for p in merged if p.get("prompt") and len(p["prompt"]) >= 20 and p.get("image")]
    print(f"  ✅ Valid prompts after filtering: {len(valid)}")
    
    # Sort and re-rank
    final = sort_and_rank(valid)
    
    # Save
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(final, f, ensure_ascii=False, indent=2)
    
    file_size_mb = OUTPUT_FILE.stat().st_size / (1024 * 1024)
    
    print(f"\n{'=' * 60}")
    print(f"✅ DONE!")
    print(f"  📁 Output: {OUTPUT_FILE}")
    print(f"  📊 Total prompts: {len(final)}")
    print(f"  💾 File size: {file_size_mb:.2f} MB")
    print(f"  🕐 Completed: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'=' * 60}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
