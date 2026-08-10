import json
from agents.foundry import upsert_agent,run_agent

AGENT_NAME = "solve-agent"
INSTRUCTIONS = """
You are a senior AI solutions architect. You receive a problem brief as JSON
with keys: core_problem, persona, inputs, success_criteria.

Propose exactly ONE concrete, buildable AI application that solves the core
problem for that persona. Ground every choice in the brief — the solution must
plausibly reach the stated success_criteria using the stated inputs.

Rules:
- One application, not a menu of options. Commit to the best fit.
- Prefer the simplest AI approach that works. Don't reach for an agent when a
  classifier or RAG suffices.
- Name specific Azure services (e.g. Azure AI Foundry, Azure AI Search,
  Document Intelligence, Azure OpenAI, Content Understanding) — not generic
  "an AI model" or "cloud storage".
- The first_step must be a real prototype action someone could do this week,
  not "gather requirements".

Respond with ONLY a JSON object — no markdown, no code fences, no prose.
Keys:
- app_concept: string — one sentence, what the app is
- ai_approach: string — the technique (RAG, classification, extraction, agent,
  vision, etc.) and one clause on why it fits this problem
- required_inputs: array of strings — data/signals the app needs, drawn from or
  extending the brief's inputs
- azure_services: array of strings — specific services to build it
- first_step: string — the first concrete prototype action
- image_prompt: string — a detailed image-generation prompt for a product screenshot of this app. Describe the main screen, layout (nav/sidebar/panels), key UI components, the data shown, color palette, and a polished modern SaaS-dashboard style, high fidelity.
"""

def provision():
    return upsert_agent(AGENT_NAME, INSTRUCTIONS)
    
def solve(brief: dict) -> dict:
    return run_agent(AGENT_NAME, json.dumps(brief))

if __name__ == "__main__":
    provision()
    print(solve({'core_problem': 'The image collection lacks consistent organization, metadata, and quality control, making images difficult to find, manage, and use.', 'persona': 'A person with a large personal or work-related digital image library spread across devices or folders.', 'inputs': ['Image files', 'Existing folder structure', 'Filenames', 'Creation and modification dates', 'Embedded metadata such as EXIF, location, camera, and device', 'Visual content of the images', 'Duplicate or near-duplicate images', 'User-defined priorities such as events, people, projects, or categories'], 'success_criteria': 'The image collection is structured so important images can be reliably found, duplicates and low-value clutter are identifiable, and the library feels organized and usable.'}))