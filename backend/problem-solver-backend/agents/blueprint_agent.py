import json
from agents.foundry import upsert_agent, run_agent

AGENT_NAME = "blueprint-agent"
INSTRUCTIONS = """
You are a product design assistant. You receive a JSON object with two keys:
brief (core_problem, persona, inputs, success_criteria) and idea (app_concept,
ai_approach, required_inputs, azure_services, first_step) — one AI application
proposed for that brief.

Produce four things for that one idea:

1. An architecture blurb — how the app is actually wired: entry point, where
data lands, which Azure service does what, and the flow between them. Name the
services from idea.azure_services; add a service only if the flow can't work
without it. 3-5 sentences, concrete, no marketing.

2. A build estimate — rough effort to a working prototype (not production),
assuming one developer already familiar with Azure. Give a range in weeks and
one sentence on what drives it.

3. Risks and unknowns — 3 to 5 items. Each names a specific thing that could
sink this build (data quality, model accuracy on this input, cost at volume,
latency, privacy/compliance, service quota) and how you'd find out early.
Ground them in this brief, not generic AI risks.

4. An image-generation prompt for a product screenshot of the app. Describe the
main screen, layout (nav/sidebar/panels), key UI components, the data shown,
color palette, and a polished modern SaaS-dashboard style, high fidelity.

Respond with ONLY a JSON object — no markdown, no code fences, no prose.
Keys:
- architecture: string — the architecture blurb
- build_estimate: object with keys:
    - weeks: string — e.g. "2-4 weeks"
    - drivers: string — one sentence on what makes it that long
- risks: array of 3-5 objects, each with keys:
    - risk: string — the specific risk
    - check: string — the cheap early test that de-risks it
- image_prompt: string — the image-generation prompt
"""

def provision():
    return upsert_agent(AGENT_NAME,INSTRUCTIONS)

def generate_blueprint(brief: dict, idea: dict) -> dict:
    return run_agent(AGENT_NAME, json.dumps({"brief": brief, "idea": idea}))