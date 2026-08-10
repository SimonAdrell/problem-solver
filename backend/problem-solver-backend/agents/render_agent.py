from agents.foundry import upsert_agent,generate_image

AGENT_NAME = "render-agent"
INSTRUCTIONS = """

"""

def provision():
    return upsert_agent(AGENT_NAME,INSTRUCTIONS)

def render_image(proposal: dict):
    return generate_image(proposal['image_prompt'])