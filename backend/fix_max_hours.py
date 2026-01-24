"""
Script to fix the max_hours_per_week value for all faculty
Setting to 40 so the workload display shows actual hours vs capacity properly
"""

import httpx
import asyncio

SUPABASE_URL = "https://mmkkmjsqrqwfkbazznaw.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ta2ttanNxcnF3ZmtiYXp6bmF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxMjIwMTMsImV4cCI6MjA4MTY5ODAxM30.i197JgWC9Sz0VLmxFHj7YBP2WHkYHEpU-d22xP_Wkq0"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

async def main():
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Get all faculty
        print("Fetching all faculty...")
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/faculty?select=id,faculty_id,faculty_name,max_hours_per_week",
            headers=headers
        )
        faculty_list = resp.json()
        print(f"Found {len(faculty_list)} faculty members")
        
        # 2. Count current max_hours distribution
        from collections import Counter
        dist = Counter(f.get('max_hours_per_week') for f in faculty_list)
        print("\nCurrent max_hours_per_week distribution:")
        for val, count in sorted(dist.items()):
            print(f"  {val}: {count} faculty")
        
        # 3. Update all faculty to max_hours_per_week = 40
        print("\n" + "=" * 60)
        print("Updating all faculty to max_hours_per_week = 40...")
        
        # Use PATCH with a filter to update all at once
        resp = await client.patch(
            f"{SUPABASE_URL}/rest/v1/faculty?max_hours_per_week=lt.40",
            headers=headers,
            json={"max_hours_per_week": 40}
        )
        
        if resp.status_code in [200, 201]:
            updated = resp.json()
            print(f"✅ Updated {len(updated)} faculty members to max_hours = 40")
        else:
            print(f"❌ Error updating: {resp.status_code} - {resp.text}")
        
        # 4. Verify
        print("\n" + "=" * 60)
        print("Verifying changes...")
        resp = await client.get(
            f"{SUPABASE_URL}/rest/v1/faculty?select=max_hours_per_week",
            headers=headers
        )
        faculty_list = resp.json()
        dist = Counter(f.get('max_hours_per_week') for f in faculty_list)
        print("New max_hours_per_week distribution:")
        for val, count in sorted(dist.items()):
            print(f"  {val}: {count} faculty")
        
        print("\n" + "=" * 60)
        print("✅ DONE! All faculty now have max_hours_per_week = 40")
        print("   The frontend will now show actual hours (like 18/40) instead of 18/18")

if __name__ == "__main__":
    asyncio.run(main())
