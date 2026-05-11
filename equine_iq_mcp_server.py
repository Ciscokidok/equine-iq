"""MCP server for EquineIQ — AI Mating Advisor API.

Exposes stallion import, mare management, and mating analysis as MCP tools
so Claude can research horses, bulk-load them, and run mating analysis
directly in conversation.

Usage (stdio transport):
    python equine_iq_mcp_server.py

Config in .mcp.json:
    {
      "mcpServers": {
        "equine-iq": {
          "command": "python",
          "args": ["equine_iq_mcp_server.py"],
          "env": {
            "EQUINE_IQ_API_URL": "https://equine-iq-api.onrender.com",
            "EQUINE_IQ_EMAIL": "you@example.com",
            "EQUINE_IQ_PASSWORD": "yourpassword"
          }
        }
      }
    }
"""
from __future__ import annotations

import json
import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

API_BASE  = os.getenv("EQUINE_IQ_API_URL", "https://equine-iq-api.onrender.com").rstrip("/")
TIMEOUT   = float(os.getenv("EQUINE_IQ_TIMEOUT", "120"))
_EMAIL    = os.getenv("EQUINE_IQ_EMAIL", "")
_PASSWORD = os.getenv("EQUINE_IQ_PASSWORD", "")

mcp = FastMCP("equine-iq")

# ---------------------------------------------------------------------------
# Auth — auto-login, cache JWT in-process
# ---------------------------------------------------------------------------

_token: str = ""


def _warmup() -> None:
    """Ping /health to wake the Render free-tier instance before real requests."""
    try:
        httpx.get(f"{API_BASE}/health", timeout=90)
    except Exception:
        pass


def _ensure_token() -> str:
    global _token
    if _token:
        return _token
    if not _EMAIL or not _PASSWORD:
        raise RuntimeError("EQUINE_IQ_EMAIL and EQUINE_IQ_PASSWORD must be set")
    _warmup()
    r = httpx.post(
        f"{API_BASE}/api/auth/login",
        json={"email": _EMAIL, "password": _PASSWORD},
        timeout=90,
    )
    r.raise_for_status()
    _token = r.json().get("token", "")
    return _token


def _headers() -> dict:
    return {"Authorization": f"Bearer {_ensure_token()}"}


