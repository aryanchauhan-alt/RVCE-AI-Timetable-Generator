"""
Alternative: If you prefer to manually export from Supabase dashboard,
place the CSV files here and this script will load them.
"""

import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent.parent / "data"


def load_departments():
    """Load departments from CSV export"""
    csv_path = DATA_DIR / "departments_export.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path)
    print(f"⚠️  {csv_path} not found. Export from Supabase first.")
    return None


def load_subjects():
    """Load subjects from CSV export"""
    csv_path = DATA_DIR / "subjects_export.csv"
    if csv_path.exists():
        return pd.read_csv(csv_path)
    print(f"⚠️  {csv_path} not found. Export from Supabase first.")
    return None


if __name__ == "__main__":
    dept_df = load_departments()
    subj_df = load_subjects()
    
    if dept_df is not None:
        print(f"📊 Loaded {len(dept_df)} departments")
        print(dept_df.head())
    
    if subj_df is not None:
        print(f"\n📊 Loaded {len(subj_df)} subjects")
        print(subj_df.head())