def _get(path: str, params: dict | None = None) -> Any:
    global _token
    url = f"{API_BASE}{path}"
    r = httpx.get(url, params=params, headers=_headers(), timeout=TIMEOUT)
    if r.status_code == 401:
        _token = ""
        r = httpx.get(url, params=params, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _post(path: str, body: Any) -> Any:
    global _token
    url = f"{API_BASE}{path}"
    r = httpx.post(url, json=body, headers=_headers(), timeout=TIMEOUT)
    if r.status_code == 401:
        _token = ""
        r = httpx.post(url, json=body, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _patch(path: str, body: Any) -> Any:
    global _token
    url = f"{API_BASE}{path}"
    r = httpx.patch(url, json=body, headers=_headers(), timeout=TIMEOUT)
    if r.status_code == 401:
        _token = ""
        r = httpx.patch(url, json=body, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


def _delete(path: str) -> Any:
    global _token
    url = f"{API_BASE}{path}"
    r = httpx.delete(url, headers=_headers(), timeout=TIMEOUT)
    if r.status_code == 401:
        _token = ""
        r = httpx.delete(url, headers=_headers(), timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def list_stallions(
    discipline: str = "",
    breed: str = "",
    q: str = "",
    max_fee: int = 0,
) -> str:
    """List stallions in the catalog. Filter by discipline, breed, name search, or max stud fee."""
    params: dict = {}
    if discipline:
        params["discipline"] = discipline
    if breed:
        params["breed"] = breed
    if q:
        params["q"] = q
    if max_fee:
        params["maxFee"] = max_fee
    result = _get("/api/stallions", params=params)
    return json.dumps(result, indent=2)


@mcp.tool()
def import_stallions(stallions: list[dict]) -> str:
    """Bulk-import stallions into the catalog.

    Each stallion dict must have:
      name (str), breed (str), discipline (str)

    Optional fields:
      studFee (int), studLocation (str), offspringCount (int),
      offspringPerformanceSummary (str), conformationNotes (str),
      pedigree (dict with keys: sire, dam, sire_sire, sire_dam, dam_sire, dam_dam
               each being a dict with 'name' and optionally 'breed')

    discipline must be one of:
      sport_horse, warmblood, quarter_horse, paint, reining, cutting,
      barrel_racing, hunter_jumper, dressage, eventing, other

    Example:
      [{"name": "Vitalis", "breed": "KWPN", "discipline": "dressage",
        "studFee": 4500, "studLocation": "Netherlands", "offspringCount": 220,
        "offspringPerformanceSummary": "Top dressage sire...",
        "pedigree": {"sire": {"name": "Voice"}, "dam": {"name": "Whistler"}}}]
    """
    result = _post("/api/stallions/import", stallions)
    return json.dumps(result, indent=2)


@mcp.tool()
def list_mares() -> str:
    """List all mares in the user's account."""
    return json.dumps(_get("/api/mares"), indent=2)


@mcp.tool()
def get_mare(mare_id: str) -> str:
    """Get full details for a specific mare including pedigree."""
    return json.dumps(_get(f"/api/mares/{mare_id}"), indent=2)


@mcp.tool()
def create_mare(
    name: str,
    breed: str,
    discipline: str,
    color: str = "",
    height_hands: float = 0.0,
    date_of_birth: str = "",
    conformation_notes: str = "",
    pedigree: dict | None = None,
) -> str:
    """Create a new mare in the user's account.

    discipline must be one of:
      sport_horse, warmblood, quarter_horse, paint, reining, cutting,
      barrel_racing, hunter_jumper, dressage, eventing, other
    """
    body: dict = {"name": name, "breed": breed, "discipline": discipline}
    if color:
        body["color"] = color
    if height_hands:
        body["heightHands"] = height_hands
    if date_of_birth:
        body["dateOfBirth"] = date_of_birth
    if conformation_notes:
        body["conformationNotes"] = conformation_notes
    if pedigree:
        body["pedigree"] = pedigree
    return json.dumps(_post("/api/mares", body), indent=2)


@mcp.tool()
def analyze_mating(
    mare_id: str,
    stallion_ids: list[str],
    goal: str,
) -> str:
    """Run the AI mating advisor for a mare against a list of stallions.

    Calls Claude in parallel for each stallion and returns ranked results
    with compatibility scores, score breakdowns, reasoning, and risk flags.

    Args:
      mare_id: ID of the mare
      stallion_ids: List of stallion IDs (1–10)
      goal: Breeding goal, e.g. "competitive 1.40m show jumper" or "reining futurity"
    """
    result = _post("/api/pairings/analyze", {
        "mare_id": mare_id,
        "stallion_ids": stallion_ids,
        "goal": goal,
    })
    return json.dumps(result, indent=2)


@mcp.tool()
def save_pairing(
    mare_id: str,
    stallion_id: str,
    compatibility_score: float,
    score_breakdown: dict,
    reasoning: str,
    goal: str,
    risk_flags: list[dict] | None = None,
    top_strengths: list[str] | None = None,
    considerations: list[str] | None = None,
    notes: str = "",
) -> str:
    """Save a mating pairing to the user's saved pairings list."""
    body = {
        "mare_id": mare_id,
        "stallion_id": stallion_id,
        "compatibility_score": compatibility_score,
        "score_breakdown": score_breakdown,
        "reasoning": reasoning,
        "goal": goal,
        "risk_flags": risk_flags or [],
        "top_strengths": top_strengths or [],
        "considerations": considerations or [],
    }
    if notes:
        body["notes"] = notes
    return json.dumps(_post("/api/pairings", body), indent=2)


@mcp.tool()
def list_pairings() -> str:
    """List all saved mating pairings for the current user."""
    return json.dumps(_get("/api/pairings"), indent=2)


@mcp.tool()
def get_pedigree(horse_id: str) -> str:
    """Get pedigree tree and inbreeding flags for any horse."""
    return json.dumps(_get(f"/api/horses/{horse_id}/pedigree"), indent=2)


# ---------------------------------------------------------------------------
# Stud Book / Breeding tools
# ---------------------------------------------------------------------------

@mcp.tool()
def get_stud_book() -> str:
    """Get the operational stud book — all mares with their current breeding status.

    Returns a summary with counts (open, bred, confirmed_in_foal, foaled, other)
    and each mare's latest breeding record including stallion, dates, and foal info.

    Status lifecycle: open → bred → confirmed_in_foal → foaled (or slipped/barren)
    """
    return json.dumps(_get("/api/breedings/stud-book"), indent=2)


@mcp.tool()
def record_breeding(
    mare_id: str,
    stallion_id: str,
    bred_date: str,
    stud_fee_cents: int = 0,
    expected_foal_date: str = "",
    notes: str = "",
) -> str:
    """Record a breeding event — mare was covered by a stallion on a given date.

    Args:
      mare_id: ID of the mare
      stallion_id: ID of the stallion
      bred_date: Date of breeding in YYYY-MM-DD format
      stud_fee_cents: Stud fee paid in cents (e.g. 250000 = $2,500)
      expected_foal_date: Expected foaling date in YYYY-MM-DD format
      notes: Any notes about the breeding
    """
    body: dict = {"mareId": mare_id, "stallionId": stallion_id, "bredDate": bred_date}
    if stud_fee_cents:
        body["studFeeCents"] = stud_fee_cents
    if expected_foal_date:
        body["expectedFoalDate"] = expected_foal_date
    if notes:
        body["notes"] = notes
    return json.dumps(_post("/api/breedings", body), indent=2)


@mcp.tool()
def update_breeding_status(
    breeding_id: str,
    status: str,
    confirmed_at: str = "",
    expected_foal_date: str = "",
    notes: str = "",
) -> str:
    """Update the status of an existing breeding record.

    Args:
      breeding_id: ID of the breeding record
      status: New status — one of: bred, confirmed_in_foal, slipped, barren
              (use record_foal_born to set foaled status)
      confirmed_at: Date pregnancy was confirmed (YYYY-MM-DD), for confirmed_in_foal
      expected_foal_date: Updated expected foaling date (YYYY-MM-DD)
      notes: Updated notes
    """
    valid = {"bred", "confirmed_in_foal", "slipped", "barren"}
    if status not in valid:
        return json.dumps({"error": f"status must be one of: {', '.join(sorted(valid))}"})
    body: dict = {"status": status}
    if confirmed_at:
        body["confirmedAt"] = confirmed_at
    if expected_foal_date:
        body["expectedFoalDate"] = expected_foal_date
    if notes:
        body["notes"] = notes
    return json.dumps(_patch(f"/api/breedings/{breeding_id}", body), indent=2)


@mcp.tool()
def record_foal_born(
    breeding_id: str,
    foaled_at: str,
    name: str = "",
    sex: str = "",
    color: str = "",
    notes: str = "",
) -> str:
    """Record that a foal was born from a breeding.

    Sets the breeding status to 'foaled' and creates a foal record.

    Args:
      breeding_id: ID of the breeding record
      foaled_at: Date the foal was born (YYYY-MM-DD)
      name: Foal's name (can be set later)
      sex: colt, filly, or gelding
      color: Foal's color
      notes: Any notes about the birth
    """
    body: dict = {"foaledAt": foaled_at}
    if name:
        body["name"] = name
    if sex:
        body["sex"] = sex
    if color:
        body["color"] = color
    if notes:
        body["notes"] = notes
    return json.dumps(_post(f"/api/breedings/{breeding_id}/foal", body), indent=2)


@mcp.tool()
def list_breedings() -> str:
    """List all breeding records for the current user's mares.

    Returns full detail on each breeding including mare, stallion, status, dates, and foal.
    """
    return json.dumps(_get("/api/breedings"), indent=2)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    mcp.run()
